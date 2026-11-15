package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// migration : une étape de structure, appliquée dans une transaction.
type migration struct {
	version int
	name    string
	run     func(tx *sql.Tx) error
}

// migrations, dans l'ordre. Ne jamais modifier une migration publiée : en ajouter une nouvelle.
var migrations = []migration{
	{1, "reprise des tables de BrewCraft 3.x", reprise3x},
	{2, "normalisation : colonnes typées, recettes et lignes de recette", normalisation},
	{3, "eaux : prix au litre et stock (eaux minérales)", eauxStock},
}

// Tables : tables de la structure actuelle (2), par ordre alphabétique (liste vérifiée par les tests).
var Tables = []string{
	"bibliotheque", "consommables", "eaux", "houblon", "html", "ingredients", "levure", "licence", "logos",
	"malt", "parametres", "parametres_consommables", "parametres_eau", "parametres_electricite", "polices",
	"process", "recette_consommables", "recette_eaux", "recette_houblons", "recette_ingredients", "recette_levures",
	"recette_malts", "recette_paliers", "recettes", "style", "traductions",
}

// TablesV1 : les 19 tables de BrewCraft 3.128 (structure 1).
var TablesV1 = []string{
	"bibliotheque", "consommables", "eaux", "houblon", "html", "ingredients", "levure", "licence", "logos",
	"malt", "parametres", "parametres_consommables", "parametres_eau", "parametres_electricite", "polices",
	"process", "recette", "style", "traductions",
}

// DataTables : tables « une ligne = un objet JSON » (nom, donnees), au format de BrewCraft 3.x.
var DataTables = []string{
	"malt", "houblon", "levure", "eaux", "ingredients", "consommables", "parametres_eau",
	"parametres_electricite", "parametres_consommables", "process", "bibliotheque", "html",
}

// legacyNames : anciens noms (versions 1.x–2.x, colonnes name / d) des tables actuelles.
var legacyNames = map[string]string{
	"malt": "malts", "houblon": "hops", "levure": "yeasts", "style": "styles", "ingredients": "ings",
	"consommables": "conso", "parametres_eau": "eau", "parametres_electricite": "elec",
	"parametres_consommables": "consl", "bibliotheque": "biblio",
}

// ToFill : table temporaire listant les tables créées vides par la reprise d'une ancienne base,
// à remplir par les données de départ ; supprimée à la première sauvegarde.
const ToFill = "a_remplir"

// StyleCols : colonnes de la table style (une colonne par rubrique BJCP) ; _min/_max en REAL.
var StyleCols = []string{
	"name", "overall_impression", "appearance", "aroma", "flavor", "mouthfeel", "comments", "history",
	"characteristic_ingredients", "style_comparison", "ibu_min", "ibu_max", "srm_min", "srm_max", "og_min",
	"og_max", "fg_min", "fg_max", "abv_min", "abv_max", "commercial_examples", "ca_min", "ca_max", "mg_min",
	"mg_max", "na_min", "na_max", "cl_min", "cl_max", "so4_min", "so4_max", "hco3_min", "hco3_max",
	"so4cl_min", "so4cl_max",
}

// StyleColIsReal : colonne numérique de la table style.
func StyleColIsReal(c string) bool {
	return strings.HasSuffix(c, "_min") || strings.HasSuffix(c, "_max")
}

func styleDDL(name string) string {
	var b strings.Builder
	b.WriteString(`CREATE TABLE "` + name + `"(id INTEGER PRIMARY KEY`)
	for _, c := range StyleCols {
		t := "TEXT"
		if StyleColIsReal(c) {
			t = "REAL"
		}
		b.WriteString(`,"` + c + `" ` + t)
	}
	b.WriteString(")")
	return b.String()
}

func columns(tx *sql.Tx, table string) (map[string]bool, error) {
	r, err := tx.Query(`SELECT name FROM pragma_table_info(?)`, table)
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

// reprise3x (structure 1) : crée les 19 tables de BrewCraft 3.128 et convertit les bases plus anciennes,
// comme le faisait fromDb() dans le navigateur :
//   - anciennes tables malts, hops… (colonnes name, d) → malt, houblon… (nom, donnees) ;
//   - params / recette (k, v) → parametres / recette (cle, valeur) ;
//   - table style au format JSON (nom, donnees) → une colonne par rubrique BJCP.
func reprise3x(tx *sql.Tx) error {
	tn, err := tableNames(tx)
	if err != nil {
		return err
	}
	existing := len(tn) > 0
	exec := func(q string, a ...any) {
		if err == nil {
			_, err = tx.Exec(q, a...)
		}
	}
	// 1. Tables « nom / donnees » et leurs anciens noms. Une table absente d'une base existante est
	// notée dans ToFill : le navigateur la remplit avec les données de départ, comme le faisait 3.x
	// quand fromDb() ne la trouvait pas.
	var created []string
	for _, t := range DataTables {
		old, ok := legacyNames[t]
		if !tn[t] && ok && tn[old] {
			exec(`CREATE TABLE "` + t + `"(id INTEGER PRIMARY KEY,nom TEXT,donnees TEXT)`)
			exec(`INSERT INTO "` + t + `"(nom,donnees) SELECT coalesce(name,''),d FROM "` + old + `" ORDER BY rowid`)
			exec(`DROP TABLE "` + old + `"`)
			tn[t] = true
		}
		if !tn[t] {
			exec(`CREATE TABLE "` + t + `"(id INTEGER PRIMARY KEY,nom TEXT,donnees TEXT)`)
			created = append(created, t)
		}
	}
	if existing && len(created) > 0 {
		exec(`CREATE TABLE "` + ToFill + `"(nom TEXT PRIMARY KEY)`)
		for _, t := range created {
			exec(`INSERT INTO "`+ToFill+`" VALUES(?)`, t)
		}
	}
	if err != nil {
		return err
	}
	// 2. Paramètres et recette en cours : (k, v) → (cle, valeur).
	if !tn["parametres"] && tn["params"] {
		exec(`CREATE TABLE "parametres"(cle TEXT PRIMARY KEY,valeur TEXT)`)
		exec(`INSERT OR REPLACE INTO "parametres" SELECT k,v FROM "params" ORDER BY rowid`)
		exec(`DROP TABLE "params"`)
	}
	exec(`CREATE TABLE IF NOT EXISTS "parametres"(cle TEXT PRIMARY KEY,valeur TEXT)`)
	if tn["recette"] {
		cols, e := columns(tx, "recette")
		if e != nil {
			return e
		}
		if cols["k"] && !cols["cle"] {
			exec(`ALTER TABLE "recette" RENAME TO "recette_ancienne"`)
			exec(`CREATE TABLE "recette"(cle TEXT PRIMARY KEY,valeur TEXT)`)
			exec(`INSERT OR REPLACE INTO "recette" SELECT k,v FROM "recette_ancienne" ORDER BY rowid`)
			exec(`DROP TABLE "recette_ancienne"`)
		}
	}
	exec(`CREATE TABLE IF NOT EXISTS "recette"(cle TEXT PRIMARY KEY,valeur TEXT)`)
	if err != nil {
		return err
	}
	// 3. Styles : format JSON (ancien) → colonnes.
	if err := repriseStyles(tx, tn); err != nil {
		return err
	}
	// 4. Autres tables.
	exec(`CREATE TABLE IF NOT EXISTS "logos"(id INTEGER PRIMARY KEY,nom TEXT,format TEXT,donnees TEXT,actif INTEGER)`)
	exec(`CREATE TABLE IF NOT EXISTS "polices"(nom TEXT PRIMARY KEY,format TEXT,donnees TEXT,integree INTEGER)`)
	exec(`CREATE TABLE IF NOT EXISTS "traductions"(cle TEXT PRIMARY KEY,fr TEXT,en TEXT,es TEXT,it TEXT,pt TEXT)`)
	exec(`CREATE TABLE IF NOT EXISTS "licence"(nom TEXT PRIMARY KEY,texte TEXT)`)
	return err
}

func repriseStyles(tx *sql.Tx, tn map[string]bool) error {
	src := ""
	if tn["style"] {
		cols, err := columns(tx, "style")
		if err != nil {
			return err
		}
		if cols["overall_impression"] {
			return nil // déjà au format colonnes
		}
		if !cols["donnees"] {
			return fmt.Errorf("table style de format inconnu")
		}
		if _, err := tx.Exec(`ALTER TABLE "style" RENAME TO "style_ancienne"`); err != nil {
			return err
		}
		src = `SELECT donnees FROM "style_ancienne" ORDER BY rowid`
	} else if tn["styles"] {
		src = `SELECT d FROM "styles" ORDER BY rowid`
	}
	if _, err := tx.Exec(styleDDL("style")); err != nil {
		return err
	}
	if src == "" {
		return nil
	}
	r, err := tx.Query(src)
	if err != nil {
		return err
	}
	var objs []map[string]any
	for r.Next() {
		var s sql.NullString
		if err := r.Scan(&s); err != nil {
			r.Close()
			return err
		}
		o := map[string]any{}
		if s.Valid {
			_ = json.Unmarshal([]byte(s.String), &o)
		}
		objs = append(objs, o)
	}
	r.Close()
	if err := r.Err(); err != nil {
		return err
	}
	if err := InsertStyles(tx, objs); err != nil {
		return err
	}
	if tn["style"] {
		_, err = tx.Exec(`DROP TABLE "style_ancienne"`)
	} else {
		_, err = tx.Exec(`DROP TABLE "styles"`)
	}
	return err
}

// JSNumber : nombre JSON tel que sql.js le liait (entier si la valeur est entière), pour qu'une colonne
// TEXT reçoive « 42 » et non « 42.0 ».
func JSNumber(v float64) any {
	if v == math.Trunc(v) && math.Abs(v) < 1<<53 {
		return int64(v)
	}
	return v
}

// InsertStyles écrit des styles (objets JSON décodés) dans la table style, comme buildDb() :
// valeur absente ou chaîne vide → NULL.
func InsertStyles(tx *sql.Tx, objs []map[string]any) error {
	q := `INSERT INTO "style"("` + strings.Join(StyleCols, `","`) + `") VALUES(?` + strings.Repeat(",?", len(StyleCols)-1) + `)`
	st, err := tx.Prepare(q)
	if err != nil {
		return err
	}
	defer st.Close()
	for _, o := range objs {
		a := make([]any, len(StyleCols))
		for i, c := range StyleCols {
			v, ok := o[c]
			if !ok || v == nil || v == "" {
				continue
			}
			switch x := v.(type) {
			case float64:
				a[i] = JSNumber(x)
			case string, bool:
				a[i] = x
			default:
				b, _ := json.Marshal(x)
				a[i] = string(b)
			}
		}
		if _, err := st.Exec(a...); err != nil {
			return err
		}
	}
	return nil
}

// normalisation (structure 2) : les objets JSON des tables « nom / donnees » passent en colonnes typées
// (champs non prévus dans extra) ; la recette en cours (table recette clé / valeur) et les recettes de la
// bibliothèque vont dans recettes + tables de lignes ; le HTML est relié à son entrée de bibliothèque.
func normalisation(tx *sql.Tx) error {
	old := append([]string{"bibliotheque", "html", "recette"}, func() []string {
		var n []string
		for _, s := range Lists {
			n = append(n, s.Table)
		}
		return n
	}()...)
	for _, t := range old {
		if _, err := tx.Exec(`ALTER TABLE "` + t + `" RENAME TO "` + t + `_v1"`); err != nil {
			return fmt.Errorf("%s : %w", t, err)
		}
	}
	for _, q := range SchemaV2() {
		if _, err := tx.Exec(q); err != nil {
			return fmt.Errorf("%s : %w", q, err)
		}
	}
	rawRows := func(t string) ([]json.RawMessage, error) {
		r, err := tx.Query(`SELECT donnees FROM "` + t + `_v1" ORDER BY id`)
		if err != nil {
			return nil, err
		}
		defer r.Close()
		var out []json.RawMessage
		for r.Next() {
			var s sql.NullString
			if err := r.Scan(&s); err != nil {
				return nil, err
			}
			if !s.Valid || !json.Valid([]byte(s.String)) {
				return nil, fmt.Errorf("table %s, ligne %d : données JSON invalides", t, len(out)+1)
			}
			out = append(out, json.RawMessage(s.String))
		}
		return out, r.Err()
	}
	for _, s := range Lists {
		rows, err := rawRows(s.Table)
		if err != nil {
			return err
		}
		for i, raw := range rows {
			if err := UpsertList(tx, s, i+1, raw); err != nil {
				return err
			}
		}
	}
	// recette en cours : table recette (cle, valeur JSON) → un objet
	{
		r, err := tx.Query(`SELECT cle,valeur FROM "recette_v1" ORDER BY rowid`)
		if err != nil {
			return err
		}
		var kvs []KV
		for r.Next() {
			var k string
			var v sql.NullString
			if err := r.Scan(&k, &v); err != nil {
				r.Close()
				return err
			}
			if !v.Valid || !json.Valid([]byte(v.String)) {
				r.Close()
				return fmt.Errorf("recette en cours, %s : valeur JSON invalide", k)
			}
			kvs = append(kvs, KV{k, json.RawMessage(v.String)})
		}
		r.Close()
		if len(kvs) > 0 {
			if _, err := InsertRecipe(tx, json.RawMessage(EncodeExtra(kvs).(string)), true); err != nil {
				return err
			}
		}
	}
	for _, t := range []string{"bibliotheque", "html"} {
		rows, err := rawRows(t)
		if err != nil {
			return err
		}
		for i, raw := range rows {
			if t == "bibliotheque" {
				err = UpsertBiblio(tx, i+1, raw)
			} else {
				err = UpsertHtml(tx, i+1, raw)
			}
			if err != nil {
				return err
			}
		}
	}
	for _, t := range old {
		if _, err := tx.Exec(`DROP TABLE "` + t + `_v1"`); err != nil {
			return err
		}
	}
	// table style des bases 3.1 à 3.54 : rubriques ajoutées ensuite (profils d'eau, ratio SO4/Cl) absentes ;
	// la structure 1 ne les créait pas et la sauvegarde échouait (corrigé ici).
	cols, err := columns(tx, "style")
	if err != nil {
		return err
	}
	for _, c := range StyleCols {
		if !cols[c] {
			ty := "TEXT"
			if StyleColIsReal(c) {
				ty = "REAL"
			}
			if _, err := tx.Exec(`ALTER TABLE "style" ADD COLUMN "` + c + `" ` + ty); err != nil {
				return err
			}
		}
	}
	return nil
}

// eauxStock (structure 3) : prix au litre et stock des eaux (eaux minérales achetées). Les valeurs déjà saisies
// (gardées dans extra par la structure 2) passent dans les nouvelles colonnes.
//
// Idempotente : la migration 2 crée ses tables d'après le schéma courant (db.Lists), qui a déjà ces colonnes ;
// seules les bases passées en structure 2 avec BrewCraft 4.2.0 à 4.4.0 ne les ont pas.
func eauxStock(tx *sql.Tx) error {
	cols, err := columns(tx, "eaux")
	if err != nil {
		return err
	}
	for _, c := range []string{"prix_l", "stock"} {
		if cols[c] {
			continue
		}
		if _, err := tx.Exec(`ALTER TABLE "eaux" ADD COLUMN "` + c + `" REAL`); err != nil {
			return err
		}
	}
	r, err := tx.Query(`SELECT id,extra FROM "eaux" WHERE extra IS NOT NULL`)
	if err != nil {
		return err
	}
	type row struct {
		id    int
		extra string
	}
	var rows []row
	for r.Next() {
		var x row
		if err := r.Scan(&x.id, &x.extra); err != nil {
			r.Close()
			return err
		}
		rows = append(rows, x)
	}
	r.Close()
	sp := Lists[0]
	for _, s := range Lists {
		if s.Table == "eaux" {
			sp = s
		}
	}
	for _, x := range rows {
		obj, err := Ordered(json.RawMessage(x.extra))
		if err != nil {
			return err
		}
		vals, extra := Split(obj, sp.Cols, nil)
		set, args := []string{}, []any{}
		for i, c := range sp.Cols {
			if (c.Name == "prix_l" || c.Name == "stock") && vals[i] != nil {
				set = append(set, `"`+c.Name+`"=?`)
				args = append(args, vals[i])
			}
		}
		if len(set) == 0 {
			continue
		}
		args = append(args, EncodeExtra(extra), x.id)
		if _, err := tx.Exec(`UPDATE "eaux" SET `+strings.Join(set, ",")+`,extra=? WHERE id=?`, args...); err != nil {
			return err
		}
	}
	return nil
}
