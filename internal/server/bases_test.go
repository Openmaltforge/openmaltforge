package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 6.11.0 : création d'une base nommée, bascule, liste, base retenue au lancement suivant.
func TestCreerEtOuvrirBase(t *testing.T) {
	dir := t.TempDir()
	s, ts := newServer(t, dir)
	if r, b := do(t, "PUT", ts.URL+"/api/etat", []byte(etat), w1); r.StatusCode != 204 {
		t.Fatalf("écriture : %d %s", r.StatusCode, b)
	}
	neuf := `{"malts":[],"kv":{"equip":{"nom":"essai"},"recipe":{}}}`
	body := func(action, nom, st string) []byte {
		q := `{"action":"` + action + `","nom":` + strings.ReplaceAll(`"`+nom+`"`, "\\", "\\\\")
		if st != "" {
			q += `,"etat":` + st
		}
		return []byte(q + "}")
	}
	for _, nom := range []string{"", "../x", ".cache", "a/b", "x:y"} {
		if r, _ := do(t, "POST", ts.URL+"/api/bases", body("creer", nom, neuf), w1); r.StatusCode != 400 {
			t.Errorf("nom %q : %d, attendu 400", nom, r.StatusCode)
		}
	}
	if r, _ := do(t, "POST", ts.URL+"/api/bases", body("creer", "Brasserie 2", neuf), nil); r.StatusCode != 403 {
		t.Errorf("création sans en-tête : %d, attendu 403", r.StatusCode)
	}
	r, b := do(t, "POST", ts.URL+"/api/bases", body("creer", "Brasserie 2.sqlite", neuf), w1)
	if r.StatusCode != 204 || r.Header.Get("X-OpenMaltForge-Db") != "Brasserie%202.sqlite" {
		t.Fatalf("création : %d %s %q", r.StatusCode, b, r.Header.Get("X-OpenMaltForge-Db"))
	}
	if filepath.Base(s.Path()) != "Brasserie 2.sqlite" {
		t.Errorf("base ouverte : %s", s.Path())
	}
	if _, b := do(t, "GET", ts.URL+"/api/etat", nil, nil); !strings.Contains(string(b), `"nom":"essai"`) || strings.Contains(string(b), "Pilsen") {
		t.Errorf("état de la nouvelle base : %s", b)
	}
	if r, _ := do(t, "POST", ts.URL+"/api/bases", body("creer", "Brasserie 2", neuf), w1); r.StatusCode != 400 {
		t.Errorf("base déjà existante : %d, attendu 400", r.StatusCode)
	}
	_, b = do(t, "GET", ts.URL+"/api/bases", nil, nil)
	var l struct {
		Actif string   `json:"actif"`
		Bases []string `json:"bases"`
	}
	if json.Unmarshal(b, &l); l.Actif != "Brasserie 2.sqlite" || strings.Join(l.Bases, "|") != "Brasserie 2.sqlite|openmaltforge.sqlite" {
		t.Errorf("liste : %s", b)
	}
	if a, _ := os.ReadFile(filepath.Join(dir, ActiveFile)); string(a) != "Brasserie 2.sqlite" {
		t.Errorf("base retenue : %q", a)
	}
	if r, _ := do(t, "POST", ts.URL+"/api/bases", body("ouvrir", "inconnue", ""), w1); r.StatusCode != 400 {
		t.Errorf("ouverture d'une base absente : %d, attendu 400", r.StatusCode)
	}
	if r, b := do(t, "POST", ts.URL+"/api/bases", body("ouvrir", "openmaltforge", ""), w1); r.StatusCode != 204 {
		t.Fatalf("ouverture : %d %s", r.StatusCode, b)
	}
	if _, b := do(t, "GET", ts.URL+"/api/etat", nil, nil); !strings.Contains(string(b), "Pilsen") {
		t.Errorf("retour à la première base : %s", b)
	}
	do(t, "POST", ts.URL+"/api/bases", body("ouvrir", "Brasserie 2", ""), w1)
	s.Close()
	s2, err := Open(dir, webFS)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	if filepath.Base(s2.Path()) != "Brasserie 2.sqlite" {
		t.Errorf("relance : base ouverte %s, attendu Brasserie 2.sqlite", s2.Path())
	}
}
