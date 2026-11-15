package db

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func open(t *testing.T) (*sql.DB, string) {
	t.Helper()
	p := filepath.Join(t.TempDir(), "b.sqlite")
	d, err := Open(p)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d, p
}

func tables(t *testing.T, d *sql.DB) []string {
	t.Helper()
	m, err := tableNames(d)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func exec(t *testing.T, d *sql.DB, q ...string) {
	t.Helper()
	for _, x := range q {
		if _, err := d.Exec(x); err != nil {
			t.Fatalf("%s : %v", x, err)
		}
	}
}

func TestNouvelleBase(t *testing.T) {
	d, _ := open(t)
	bk := t.TempDir()
	b, err := Migrate(d, bk)
	if err != nil {
		t.Fatal(err)
	}
	if b != "" {
		t.Errorf("pas de sauvegarde attendue pour une base neuve, obtenu %s", b)
	}
	if got := strings.Join(tables(t, d), ","); got != strings.Join(Tables, ",") {
		t.Errorf("tables :\n%s\nattendu :\n%s", got, strings.Join(Tables, ","))
	}
	if v, _ := SchemaVersion(d); v != Latest() {
		t.Errorf("structure %d, attendu %d", v, Latest())
	}
	// deuxième passage : rien à faire
	if b, err := Migrate(d, bk); err != nil || b != "" {
		t.Errorf("migration répétée : %q %v", b, err)
	}
}

func TestStyleColonnes(t *testing.T) {
	d, _ := open(t)
	if _, err := Migrate(d, ""); err != nil {
		t.Fatal(err)
	}
	r, err := d.Query(`SELECT name, type FROM pragma_table_info('style')`)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	var cols []string
	for r.Next() {
		var n, ty string
		r.Scan(&n, &ty)
		if n != "id" {
			want := "TEXT"
			if StyleColIsReal(n) {
				want = "REAL"
			}
			if ty != want {
				t.Errorf("colonne %s : type %s, attendu %s", n, ty, want)
			}
		}
		cols = append(cols, n)
	}
	if strings.Join(cols, ",") != "id,"+strings.Join(StyleCols, ",") {
		t.Errorf("colonnes de style : %v", cols)
	}
}

// Base 1.x / 2.x : tables malts, hops, params (k, v), recette (k, v), styles au format JSON.
func TestRepriseAncienneBase(t *testing.T) {
	d, _ := open(t)
	exec(t, d,
		`create table malts(id integer primary key,name text,d text)`,
		`insert into malts(name,d) values('Malt Ancien','{"name":"Malt Ancien","ebc":5}')`,
		`create table biblio(id integer primary key,name text,d text)`,
		`insert into biblio(name,d) values('Vieille recette','{"name":"Vieille recette"}')`,
		`create table params(k text primary key,v text)`,
		`insert into params values('vol','25'),('loss','2.5')`,
		`create table recette(k text primary key,v text)`,
		`insert into recette values('name','"Ancienne"')`,
		`create table styles(id integer primary key,name text,d text)`,
		`insert into styles(name,d) values('IPA','{"name":"IPA","ibu_min":40,"aroma":"houblon","inconnu":1}')`,
	)
	bk := t.TempDir()
	b, err := Migrate(d, bk)
	if err != nil {
		t.Fatal(err)
	}
	if b == "" {
		t.Fatal("sauvegarde avant migration attendue")
	}
	if _, err := os.Stat(b); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(filepath.Base(b), "avant_structure_1") {
		t.Errorf("nom de sauvegarde : %s", b)
	}
	got := strings.Join(tables(t, d), ",")
	want := strings.Join(append(append([]string{}, Tables...), ToFill), ",")
	sortedWant := strings.Split(want, ",")
	sort.Strings(sortedWant)
	if got != strings.Join(sortedWant, ",") {
		t.Errorf("tables après reprise :\n%s\nattendu :\n%s", got, strings.Join(sortedWant, ","))
	}
	// structure 2 : colonnes typées
	var nom string
	var ebc float64
	d.QueryRow(`select nom,ebc from malt`).Scan(&nom, &ebc)
	if nom != "Malt Ancien" || ebc != 5 {
		t.Errorf("malt repris : %s %v", nom, ebc)
	}
	var v string
	d.QueryRow(`select valeur from parametres where cle='loss'`).Scan(&v)
	if v != "2.5" {
		t.Errorf("params → parametres : %q", v)
	}
	d.QueryRow(`select nom from recettes where en_cours = 1`).Scan(&v)
	if v != "Ancienne" {
		t.Errorf("recette en cours (k,v) → recettes : %q", v)
	}
	d.QueryRow(`select nom from bibliotheque`).Scan(&v)
	if v != "Vieille recette" {
		t.Errorf("bibliothèque : %q", v)
	}
	var sn, ar string
	var ibu float64
	var fg sql.NullFloat64
	d.QueryRow(`select name,aroma,ibu_min,fg_min from style`).Scan(&sn, &ar, &ibu, &fg)
	if sn != "IPA" || ar != "houblon" || ibu != 40 || fg.Valid {
		t.Errorf("style JSON → colonnes : %s %s %v %v", sn, ar, ibu, fg)
	}
	// tables absentes de l'ancienne base (eaux, process…) : à remplir par le navigateur
	r, _ := d.Query(`select nom from ` + ToFill + ` order by nom`)
	var fill []string
	for r.Next() {
		var n string
		r.Scan(&n)
		fill = append(fill, n)
	}
	r.Close()
	if !strings.Contains(strings.Join(fill, ","), "eaux") || strings.Contains(strings.Join(fill, ","), "malt,") {
		t.Errorf("tables à remplir : %v", fill)
	}
}

// Base 3.x au format JSON pour les styles (table style nom / donnees).
func TestRepriseStyleJSON(t *testing.T) {
	d, _ := open(t)
	exec(t, d, `create table style(id integer primary key,nom text,donnees text)`,
		`insert into style(nom,donnees) values('Stout','{"name":"Stout","og_max":1.07}')`)
	if _, err := Migrate(d, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	var n string
	var og float64
	if err := d.QueryRow(`select name,og_max from style`).Scan(&n, &og); err != nil || n != "Stout" || og != 1.07 {
		t.Errorf("style : %s %v %v", n, og, err)
	}
}

func TestBaseTropRecente(t *testing.T) {
	d, _ := open(t)
	exec(t, d, `create table malt(id integer primary key,nom text,donnees text)`, `pragma user_version = 99`)
	_, err := Migrate(d, t.TempDir())
	if !errors.Is(err, ErrTropRecente) {
		t.Fatalf("erreur attendue ErrTropRecente, obtenu %v", err)
	}
}

func TestPasUneBaseOpenMaltForge(t *testing.T) {
	d, _ := open(t)
	exec(t, d, `create table clients(id integer primary key)`)
	if _, err := Migrate(d, t.TempDir()); !errors.Is(err, ErrPasOpenMaltForge) {
		t.Fatalf("erreur attendue ErrPasOpenMaltForge, obtenu %v", err)
	}
}

func TestIsSQLite(t *testing.T) {
	if IsSQLite([]byte("ceci n est pas une base")) {
		t.Error("texte reconnu comme SQLite")
	}
	_, p := open(t)
	b, _ := os.ReadFile(p)
	if len(b) > 0 && !IsSQLite(b) {
		t.Error("fichier SQLite non reconnu")
	}
}

func TestURIPath(t *testing.T) {
	for in, want := range map[string]string{
		"/home/a b/x.sqlite":     "/home/a b/x.sqlite",
		"/tmp/50%?#.sqlite":      "/tmp/50%25%3f%23.sqlite",
		`C:\Users\Fred\b.sqlite`: "///C:/Users/Fred/b.sqlite",
	} {
		got := uriPath(in)
		if filepath.Separator == '/' && strings.HasPrefix(in, "C:") {
			continue // les antislashs ne sont convertis que sous Windows
		}
		if got != want {
			t.Errorf("uriPath(%q) = %q, attendu %q", in, got, want)
		}
	}
}

// Bases 3.1 à 3.54 : table style en colonnes, sans les rubriques d'eau ; la structure 2 les ajoute.
func TestStyleIncomplet(t *testing.T) {
	d, _ := open(t)
	exec(t, d, `create table style(id integer primary key,"name" text,"overall_impression" text,"ibu_min" real)`,
		`insert into style(name,overall_impression,ibu_min) values('IPA','x',40)`)
	if _, err := Migrate(d, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	cols := map[string]bool{}
	r, _ := d.Query(`SELECT name FROM pragma_table_info('style')`)
	for r.Next() {
		var n string
		r.Scan(&n)
		cols[n] = true
	}
	r.Close()
	for _, c := range StyleCols {
		if !cols[c] {
			t.Errorf("colonne %s absente", c)
		}
	}
	tx, _ := d.Begin()
	defer tx.Rollback()
	if err := InsertStyles(tx, []map[string]any{{"name": "Stout", "ca_min": 50.0}}); err != nil {
		t.Errorf("écriture d'un style : %v", err)
	}
}

// Base en structure 2 (BrewCraft 4.2.0 à 4.4.0) : la table eaux reçoit prix_l et stock ; une valeur déjà saisie
// (gardée dans extra) passe dans sa colonne.
func TestEauxStructure2(t *testing.T) {
	d, _ := open(t)
	exec(t, d, `create table eaux(id integer primary key,nom text,type text,cl real,so4 real,ca real,mg real,na real,hco3 real,extra text)`,
		`insert into eaux(id,nom,type,extra) values(1,'Vittel','minérale','{"prix_l":0.45,"stock":12,"note":"x"}')`,
		`pragma user_version = 2`)
	if _, err := Migrate(d, ""); err != nil {
		t.Fatal(err)
	}
	var p, st float64
	var ex string
	if err := d.QueryRow(`select prix_l,stock,extra from eaux`).Scan(&p, &st, &ex); err != nil || p != 0.45 || st != 12 || ex != `{"note":"x"}` {
		t.Errorf("eaux : %v %v %q %v", p, st, ex, err)
	}
}
