// Package server : serveur HTTP local d'OpenMaltForge — interface embarquée et API JSON de la base.
//
// Routes :
//
//	GET  /api/etat     état complet de l'application (JSON, voir package store)
//	PUT  /api/etat     remplace l'état (en-tête X-OpenMaltForge: 1 obligatoire)
//	GET  /api/info     nom, chemin, taille, date et structure de la base
//	GET  /api/export   copie SQLite de la base (AAAAMMJJ_openmaltforge.sqlite)
//	POST /api/import   remplace la base par le fichier SQLite envoyé (X-OpenMaltForge: 1), après sauvegarde
//	POST /api/don      ouvre la page de don (config.DonURL) dans le navigateur habituel
//	GET  /api/ping     battement de la fenêtre ; /api/bye : la fenêtre se ferme
package server

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"openmaltforge/internal/config"
	"openmaltforge/internal/db"
	"openmaltforge/internal/desktop"
	"openmaltforge/internal/store"
)

// FileName : nom de la base dans le dossier de données.
const FileName = "openmaltforge.sqlite"

// LegacyFileNames : bases des anciens noms de l'application (OpenBrew 5.x, BrewCraft 4.x), reprises au premier lancement.
var LegacyFileNames = []string{"openbrew.sqlite", "brewcraft.sqlite"}

// PingTimeout : sans battement de la fenêtre pendant cette durée, le mode bureau s'arrête.
const PingTimeout = 90 * time.Second

const maxBody = 512 << 20

// Server détient la base ouverte.
type Server struct {
	mu       sync.Mutex
	db       *sql.DB
	st       *store.Store // accès à l'état (écriture différentielle)
	dir      string       // dossier de données (~/OpenMaltForge)
	path     string       // chemin de la base
	backups  string       // dossier des sauvegardes
	web      fs.FS
	lastPing atomic.Int64
	// Imported : ancienne base reprise au premier lancement ("" sinon) ; Backup : sauvegarde avant migration.
	Imported, Backup string
}

// Open prépare le dossier de données et ouvre la base (dir/openmaltforge.sqlite).
// Au premier lancement (pas encore de openmaltforge.sqlite), la base est reprise, sans modifier l'original :
//   - d'abord la base d'OpenBrew 5.x ou de BrewCraft 4.x (openbrew.sqlite / brewcraft.sqlite, et son journal s'il
//     existe) du premier dossier legacy qui en contient une (anciens dossiers ~/OpenBrew puis ~/BrewCraft) ;
//   - sinon la plus récente base de BrewCraft 3.x (brewcraft_<version>.sqlite) du dossier ou des dossiers legacy.
//
// La base est ensuite migrée.
func Open(dir string, web fs.FS, legacy ...string) (*Server, error) {
	s := &Server{dir: dir, path: filepath.Join(dir, FileName), backups: filepath.Join(dir, "sauvegardes"), web: web}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	/* 6.11.0 : base ouverte en dernier (créée ou choisie dans Paramètres › Réglages) */
	if a := activeBase(dir); a != "" {
		s.path = a
	} else if _, err := os.Stat(s.path); errors.Is(err, os.ErrNotExist) {
		old := ""
	search:
		for _, l := range legacy {
			for _, n := range LegacyFileNames {
				if f := filepath.Join(l, n); isFile(f) {
					old = f
					break search
				}
			}
		}
		if old == "" {
			old = newestLegacy(append([]string{dir}, legacy...))
		}
		if old != "" {
			if err := copyFile(old, s.path); err != nil {
				return nil, fmt.Errorf("reprise de %s : %w", filepath.Base(old), err)
			}
			/* journal d'une écriture interrompue : copié aussi, SQLite le rejoue sur la copie */
			if isFile(old + "-journal") {
				if err := copyFile(old+"-journal", s.path+"-journal"); err != nil {
					return nil, fmt.Errorf("reprise de %s : %w", filepath.Base(old)+"-journal", err)
				}
			}
			s.Imported = old
		}
	}
	d, err := db.Open(s.path)
	if err != nil {
		return nil, err
	}
	if s.Backup, err = db.Migrate(d, s.backups); err != nil {
		d.Close()
		return nil, err
	}
	s.db, s.st = d, store.New(d)
	s.lastPing.Store(time.Now().UnixNano())
	return s, nil
}

// Close ferme la base.
func (s *Server) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Close()
}

// Path renvoie le chemin de la base.
func (s *Server) Path() string { return s.path }

// LastPing : date du dernier battement de la fenêtre.
func (s *Server) LastPing() time.Time { return time.Unix(0, s.lastPing.Load()) }

// TouchPing repousse l'arrêt automatique (fenêtre qui vient de s'ouvrir).
func (s *Server) TouchPing() { s.lastPing.Store(time.Now().UnixNano()) }

func isFile(f string) bool {
	st, err := os.Stat(f)
	return err == nil && st.Mode().IsRegular()
}

func newestLegacy(dirs []string) string {
	var best string
	var bt time.Time
	for _, dir := range dirs {
		files, _ := filepath.Glob(filepath.Join(dir, "brewcraft_*.sqlite"))
		for _, f := range files {
			if st, err := os.Stat(f); err == nil && st.Mode().IsRegular() && st.ModTime().After(bt) {
				best, bt = f, st.ModTime()
			}
		}
	}
	return best
}

func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	tmp := dst + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, dst)
}

// Handler renvoie le routeur HTTP.
func (s *Server) Handler() http.Handler {
	mime.AddExtensionType(".js", "text/javascript")
	mime.AddExtensionType(".css", "text/css")
	mux := http.NewServeMux()
	mux.HandleFunc("/api/etat", s.etat)
	mux.HandleFunc("/api/info", s.info)
	mux.HandleFunc("/api/export", s.export)
	mux.HandleFunc("/api/import", s.importDb)
	mux.HandleFunc("/api/bases", s.bases)
	mux.HandleFunc("/api/don", s.don)
	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		s.TouchPing()
		w.WriteHeader(http.StatusNoContent)
	})
	// la page se ferme : arrêt dans 4 s, sauf nouveau battement (rechargement de la page)
	mux.HandleFunc("/api/bye", func(w http.ResponseWriter, r *http.Request) {
		s.lastPing.Store(time.Now().Add(-PingTimeout + 4*time.Second).UnixNano())
		w.WriteHeader(http.StatusNoContent)
	})
	files := http.FileServer(http.FS(s.web))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	}))
	return localOnly(mux)
}

// localOnly refuse les requêtes dont l'en-tête Host n'est pas local (protection contre le
// « DNS rebinding » : une page web distante ne peut pas atteindre l'API du poste).
func localOnly(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if hh, _, err := net.SplitHostPort(host); err == nil {
			host = hh
		}
		if host != "localhost" && host != "127.0.0.1" && host != "::1" && host != "[::1]" {
			http.Error(w, "accès refusé", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func writeAllowed(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-OpenMaltForge") != "1" {
		http.Error(w, "refusé : en-tête X-OpenMaltForge manquant", http.StatusForbidden)
		return false
	}
	return true
}

func (s *Server) dbHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-OpenMaltForge-Db", url.PathEscape(filepath.Base(s.path)))
	w.Header().Set("X-OpenMaltForge-Path", url.PathEscape(s.path))
	if st, err := os.Stat(s.path); err == nil {
		w.Header().Set("X-OpenMaltForge-Mtime", fmt.Sprint(st.ModTime().UnixMilli()))
	}
}

func (s *Server) etat(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet, http.MethodHead:
		s.mu.Lock()
		b, err := s.st.Load()
		s.mu.Unlock()
		if err != nil {
			http.Error(w, "lecture de la base : "+err.Error(), http.StatusInternalServerError)
			return
		}
		s.dbHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodGet {
			w.Write(b)
		}
	case http.MethodPut:
		if !writeAllowed(w, r) {
			return
		}
		b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		s.mu.Lock()
		err = s.st.Save(b)
		s.mu.Unlock()
		if err != nil {
			http.Error(w, "écriture de la base : "+err.Error(), http.StatusBadRequest)
			return
		}
		s.dbHeaders(w)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
	}
}

// Info : description de la base ouverte.
type Info struct {
	Nom          string `json:"nom"`
	Chemin       string `json:"chemin"`
	Dossier      string `json:"dossier"`
	Sauvegardes  string `json:"sauvegardes"`
	Taille       int64  `json:"taille"`
	Modifie      int64  `json:"modifie"`
	Structure    int    `json:"structure"`
	Version      string `json:"version"`
	Reprise      string `json:"reprise,omitempty"`
	NbSauvegarde int    `json:"nbSauvegardes"`
	Don          bool   `json:"don"`              // page de don (config.DonURL) renseignée
	DonURL       string `json:"donUrl,omitempty"` // son adresse, affichée dans la fenêtre « Offrir un café »
}

func (s *Server) info(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	v, _ := db.SchemaVersion(s.db)
	path := s.path
	s.mu.Unlock()
	in := Info{Nom: filepath.Base(path), Chemin: path, Dossier: s.dir, Sauvegardes: s.backups, Structure: v,
		Version: config.Version, Reprise: filepath.Base(s.Imported), Don: config.DonURL != "", DonURL: config.DonURL}
	if s.Imported == "" {
		in.Reprise = ""
	}
	if st, err := os.Stat(path); err == nil {
		in.Taille, in.Modifie = st.Size(), st.ModTime().UnixMilli()
	}
	if f, _ := filepath.Glob(filepath.Join(s.backups, "*.sqlite")); f != nil {
		in.NbSauvegarde = len(f)
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(in)
}

// OpenURL ouvre une page dans le navigateur habituel (remplacée par les tests).
var OpenURL = desktop.OpenURL

// don ouvre la page de don (config.DonURL) dans le navigateur habituel ; aucune autre adresse n'est acceptée.
func (s *Server) don(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}
	if !writeAllowed(w, r) {
		return
	}
	if config.DonURL == "" {
		http.Error(w, "adresse de la page de don pas encore renseignée", http.StatusNotFound)
		return
	}
	if err := OpenURL(config.DonURL); err != nil {
		http.Error(w, "ouverture du navigateur impossible : "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ExportName : nom du fichier exporté (AAAAMMJJ_openmaltforge.sqlite).
func ExportName(t time.Time) string { return t.Format("20060102") + "_openmaltforge.sqlite" }

func (s *Server) export(w http.ResponseWriter, r *http.Request) {
	tmp, err := os.MkdirTemp("", "openmaltforge-export-")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tmp)
	p := filepath.Join(tmp, "export.sqlite")
	switch r.Method {
	case http.MethodGet: // base telle qu'enregistrée
		s.mu.Lock()
		_, err = s.db.Exec("VACUUM INTO ?", p)
		s.mu.Unlock()
	case http.MethodPost: // état affiché par la fenêtre (modifications non enregistrées comprises), sans toucher à la base
		if !writeAllowed(w, r) {
			return
		}
		var b []byte
		if b, err = io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody)); err == nil {
			err = exportState(p, b)
		}
	default:
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}
	if err != nil {
		http.Error(w, "export : "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/vnd.sqlite3")
	w.Header().Set("Content-Disposition", `attachment; filename="`+ExportName(time.Now())+`"`)
	http.ServeFile(w, r, p)
}

// exportState écrit un état JSON dans une nouvelle base SQLite (structure à jour).
func exportState(path string, state []byte) error {
	d, err := db.Open(path)
	if err != nil {
		return err
	}
	defer d.Close()
	if _, err := db.Migrate(d, ""); err != nil {
		return err
	}
	return store.Save(d, state)
}

func (s *Server) importDb(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}
	if !writeAllowed(w, r) {
		return
	}
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Import(b); err != nil {
		code := http.StatusBadRequest
		if !errors.Is(err, errInvalid) && !errors.Is(err, db.ErrPasOpenMaltForge) && !errors.Is(err, db.ErrTropRecente) {
			code = http.StatusInternalServerError
		}
		http.Error(w, err.Error(), code)
		return
	}
	s.dbHeaders(w)
	w.WriteHeader(http.StatusNoContent)
}

var errInvalid = errors.New("ce fichier n'est pas une base OpenMaltForge valide")

// Import remplace la base par le contenu d'un fichier SQLite : le fichier est vérifié et migré à
// part, la base actuelle est sauvegardée, puis remplacée.
func (s *Server) Import(b []byte) error {
	if !db.IsSQLite(b) {
		return errInvalid
	}
	tmp := s.path + ".import"
	os.Remove(tmp)
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	defer os.Remove(tmp)
	nd, err := db.Open(tmp)
	if err != nil {
		return fmt.Errorf("%w : %v", errInvalid, err)
	}
	var n int
	if err := nd.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='table'").Scan(&n); err != nil || n == 0 {
		nd.Close()
		return errInvalid
	}
	if _, err := db.Migrate(nd, ""); err != nil {
		nd.Close()
		return err
	}
	if _, err := store.Load(nd); err != nil {
		nd.Close()
		return fmt.Errorf("%w : %v", errInvalid, err)
	}
	if err := nd.Close(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := db.Backup(s.db, s.backups, "avant_import"); err != nil {
		return fmt.Errorf("sauvegarde avant import : %w", err)
	}
	s.db.Close()
	renameErr := os.Rename(tmp, s.path)
	d, err := db.Open(s.path)
	if err != nil {
		return err
	}
	s.db, s.st = d, store.New(d)
	return renameErr
}
