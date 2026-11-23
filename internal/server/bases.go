package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"

	"openmaltforge/internal/db"
	"openmaltforge/internal/store"
)

// ActiveFile : fichier du dossier de données qui retient la base ouverte en dernier (6.11.0).
const ActiveFile = "base_active"

var errNom = errors.New("nom de base invalide : lettres, chiffres, espaces, tirets, points et soulignés uniquement (80 caractères au plus)")

// baseFile renvoie le nom de fichier d'une base à partir du nom saisi (« .sqlite » ajouté s'il manque).
func baseFile(nom string) (string, error) {
	nom = strings.TrimSpace(nom)
	nom = strings.TrimSuffix(nom, ".sqlite")
	nom = strings.TrimSpace(nom)
	if nom == "" || len([]rune(nom)) > 80 || strings.HasPrefix(nom, ".") {
		return "", errNom
	}
	for _, r := range nom {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' || r == '-' || r == '_' || r == '.') {
			return "", errNom
		}
	}
	return nom + ".sqlite", nil
}

// activeBase lit la base retenue (fichier ActiveFile) ; "" si aucune ou si elle n'existe plus.
func activeBase(dir string) string {
	b, err := os.ReadFile(filepath.Join(dir, ActiveFile))
	if err != nil {
		return ""
	}
	f, err := baseFile(string(b))
	if err != nil || !isFile(filepath.Join(dir, f)) {
		return ""
	}
	return filepath.Join(dir, f)
}

// Bases liste les bases (*.sqlite) du dossier de données.
func (s *Server) Bases() []string {
	l := []string{}
	files, _ := filepath.Glob(filepath.Join(s.dir, "*.sqlite"))
	for _, f := range files {
		if isFile(f) {
			l = append(l, filepath.Base(f))
		}
	}
	sort.Slice(l, func(i, j int) bool { return strings.ToLower(l[i]) < strings.ToLower(l[j]) })
	return l
}

// switchTo ouvre (et met à niveau) la base path, puis remplace la base ouverte ; s.mu doit être tenu.
func (s *Server) switchTo(path string) error {
	d, err := db.Open(path)
	if err != nil {
		return err
	}
	if _, err := db.Migrate(d, s.backups); err != nil {
		d.Close()
		return err
	}
	s.db.Close()
	s.db, s.st, s.path, s.Imported = d, store.New(d), path, ""
	return os.WriteFile(filepath.Join(s.dir, ActiveFile), []byte(filepath.Base(path)), 0o644)
}

// CreateBase crée la base nom (état JSON fourni) et l'ouvre ; erreur si elle existe déjà.
func (s *Server) CreateBase(nom string, state []byte) error {
	f, err := baseFile(nom)
	if err != nil {
		return err
	}
	p := filepath.Join(s.dir, f)
	if _, err := os.Stat(p); err == nil {
		return errExiste
	}
	if err := exportState(p, state); err != nil {
		os.Remove(p)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.switchTo(p)
}

// OpenBase ouvre une base existante du dossier de données.
func (s *Server) OpenBase(nom string) error {
	f, err := baseFile(nom)
	if err != nil {
		return err
	}
	p := filepath.Join(s.dir, f)
	if !isFile(p) {
		return errAbsente
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if p == s.path {
		return nil
	}
	return s.switchTo(p)
}

var (
	errExiste  = errors.New("une base de ce nom existe déjà")
	errAbsente = errors.New("base introuvable dans le dossier de données")
)

// bases : GET = liste des bases du dossier et base ouverte ; POST {action: "creer"|"ouvrir", nom, etat}.
func (s *Server) bases(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		act := filepath.Base(s.path)
		s.mu.Unlock()
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(map[string]any{"actif": act, "bases": s.Bases()})
	case http.MethodPost:
		if !writeAllowed(w, r) {
			return
		}
		var q struct {
			Action string          `json:"action"`
			Nom    string          `json:"nom"`
			Etat   json.RawMessage `json:"etat"`
		}
		b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
		if err == nil {
			err = json.Unmarshal(b, &q)
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		switch q.Action {
		case "creer":
			err = s.CreateBase(q.Nom, q.Etat)
		case "ouvrir":
			err = s.OpenBase(q.Nom)
		default:
			err = errors.New("action inconnue")
		}
		if err != nil {
			code := http.StatusInternalServerError
			if errors.Is(err, errNom) || errors.Is(err, errExiste) || errors.Is(err, errAbsente) || err.Error() == "action inconnue" {
				code = http.StatusBadRequest
			}
			http.Error(w, err.Error(), code)
			return
		}
		s.dbHeaders(w)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
	}
}
