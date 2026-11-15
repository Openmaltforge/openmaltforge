package db

// Schéma normalisé (structure 2) : chaque objet de l'état JSON est rangé dans des colonnes typées ;
// les champs non prévus (ou dont la valeur n'a pas le type de la colonne) vont dans la colonne « extra »
// (objet JSON), si bien que la conversion objet → ligne → objet ne perd rien.

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// Col : champ d'un objet JSON (Key) rangé dans une colonne SQL (Name), REAL (nombre) ou TEXT (texte).
type Col struct {
	Key, Name string
	Real      bool
}

// Spec : table d'objets (une ligne par objet, id = position dans la liste, à partir de 1).
type Spec struct {
	Key, Table string
	Cols       []Col
}

func t(k, n string) Col { return Col{k, n, false} }
func r(k, n string) Col { return Col{k, n, true} }
func rs(ks ...string) []Col {
	c := make([]Col, len(ks))
	for i, k := range ks {
		c[i] = r(k, k)
	}
	return c
}
func cat(cs ...[]Col) []Col {
	var o []Col
	for _, c := range cs {
		o = append(o, c...)
	}
	return o
}

var (
	maltArom   = rs("cereale", "biscuit", "malte", "caramel", "chocolat", "sucre", "fruits_secs", "cafe", "toaste", "raisin", "vanille", "miel", "acide", "amer", "fume")
	houblArom  = rs("citrus", "tropical_fruit", "stone_fruit", "berry", "floral", "grassy", "herbal", "spice", "resin_pin")
	levureArom = rs("fruits_tropicaux", "banane", "pomme_verte", "clou_girofle", "acide", "poivre", "alcoolise", "neutre", "pomme_rouge")
)

// Lists : référentiels et paramètres en listes (clé de l'état → table).
var Lists = []Spec{
	{"malts", "malt", cat([]Col{t("name", "nom"), t("maltier", "maltier")}, rs("ebc", "potentiel", "ppg", "b46"), maltArom, rs("prix_kg", "stock"))},
	{"hops", "houblon", cat([]Col{t("name", "nom")}, rs("alpha_min", "alpha_max"), houblArom, rs("prix_g", "stock"))},
	{"yeasts", "levure", cat([]Col{t("name", "nom"), t("labo", "labo")}, rs("att_min", "att_max", "floc_min", "floc_max", "t_min", "t_max"), levureArom, rs("prix_sachet", "stock"))},
	{"ings", "ingredients", []Col{t("name", "nom"), t("type", "type"), r("dose_g_L", "dose_g_l"), t("usage", "usage"), r("prix_g", "prix_g"), r("stock", "stock")}},
	{"conso", "consommables", []Col{t("name", "nom"), t("unite", "unite"), r("prix", "prix"), r("stock", "stock"), t("sys", "systeme")}},
	{"eaux", "eaux", cat([]Col{t("name", "nom"), t("type", "type")}, rs("cl", "so4", "ca", "mg", "na", "hco3", "prix_l", "stock"))},
	{"eau", "parametres_eau", []Col{t("name", "nom"), r("l", "litres")}},
	{"elec", "parametres_electricite", []Col{t("name", "nom"), r("w", "puissance_w"), r("min", "minutes"), t("auto", "auto")}},
	{"consl", "parametres_consommables", []Col{t("name", "nom")}},
	{"proc", "process", []Col{t("name", "nom"), t("ph", "phase"), t("type", "type"), r("l", "litres")}},
}

// RecipeCols : champs simples d'une recette (table recettes).
var RecipeCols = []Col{t("id", "ident"), t("name", "nom"), t("style", "style"), t("date", "date"), t("brasseur", "brasseur"),
	r("sucre", "sucre_g_l"), r("tcarbo", "temperature_carbo"), r("ogT", "di_cible"), r("ibuT", "ibu_cible"), r("glace", "glace_l"),
	t("embou", "date_embouteillage"), t("notes", "notes"), t("origine", "origine")}

// RecipeLists : listes d'une recette (une table de lignes chacune, rattachée à recettes par clé étrangère).
var RecipeLists = []Spec{
	{"malts", "recette_malts", []Col{t("n", "nom"), r("g", "grammes")}},
	{"hops", "recette_houblons", []Col{t("n", "nom"), r("g", "grammes"), t("use", "usage"), r("t", "minutes")}},
	{"yeasts", "recette_levures", []Col{t("n", "nom"), r("g", "grammes")}},
	{"ings", "recette_ingredients", []Col{t("n", "nom"), r("g", "grammes")}},
	{"conso", "recette_consommables", []Col{t("n", "nom"), r("g", "quantite")}},
	{"mash", "recette_paliers", []Col{t("k", "etape"), r("t", "temperature"), r("m", "minutes"), t("role", "role")}},
	{"water", "recette_eaux", []Col{t("n", "nom"), r("p", "pourcentage"), r("l", "litres")}},
}

// BiblioCols : entrée de bibliothèque (son champ « recipe » est une ligne de recettes).
var BiblioCols = []Col{t("id", "ident"), t("name", "nom"), t("style", "style"), t("date", "date"), r("vol", "volume_l"),
	t("brasseur", "brasseur"), r("imp", "importee")}

// HtmlCols : rendu HTML d'une recette de la bibliothèque.
var HtmlCols = []Col{t("id", "ident"), t("name", "nom"), t("date", "date"), t("code", "code")}

func colDDL(cs []Col) string {
	var b strings.Builder
	for _, c := range cs {
		ty := "TEXT"
		if c.Real {
			ty = "REAL"
		}
		b.WriteString(`,"` + c.Name + `" ` + ty)
	}
	return b.String()
}

// SchemaV2 : création des tables de la structure 2 (hors style, parametres, logos, polices, traductions, licence).
func SchemaV2() []string {
	var q []string
	for _, s := range Lists {
		q = append(q, `CREATE TABLE "`+s.Table+`"(id INTEGER PRIMARY KEY`+colDDL(s.Cols)+`,extra TEXT)`,
			`CREATE INDEX "`+s.Table+`_nom" ON "`+s.Table+`"(nom)`)
	}
	q = append(q, `CREATE TABLE "recettes"(id INTEGER PRIMARY KEY,en_cours INTEGER NOT NULL DEFAULT 0`+colDDL(RecipeCols)+`,listes TEXT,extra TEXT)`,
		`CREATE UNIQUE INDEX "recettes_en_cours" ON "recettes"(en_cours) WHERE en_cours = 1`)
	for _, s := range RecipeLists {
		q = append(q, `CREATE TABLE "`+s.Table+`"(recette_id INTEGER NOT NULL REFERENCES recettes(id) ON DELETE CASCADE,ordre INTEGER NOT NULL`+
			colDDL(s.Cols)+`,extra TEXT,PRIMARY KEY(recette_id,ordre))`)
		if s.Cols[0].Name == "nom" {
			q = append(q, `CREATE INDEX "`+s.Table+`_nom" ON "`+s.Table+`"(nom)`)
		}
	}
	q = append(q,
		`CREATE TABLE "bibliotheque"(id INTEGER PRIMARY KEY`+colDDL(BiblioCols)+`,recette_id INTEGER REFERENCES recettes(id) ON DELETE SET NULL,extra TEXT)`,
		`CREATE INDEX "bibliotheque_ident" ON "bibliotheque"(ident)`,
		`CREATE TABLE "html"(id INTEGER PRIMARY KEY,bibliotheque_id INTEGER REFERENCES bibliotheque(id) ON DELETE SET NULL`+colDDL(HtmlCols)+`,extra TEXT)`,
		`CREATE INDEX "html_bibliotheque" ON "html"(bibliotheque_id)`)
	return q
}

// --- objets JSON ordonnés ---

// Marshal encode en JSON sans échapper < > & (comme JSON.stringify).
func Marshal(v any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(b.Bytes(), []byte("\n")), nil
}

// KV : membre d'un objet JSON (ordre conservé).
type KV struct {
	K string
	V json.RawMessage
}

// Ordered décode un objet JSON en conservant l'ordre des clés (nil si absent ou null).
func Ordered(raw json.RawMessage) ([]KV, error) {
	tr := bytes.TrimSpace(raw)
	if len(tr) == 0 || string(tr) == "null" {
		return nil, nil
	}
	dec := json.NewDecoder(bytes.NewReader(tr))
	dec.UseNumber()
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	if tok != json.Delim('{') {
		return nil, fmt.Errorf("objet JSON attendu")
	}
	var out []KV
	for dec.More() {
		k, err := dec.Token()
		if err != nil {
			return nil, err
		}
		var v json.RawMessage
		if err := dec.Decode(&v); err != nil {
			return nil, err
		}
		out = append(out, KV{k.(string), v})
	}
	return out, nil
}

// columnValue : valeur SQL d'un champ si son type JSON correspond à la colonne (sinon ok = false → extra).
func columnValue(c Col, raw json.RawMessage) (any, bool) {
	tr := bytes.TrimSpace(raw)
	if len(tr) == 0 {
		return nil, false
	}
	switch {
	case c.Real && (tr[0] == '-' || (tr[0] >= '0' && tr[0] <= '9')):
		var f float64
		if json.Unmarshal(tr, &f) != nil {
			return nil, false
		}
		// le nombre doit se réécrire à l'identique (sinon : extra, pour ne rien perdre)
		if b, _ := Marshal(f); !bytes.Equal(b, tr) {
			return nil, false
		}
		return f, true
	case !c.Real && tr[0] == '"':
		var s string
		if json.Unmarshal(tr, &s) != nil {
			return nil, false
		}
		return s, true
	}
	return nil, false
}

// Split range un objet dans les colonnes cs ; les autres membres (ou de type inattendu) vont dans extra,
// sauf ceux de skip (traités à part, ex. listes d'une recette).
func Split(obj []KV, cs []Col, skip func(k string) bool) (vals []any, extra []KV) {
	vals = make([]any, len(cs))
	idx := map[string]int{}
	for i, c := range cs {
		idx[c.Key] = i
	}
	for _, m := range obj {
		if skip != nil && skip(m.K) {
			continue
		}
		if i, ok := idx[m.K]; ok && vals[i] == nil {
			if v, ok := columnValue(cs[i], m.V); ok {
				vals[i] = v
				continue
			}
		}
		extra = append(extra, m)
	}
	return vals, extra
}

// EncodeExtra : colonne extra (NULL si vide).
func EncodeExtra(extra []KV) any {
	if len(extra) == 0 {
		return nil
	}
	var b bytes.Buffer
	b.WriteByte('{')
	for i, m := range extra {
		if i > 0 {
			b.WriteByte(',')
		}
		k, _ := Marshal(m.K)
		b.Write(k)
		b.WriteByte(':')
		b.Write(m.V)
	}
	b.WriteByte('}')
	return b.String()
}

// ObjWriter écrit un objet JSON membre par membre.
type ObjWriter struct {
	B     *bytes.Buffer
	first bool
}

// Begin ouvre l'objet.
func (w *ObjWriter) Begin() { w.B.WriteByte('{'); w.first = true }

// End ferme l'objet.
func (w *ObjWriter) End() { w.B.WriteByte('}') }

// Raw ajoute un membre dont la valeur est du JSON brut.
func (w *ObjWriter) Raw(k string, v []byte) {
	if !w.first {
		w.B.WriteByte(',')
	}
	w.first = false
	kb, _ := Marshal(k)
	w.B.Write(kb)
	w.B.WriteByte(':')
	w.B.Write(v)
}

// Cols ajoute les colonnes non NULL.
func (w *ObjWriter) Cols(cs []Col, vals []any) error {
	for i, c := range cs {
		switch v := vals[i].(type) {
		case nil:
		case []byte:
			b, _ := Marshal(string(v))
			w.Raw(c.Key, b)
		default:
			b, err := Marshal(v)
			if err != nil {
				return err
			}
			w.Raw(c.Key, b)
		}
	}
	return nil
}

// Extra ajoute les membres de la colonne extra.
func (w *ObjWriter) Extra(extra sql.NullString) error {
	if !extra.Valid {
		return nil
	}
	ms, err := Ordered(json.RawMessage(extra.String))
	if err != nil {
		return fmt.Errorf("colonne extra : %w", err)
	}
	for _, m := range ms {
		w.Raw(m.K, m.V)
	}
	return nil
}

// ColNames : noms SQL des colonnes, entre guillemets, séparés par des virgules.
func ColNames(cs []Col) string {
	n := make([]string, len(cs))
	for i, c := range cs {
		n[i] = `"` + c.Name + `"`
	}
	return strings.Join(n, ",")
}

// Placeholders : « ?,?,… ».
func Placeholders(n int) string { return strings.TrimSuffix(strings.Repeat("?,", n), ",") }
