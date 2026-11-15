// Package db ouvre la base SQLite d'OpenMaltForge (pilote modernc.org/sqlite, Go pur, sans CGO)
// et applique les migrations versionnées.
//
// La version de structure est le numéro PRAGMA user_version : 0 = base sans numéro (créée par
// l'application 3.x avec sql.js, ou fichier neuf), N = migrations 1..N appliquées.
// Avant toute migration d'une base qui contient déjà des tables, une copie est écrite dans le
// dossier des sauvegardes. Une base plus récente que l'application est refusée.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite" // enregistre le pilote « sqlite »
)

// ErrTropRecente : la base a été écrite par une version plus récente d'OpenMaltForge.
var ErrTropRecente = errors.New("base créée par une version plus récente d'OpenMaltForge")

// ErrPasOpenMaltForge : le fichier est une base SQLite, mais pas une base OpenMaltForge.
var ErrPasOpenMaltForge = errors.New("ce fichier n'est pas une base OpenMaltForge")

// Open ouvre (ou crée) la base. Journal classique (pas de WAL) : la base reste un seul fichier,
// que l'utilisateur peut copier ou sauvegarder à tout moment.
func Open(path string) (*sql.DB, error) {
	dsn := "file:" + uriPath(path) +
		"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(DELETE)&_pragma=synchronous(FULL)&_txlock=immediate"
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// Une seule connexion : application de bureau mono-utilisateur, écritures sérialisées.
	d.SetMaxOpenConns(1)
	var n int
	if err := d.QueryRow("SELECT count(*) FROM sqlite_master").Scan(&n); err != nil {
		d.Close()
		return nil, fmt.Errorf("ouverture de la base %s : %w", path, err)
	}
	return d, nil
}

// uriPath rend un chemin utilisable dans une URI SQLite (https://sqlite.org/uri.html).
func uriPath(p string) string {
	p = filepath.ToSlash(p)
	p = strings.NewReplacer("%", "%25", "?", "%3f", "#", "%23").Replace(p)
	if len(p) >= 2 && p[1] == ':' { // lettre de lecteur Windows : file:///C:/…
		p = "///" + p
	}
	return p
}

// IsSQLite vérifie la signature d'un fichier SQLite (« SQLite format 3\0 »).
func IsSQLite(b []byte) bool {
	return len(b) >= 100 && string(b[:16]) == "SQLite format 3\x00"
}

// SchemaVersion renvoie le numéro de structure de la base (PRAGMA user_version).
func SchemaVersion(d *sql.DB) (int, error) {
	var v int
	err := d.QueryRow("PRAGMA user_version").Scan(&v)
	return v, err
}

// Latest est le numéro de structure attendu par cette version de l'application.
func Latest() int { return len(migrations) }

func tableNames(q interface {
	Query(string, ...any) (*sql.Rows, error)
}) (map[string]bool, error) {
	r, err := q.Query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
	if err != nil {
		return nil, err
	}
	defer r.Close()
	m := map[string]bool{}
	for r.Next() {
		var n string
		if err := r.Scan(&n); err != nil {
			return nil, err
		}
		m[n] = true
	}
	return m, r.Err()
}

// Migrate met la base au niveau de structure de l'application.
// backupDir reçoit une copie de la base avant la première migration (si la base n'est pas vide ;
// "" = pas de copie, pour un fichier temporaire).
// Renvoie le chemin de la sauvegarde ("" si aucune).
func Migrate(d *sql.DB, backupDir string) (backup string, err error) {
	v, err := SchemaVersion(d)
	if err != nil {
		return "", err
	}
	if v > Latest() {
		return "", fmt.Errorf("%w (structure %d, cette version de l'application gère jusqu'à %d) : installez la dernière version d'OpenMaltForge",
			ErrTropRecente, v, Latest())
	}
	if v == Latest() {
		return "", nil
	}
	tn, err := tableNames(d)
	if err != nil {
		return "", err
	}
	if len(tn) > 0 {
		if !knownTables(tn) {
			return "", ErrPasOpenMaltForge
		}
	}
	if len(tn) > 0 && backupDir != "" {
		if backup, err = Backup(d, backupDir, fmt.Sprintf("avant_structure_%d", v+1)); err != nil {
			return "", fmt.Errorf("sauvegarde avant migration : %w", err)
		}
	}
	for _, m := range migrations[v:] {
		tx, err := d.Begin()
		if err != nil {
			return backup, err
		}
		if err := m.run(tx); err != nil {
			tx.Rollback()
			return backup, fmt.Errorf("migration %d (%s) : %w", m.version, m.name, err)
		}
		if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", m.version)); err != nil {
			tx.Rollback()
			return backup, err
		}
		if err := tx.Commit(); err != nil {
			return backup, err
		}
	}
	return backup, nil
}

// Backup écrit une copie cohérente de la base (VACUUM INTO) dans dir :
// openmaltforge_AAAAMMJJ-HHMMSS_<motif>.sqlite.
func Backup(d *sql.DB, dir, motif string) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	p := filepath.Join(dir, "openmaltforge_"+time.Now().Format("20060102-150405")+"_"+motif+".sqlite")
	for i := 2; ; i++ { // deux sauvegardes dans la même seconde
		if _, err := os.Stat(p); errors.Is(err, os.ErrNotExist) {
			break
		}
		p = filepath.Join(dir, fmt.Sprintf("openmaltforge_%s_%s_%d.sqlite", time.Now().Format("20060102-150405"), motif, i))
	}
	if _, err := d.Exec("VACUUM INTO ?", p); err != nil {
		return "", err
	}
	return p, nil
}

// knownTables indique si au moins une table porte un nom de table OpenMaltForge (actuel ou ancien).
func knownTables(tn map[string]bool) bool {
	for _, t := range TablesV1 {
		if tn[t] {
			return true
		}
	}
	for _, t := range legacyNames {
		if tn[t] {
			return true
		}
	}
	return tn["params"]
}
