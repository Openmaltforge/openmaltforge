package store

import (
	"database/sql"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"openmaltforge/internal/db"
)

func newDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "b.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if _, err := db.Migrate(d, ""); err != nil {
		t.Fatal(err)
	}
	return d
}

// état de référence : couvre chaque type de table et les clés « spéciales » de kv.equip.
const sample = `{"malts":[{"name":"Pilsen","maltier":"Dingemans","ebc":3.5,"potentiel":308,"prix_kg":1.9e0},{"name":"","ebc":0}],` +
	`"hops":[{"name":"Citra","alpha_min":11,"alpha_max":13}],"yeasts":[{"name":42,"labo":"x"}],` +
	`"styles":[{"name":"21A American IPA","overall_impression":"Houblonnée","ibu_min":40,"ibu_max":70,"og_min":"","aroma":"agrumes"}],` +
	`"ings":[],"conso":[{"name":"Capsules","prix":0.02}],"eaux":[{"name":"Épernay","ca":90}],"eau":[],"elec":[{"name":"init","w":3000}],` +
	`"consl":[],"proc":[{"name":"p","l":2.5}],"biblio":[{"id":"r1","name":"IPA","recipe":{"malts":[{"n":"Pilsen","g":6000}]}}],"html":[{"name":"IPA","h":"<b>x</b>"}],` +
	`"kv":{"equip":{"vol":30,"name":"BrewMonk B50","coef":{"Ébullition":1},"logo":"data:image/png;base64,AAAA","logon":"Mon logo",` +
	`"fonts":[{"n":"Inter","d":"data:font/ttf;base64,BBBB","b":1},{"n":"Perso","d":"data:font/woff2;base64,CCCC"},{"n":"","d":"x"}],"autoMin":5},` +
	`"recipe":{"name":"IPA","malts":[{"n":"Pilsen","g":6000}]}},` +
	`"i18n":{"Bibliothèque":["Library","Biblioteca","Libreria","Biblioteca"]},"licence":{"nom":"GNU GPL v3","texte":"…"}}`

func TestVide(t *testing.T) {
	d := newDB(t)
	b, err := Load(d)
	if err != nil || string(b) != Empty {
		t.Fatalf("base vide : %s %v", b, err)
	}
}

func TestAllerRetour(t *testing.T) {
	d := newDB(t)
	if err := Save(d, []byte(sample)); err != nil {
		t.Fatal(err)
	}
	b, err := Load(d)
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("JSON produit invalide : %v\n%s", err, b)
	}
	// les objets des tables sont conservés à l'identique (nombres compris, ex. 1.9e0)
	if !strings.Contains(string(b), `"prix_kg":1.9e0`) {
		t.Error("objet JSON modifié (nombres reformatés)")
	}
	eq := func(path string, a, b any) {
		ja, _ := json.Marshal(a)
		jb, _ := json.Marshal(b)
		if string(ja) != string(jb) {
			t.Errorf("%s : %s, attendu %s", path, ja, jb)
		}
	}
	var want map[string]any
	json.Unmarshal([]byte(sample), &want)
	for _, k := range Keys {
		if k == "styles" {
			continue
		}
		eq(k, got[k], want[k])
	}
	// styles : une colonne par rubrique ; valeur absente ou vide → ''
	st := got["styles"].([]any)[0].(map[string]any)
	if st["name"] != "21A American IPA" || st["ibu_min"] != 40.0 || st["og_min"] != "" || st["fg_max"] != "" || len(st) != len(db.StyleCols) {
		t.Errorf("style relu : %v", st)
	}
	eq("kv.recipe", got["kv"].(map[string]any)["recipe"], want["kv"].(map[string]any)["recipe"])
	eq("i18n", got["i18n"], want["i18n"])
	eq("licence", got["licence"], want["licence"])
	e := got["kv"].(map[string]any)["equip"].(map[string]any)
	if e["logo"] != "data:image/png;base64,AAAA" || e["logon"] != "Mon logo" {
		t.Errorf("logo : %v %v", e["logo"], e["logon"])
	}
	eq("fonts", e["fonts"], []any{
		map[string]any{"n": "Inter", "d": "data:font/ttf;base64,BBBB", "b": 1},
		map[string]any{"n": "Perso", "d": "data:font/woff2;base64,CCCC"},
	})
	// polices et logo dans leurs tables, pas dans parametres ; ordre des clés conservé
	var n int
	d.QueryRow(`select count(*) from parametres where cle in ('fonts','logo','logon')`).Scan(&n)
	if n != 0 {
		t.Error("polices / logo écrits dans parametres")
	}
	var f string
	d.QueryRow(`select format from polices where nom='Perso'`).Scan(&f)
	if f != "woff2" {
		t.Errorf("format de police : %q", f)
	}
	if i := strings.Index(string(b), `"vol"`); i < 0 || i > strings.Index(string(b), `"autoMin"`) {
		t.Error("ordre des clés de kv.equip non conservé")
	}
	// nom qui n'est pas un texte : colonne nom vide, valeur gardée telle quelle dans extra
	var nom, extra sql.NullString
	d.QueryRow(`select nom,extra from levure`).Scan(&nom, &extra)
	if nom.Valid || extra.String != `{"name":42}` {
		t.Errorf("nom numérique : %v %v", nom, extra)
	}
	// deuxième aller-retour : identique octet pour octet
	if err := Save(d, b); err != nil {
		t.Fatal(err)
	}
	b2, _ := Load(d)
	if string(b2) != string(b) {
		t.Error("le second aller-retour modifie l'état")
	}
}

func TestEtatInvalide(t *testing.T) {
	d := newDB(t)
	Save(d, []byte(sample))
	for _, bad := range []string{`pas du json`, `{}`, `{"kv":{"equip":[1]}}`, `{"kv":{},"malts":{"x":1}}`} {
		if err := Save(d, []byte(bad)); err == nil {
			t.Errorf("état accepté : %s", bad)
		}
	}
	// rien n'a été effacé par les tentatives refusées
	var n int
	d.QueryRow(`select count(*) from malt`).Scan(&n)
	if n != 2 {
		t.Errorf("données perdues après un état refusé : %d malts", n)
	}
}

// Une table créée vide par la reprise d'une ancienne base est absente de l'état (le navigateur la remplit) ;
// la marque disparaît à la première sauvegarde.
func TestTablesARemplir(t *testing.T) {
	d, err := db.Open(filepath.Join(t.TempDir(), "old.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	d.Exec(`create table malts(id integer primary key,name text,d text)`)
	d.Exec(`insert into malts(name,d) values('M','{"name":"M"}')`)
	if _, err := db.Migrate(d, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	b, _ := Load(d)
	var o map[string]any
	json.Unmarshal(b, &o)
	if _, ok := o["eaux"]; ok {
		t.Error("table eaux créée vide : elle ne doit pas figurer dans l'état")
	}
	if _, ok := o["malts"]; !ok {
		t.Error("table malts manquante")
	}
	o["eaux"] = []any{map[string]any{"name": "Épernay"}}
	nb, _ := json.Marshal(o)
	if err := Save(d, nb); err != nil {
		t.Fatal(err)
	}
	var n int
	d.QueryRow(`select count(*) from sqlite_master where name=?`, db.ToFill).Scan(&n)
	if n != 0 {
		t.Error("table a_remplir non supprimée après sauvegarde")
	}
}

// recette de bibliothèque : en-tête dans recettes, listes dans les tables de lignes, HTML relié ;
// champs inconnus et valeurs de type inattendu conservés (extra).
const etatRecettes = `{"biblio":[{"id":"r1","name":"IPA","style":"21A","date":"2026-11-01","vol":30,"brasseur":"Moi","est":{"og":1.06},` +
	`"recipe":{"id":"r1","name":"IPA","sucre":7,"malts":[{"n":"Pilsen","g":6000},{"n":"Munich","g":""}],` +
	`"hops":[{"n":"Citra","g":30,"use":"Ébullition","t":60,"futur":true}],"mash":[{"k":"Empâtage","t":66,"m":60,"role":"pal"}],` +
	`"water":[{"n":"Épernay","p":100}],"stk":[["malts","Pilsen",6]],"etq":{"fmt":"bandeauxl"},"conso":[]}},` +
	`{"id":"r2","name":"Stout","recipe":{"name":"Stout"}}],` +
	`"html":[{"id":"r1","name":"IPA","date":"2026-11-01","code":"<h1>IPA & co</h1>"},{"id":"zz","name":"orphelin","code":""}],` +
	`"kv":{"equip":{"vol":30},"recipe":{"name":"En cours","malts":[{"n":"Pilsen","g":5000}],"ogT":1.055}}}`

func TestRecettesNormalisees(t *testing.T) {
	d := newDB(t)
	if err := Save(d, []byte(etatRecettes)); err != nil {
		t.Fatal(err)
	}
	b, err := Load(d)
	if err != nil {
		t.Fatal(err)
	}
	var got, want map[string]any
	json.Unmarshal(b, &got)
	json.Unmarshal([]byte(etatRecettes), &want)
	for _, k := range []string{"biblio", "html", "kv"} {
		g, _ := json.Marshal(got[k])
		w, _ := json.Marshal(want[k])
		if string(g) != string(w) {
			t.Errorf("%s :\n%s\nattendu :\n%s", k, g, w)
		}
	}
	q := func(sql string) (n int) {
		if err := d.QueryRow(sql).Scan(&n); err != nil {
			t.Fatalf("%s : %v", sql, err)
		}
		return
	}
	if q(`select count(*) from recettes`) != 3 || q(`select count(*) from recettes where en_cours = 1`) != 1 {
		t.Error("recettes : 2 de bibliothèque + 1 en cours attendues")
	}
	if q(`select count(*) from recette_malts m join bibliotheque b on b.recette_id = m.recette_id where b.ident = 'r1'`) != 2 {
		t.Error("lignes de malts de r1")
	}
	if q(`select count(*) from recette_malts where grammes is null and extra = '{"g":""}'`) != 1 {
		t.Error("quantité vide gardée dans extra")
	}
	if q(`select count(*) from recette_houblons where minutes = 60 and usage = 'Ébullition' and extra = '{"futur":true}'`) != 1 {
		t.Error("houblon : colonnes typées + champ inconnu dans extra")
	}
	if q(`select count(*) from html h join bibliotheque b on b.id = h.bibliotheque_id where b.ident = 'r1'`) != 1 ||
		q(`select count(*) from html where ident = 'zz' and bibliotheque_id is null`) != 1 {
		t.Error("HTML relié à sa recette (et orphelin sans lien)")
	}
	// suppression d'une recette de la bibliothèque : ses lignes partent avec elle (clé étrangère en cascade)
	var o map[string]json.RawMessage
	json.Unmarshal([]byte(etatRecettes), &o)
	o["biblio"] = json.RawMessage(`[{"id":"r2","name":"Stout","recipe":{"name":"Stout"}}]`)
	nb, _ := json.Marshal(o)
	if err := Save(d, nb); err != nil {
		t.Fatal(err)
	}
	if q(`select count(*) from recettes`) != 2 || q(`select count(*) from recette_houblons`) != 0 || q(`select count(*) from recette_malts`) != 1 {
		t.Error("lignes de la recette supprimée encore présentes")
	}
	if q(`select count(*) from pragma_foreign_key_check`) != 0 {
		t.Error("clés étrangères incohérentes")
	}
}

// Écriture différentielle : une ligne non modifiée n'est pas réécrite.
func TestEcritureDifferentielle(t *testing.T) {
	d := newDB(t)
	st := New(d)
	if err := st.Save([]byte(sample)); err != nil {
		t.Fatal(err)
	}
	// modification « dans le dos » du serveur : elle doit survivre si la ligne n'est pas réécrite
	d.Exec(`update malt set maltier = 'TÉMOIN' where id = 1`)
	d.Exec(`update polices set format = 'témoin'`)
	var o map[string]json.RawMessage
	json.Unmarshal([]byte(sample), &o)
	o["malts"] = json.RawMessage(`[{"name":"Pilsen","maltier":"Dingemans","ebc":3.5,"potentiel":308,"prix_kg":1.9e0},{"name":"Nouveau","ebc":1}]`)
	nb, _ := json.Marshal(o)
	if err := st.Save(nb); err != nil {
		t.Fatal(err)
	}
	var m1, m2, f string
	d.QueryRow(`select maltier from malt where id = 1`).Scan(&m1)
	d.QueryRow(`select nom from malt where id = 2`).Scan(&m2)
	d.QueryRow(`select format from polices limit 1`).Scan(&f)
	if m1 != "TÉMOIN" || m2 != "Nouveau" || f != "témoin" {
		t.Errorf("écriture différentielle : ligne 1 %q (non réécrite attendue), ligne 2 %q, polices %q", m1, m2, f)
	}
}
