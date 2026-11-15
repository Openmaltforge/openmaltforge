package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"openmaltforge/internal/config"
	"openmaltforge/internal/db"
	"openmaltforge/internal/desktop"
)

var webFS = fstest.MapFS{"index.html": {Data: []byte("<!doctype html><title>OpenMaltForge</title>")}}

func newServer(t *testing.T, dir string) (*Server, *httptest.Server) {
	t.Helper()
	s, err := Open(dir, webFS)
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(func() { ts.Close(); s.Close() })
	return s, ts
}

func do(t *testing.T, method, url string, body []byte, hdr map[string]string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest(method, url, bytes.NewReader(body))
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	r, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(r.Body)
	r.Body.Close()
	return r, b
}

var w1 = map[string]string{"X-OpenMaltForge": "1", "Content-Type": "application/json"}

const etat = `{"malts":[{"name":"Pilsen","ebc":3.5}],"kv":{"equip":{"vol":30},"recipe":{"name":"IPA"}}}`

func TestEtat(t *testing.T) {
	_, ts := newServer(t, t.TempDir())
	r, b := do(t, "GET", ts.URL+"/api/etat", nil, nil)
	if r.StatusCode != 200 || string(b) != `{"kv":{"equip":{},"recipe":{}}}` {
		t.Fatalf("base neuve : %d %s", r.StatusCode, b)
	}
	if r.Header.Get("X-OpenMaltForge-Db") != FileName {
		t.Errorf("en-tête X-OpenMaltForge-Db : %q", r.Header.Get("X-OpenMaltForge-Db"))
	}
	if r, _ := do(t, "PUT", ts.URL+"/api/etat", []byte(etat), nil); r.StatusCode != 403 {
		t.Errorf("écriture sans en-tête X-OpenMaltForge : %d, attendu 403", r.StatusCode)
	}
	if r, b := do(t, "PUT", ts.URL+"/api/etat", []byte(etat), w1); r.StatusCode != 204 {
		t.Fatalf("écriture : %d %s", r.StatusCode, b)
	}
	if r, _ := do(t, "PUT", ts.URL+"/api/etat", []byte("pas du json"), w1); r.StatusCode != 400 {
		t.Errorf("état invalide : %d, attendu 400", r.StatusCode)
	}
	_, b = do(t, "GET", ts.URL+"/api/etat", nil, nil)
	var o map[string]any
	if err := json.Unmarshal(b, &o); err != nil || !strings.Contains(string(b), `{"name":"Pilsen","ebc":3.5}`) {
		t.Errorf("relecture : %s", b)
	}
}

func TestHoteLocalSeulement(t *testing.T) {
	_, ts := newServer(t, t.TempDir())
	req, _ := http.NewRequest("GET", ts.URL+"/api/etat", nil)
	req.Host = "attaquant.example"
	r, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	r.Body.Close()
	if r.StatusCode != 403 {
		t.Errorf("hôte non local : %d, attendu 403", r.StatusCode)
	}
	if r, b := do(t, "GET", ts.URL+"/", nil, nil); r.StatusCode != 200 || !strings.Contains(string(b), "OpenMaltForge") {
		t.Errorf("interface : %d", r.StatusCode)
	}
}

func TestRepriseAuPremierLancement(t *testing.T) {
	dir := t.TempDir()
	// base 3.x : brewcraft_<version>.sqlite (la plus récente est reprise)
	old := filepath.Join(dir, "brewcraft_3.128.0.sqlite")
	d, _ := db.Open(old)
	d.Exec(`create table malt(id integer primary key,nom text,donnees text)`)
	d.Exec(`insert into malt(nom,donnees) values('M','{"name":"M"}')`)
	d.Close()
	before, _ := os.ReadFile(old)
	s, ts := newServer(t, dir)
	if s.Imported != old || s.Backup == "" {
		t.Errorf("reprise : %q, sauvegarde : %q", s.Imported, s.Backup)
	}
	after, _ := os.ReadFile(old)
	if !bytes.Equal(before, after) {
		t.Error("la base 3.x d'origine a été modifiée")
	}
	_, b := do(t, "GET", ts.URL+"/api/etat", nil, nil)
	if !strings.Contains(string(b), `"malts":[{"name":"M"}]`) {
		t.Errorf("état repris : %s", b)
	}
	_, b = do(t, "GET", ts.URL+"/api/info", nil, nil)
	var in Info
	json.Unmarshal(b, &in)
	if in.Structure != db.Latest() || in.Reprise != "brewcraft_3.128.0.sqlite" || in.NbSauvegarde != 1 {
		t.Errorf("info : %+v", in)
	}
}

// Base de BrewCraft 4.x (ancien nom) : ~/BrewCraft/brewcraft.sqlite est copiée sous ~/OpenMaltForge/openmaltforge.sqlite,
// prioritaire sur une base 3.x ; l'original n'est pas modifié ; une base OpenMaltForge existante n'est jamais remplacée.
func TestRepriseBrewCraft(t *testing.T) {
	dir, old := t.TempDir(), t.TempDir()
	src := filepath.Join(old, "brewcraft.sqlite")
	d, _ := db.Open(src)
	d.Exec(`create table malt(id integer primary key,nom text,donnees text)`)
	d.Exec(`insert into malt(nom,donnees) values('B4','{"name":"B4"}')`)
	d.Close()
	d3, _ := db.Open(filepath.Join(old, "brewcraft_3.128.0.sqlite"))
	d3.Exec(`create table malt(id integer primary key,nom text,donnees text)`)
	d3.Close()
	before, _ := os.ReadFile(src)
	s, err := Open(dir, webFS, old)
	if err != nil {
		t.Fatal(err)
	}
	if s.Imported != src {
		t.Errorf("reprise : %q, attendu %q", s.Imported, src)
	}
	b, _ := s.st.Load()
	if !strings.Contains(string(b), `"name":"B4"`) {
		t.Errorf("état repris : %.300s", b)
	}
	s.Close()
	if after, _ := os.ReadFile(src); !bytes.Equal(before, after) {
		t.Error("la base BrewCraft d'origine a été modifiée")
	}
	s2, err := Open(dir, webFS, old)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	if s2.Imported != "" {
		t.Errorf("deuxième lancement : reprise %q, attendu aucune", s2.Imported)
	}
}

// Base d'OpenBrew 5.x (nom précédent) : ~/OpenBrew/openbrew.sqlite est prioritaire sur la base de ~/BrewCraft.
func TestRepriseOpenBrew(t *testing.T) {
	dir, ob, bc := t.TempDir(), t.TempDir(), t.TempDir()
	for _, f := range []string{filepath.Join(ob, "openbrew.sqlite"), filepath.Join(bc, "brewcraft.sqlite")} {
		d, _ := db.Open(f)
		d.Exec(`create table malt(id integer primary key,nom text,donnees text)`)
		d.Exec(`insert into malt(nom,donnees) values(?,?)`, filepath.Base(f), `{"name":"`+filepath.Base(f)+`"}`)
		d.Close()
	}
	s, err := Open(dir, webFS, ob, bc)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if s.Imported != filepath.Join(ob, "openbrew.sqlite") {
		t.Errorf("reprise : %q", s.Imported)
	}
	if b, _ := s.st.Load(); !strings.Contains(string(b), `"name":"openbrew.sqlite"`) {
		t.Errorf("état repris : %.300s", b)
	}
}

func TestBaseTropRecenteRefusee(t *testing.T) {
	dir := t.TempDir()
	d, _ := db.Open(filepath.Join(dir, FileName))
	d.Exec(`create table malt(id integer primary key,nom text,donnees text)`)
	d.Exec(`pragma user_version = 99`)
	d.Close()
	if _, err := Open(dir, webFS); err == nil || !strings.Contains(err.Error(), "plus récente") {
		t.Fatalf("base plus récente acceptée : %v", err)
	}
}

func sqliteFile(t *testing.T, stmts ...string) []byte {
	t.Helper()
	p := filepath.Join(t.TempDir(), "f.sqlite")
	d, err := db.Open(p)
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range stmts {
		if _, err := d.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	d.Close()
	b, _ := os.ReadFile(p)
	return b
}

func TestImport(t *testing.T) {
	dir := t.TempDir()
	_, ts := newServer(t, dir)
	do(t, "PUT", ts.URL+"/api/etat", []byte(etat), w1)
	imp := map[string]string{"X-OpenMaltForge": "1"}
	cases := []struct {
		nom  string
		body []byte
		code int
		msg  string
	}{
		{"texte", []byte("ceci n est pas une base"), 400, "pas une base OpenMaltForge"},
		{"base sans table", sqliteFile(t, "pragma user_version = 0", "create table t(x)", "drop table t"), 400, "pas une base OpenMaltForge"},
		{"autre application", sqliteFile(t, "create table clients(id)"), 400, "pas une base OpenMaltForge"},
		{"plus récente", sqliteFile(t, "create table malt(id integer primary key,nom text,donnees text)", "pragma user_version = 99"), 400, "plus récente"},
	}
	for _, c := range cases {
		r, b := do(t, "POST", ts.URL+"/api/import", c.body, imp)
		if r.StatusCode != c.code || !strings.Contains(string(b), c.msg) {
			t.Errorf("%s : %d %s", c.nom, r.StatusCode, b)
		}
	}
	if r, _ := do(t, "POST", ts.URL+"/api/import", sqliteFile(t, "create table malt(x)"), nil); r.StatusCode != 403 {
		t.Errorf("import sans en-tête : %d", r.StatusCode)
	}
	_, b := do(t, "GET", ts.URL+"/api/etat", nil, nil)
	if !strings.Contains(string(b), "Pilsen") {
		t.Fatal("base actuelle modifiée par un import refusé")
	}
	ok := sqliteFile(t, `create table malt(id integer primary key,nom text,donnees text)`,
		`insert into malt(nom,donnees) values('Importé','{"name":"Importé"}')`)
	if r, b := do(t, "POST", ts.URL+"/api/import", ok, imp); r.StatusCode != 204 {
		t.Fatalf("import valide : %d %s", r.StatusCode, b)
	}
	_, b = do(t, "GET", ts.URL+"/api/etat", nil, nil)
	if !strings.Contains(string(b), "Importé") || strings.Contains(string(b), "Pilsen") {
		t.Errorf("état après import : %s", b)
	}
	bk, _ := filepath.Glob(filepath.Join(dir, "sauvegardes", "*_avant_import.sqlite"))
	if len(bk) != 1 {
		t.Errorf("sauvegarde avant import : %v", bk)
	}
	if _, err := os.Stat(filepath.Join(dir, FileName+".import")); err == nil {
		t.Error("fichier temporaire d'import non supprimé")
	}
}

func TestExport(t *testing.T) {
	_, ts := newServer(t, t.TempDir())
	do(t, "PUT", ts.URL+"/api/etat", []byte(etat), w1)
	r, b := do(t, "GET", ts.URL+"/api/export", nil, nil)
	if r.StatusCode != 200 || !db.IsSQLite(b) || !strings.Contains(r.Header.Get("Content-Disposition"), "_openmaltforge.sqlite") {
		t.Fatalf("export : %d %q", r.StatusCode, r.Header.Get("Content-Disposition"))
	}
	// export de l'état affiché (POST) : la base enregistrée n'est pas modifiée
	modif := strings.Replace(etat, `"vol":30`, `"vol":31`, 1)
	r, b = do(t, "POST", ts.URL+"/api/export", []byte(modif), w1)
	if r.StatusCode != 200 || !db.IsSQLite(b) {
		t.Fatalf("export de l'état : %d %s", r.StatusCode, b)
	}
	p := filepath.Join(t.TempDir(), "x.sqlite")
	os.WriteFile(p, b, 0o644)
	d, _ := db.Open(p)
	var v string
	d.QueryRow(`select valeur from parametres where cle='vol'`).Scan(&v)
	d.Close()
	if v != "31" {
		t.Errorf("export de l'état : vol = %q", v)
	}
	_, b = do(t, "GET", ts.URL+"/api/etat", nil, nil)
	if !strings.Contains(string(b), `"vol":30`) {
		t.Error("l'export de l'état a modifié la base")
	}
	if r, _ := do(t, "POST", ts.URL+"/api/export", []byte(modif), nil); r.StatusCode != 403 {
		t.Errorf("export POST sans en-tête : %d", r.StatusCode)
	}
}

func TestExportName(t *testing.T) {
	if n := ExportName(time.Date(2026, 11, 14, 10, 0, 0, 0, time.Local)); n != "20261114_openmaltforge.sqlite" {
		t.Errorf("nom d'export : %s", n)
	}
}

func TestDon(t *testing.T) {
	_, ts := newServer(t, t.TempDir())
	var opened []string
	OpenURL = func(u string) error { opened = append(opened, u); return nil }
	d0 := config.DonURL
	defer func() { OpenURL = desktop.OpenURL; config.DonURL = d0 }()
	if d0 != "https://ko-fi.com/G7U82APSVO" {
		t.Errorf("adresse de don : %q", d0)
	}
	config.DonURL = ""
	if r, b := do(t, "POST", ts.URL+"/api/don", nil, map[string]string{"X-OpenMaltForge": "1"}); r.StatusCode != 404 || !strings.Contains(string(b), "pas encore renseignée") {
		t.Errorf("adresse vide : %d %s", r.StatusCode, b)
	}
	config.DonURL = "https://ko-fi.com/exemple"
	if r, _ := do(t, "POST", ts.URL+"/api/don", nil, nil); r.StatusCode != 403 {
		t.Errorf("sans en-tête : %d", r.StatusCode)
	}
	if r, _ := do(t, "POST", ts.URL+"/api/don?url=https://autre.example", nil, map[string]string{"X-OpenMaltForge": "1"}); r.StatusCode != 204 {
		t.Errorf("ouverture : %d", r.StatusCode)
	}
	if len(opened) != 1 || opened[0] != "https://ko-fi.com/exemple" {
		t.Errorf("adresse ouverte : %v", opened)
	}
}
