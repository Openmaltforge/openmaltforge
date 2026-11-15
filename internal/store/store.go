// Package store convertit la base SQLite en « état » JSON de l'application et inversement.
//
// L'état a la forme de l'objet S du navigateur (js/app.js) :
//
//	{ "malts": [ {…}, … ], …, "styles": [ {…} ], "biblio": [ {…, "recipe": {…}} ], "html": [ … ],
//	  "kv": { "equip": {…}, "recipe": {…} }, "i18n": { "clé": ["en","es","it","pt"] }, "licence": { … } }
//
// Depuis la structure 2, les objets sont rangés en colonnes typées (package db, schema.go) ; les champs non
// prévus sont gardés dans la colonne extra : l'état relu est identique à l'état écrit (à l'ordre des clés près).
//
// Écriture différentielle : Store garde l'empreinte de chaque ligne écrite ; à la sauvegarde suivante,
// seules les lignes (ou sections) modifiées sont réécrites.
package store

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"openmaltforge/internal/db"
)

// Keys : clés de l'état (navigateur), même ordre que TABLES dans js/app.js.
var Keys = []string{"malts", "hops", "yeasts", "styles", "ings", "conso", "eaux", "eau", "elec", "consl", "proc", "biblio", "html"}

// table de chaque clé de liste (pour les tables « à remplir » d'une base reprise)
var keyTable = map[string]string{"styles": "style", "biblio": "bibliotheque", "html": "html"}

func init() {
	for _, s := range db.Lists {
		keyTable[s.Key] = s.Table
	}
}

func listSpec(k string) (db.Spec, bool) {
	for _, s := range db.Lists {
		if s.Key == k {
			return s, true
		}
	}
	return db.Spec{}, false
}

// Empty : état d'une base vide ; le navigateur la remplit alors avec les données de départ.
const Empty = `{"kv":{"equip":{},"recipe":{}}}`

// Store : accès à l'état d'une base ouverte, avec les empreintes de la dernière écriture.
type Store struct {
	mu   sync.Mutex
	d    *sql.DB
	hash map[string][]string // section → empreinte de chaque ligne écrite
}

// New prépare l'accès à la base d.
func New(d *sql.DB) *Store { return &Store{d: d, hash: map[string][]string{}} }

// IsEmpty indique si la base ne contient aucune donnée.
func IsEmpty(d db.Querier) (bool, error) {
	for _, t := range db.Tables {
		var n int
		if err := d.QueryRow(`SELECT count(*) FROM (SELECT 1 FROM "` + t + `" LIMIT 1)`).Scan(&n); err != nil {
			return false, err
		}
		if n > 0 {
			return false, nil
		}
	}
	return true, nil
}

// Load lit toute la base et renvoie l'état JSON (fonction sans cache, pour une base quelconque).
func Load(d *sql.DB) ([]byte, error) { return New(d).Load() }

// Save écrit l'état dans la base (fonction sans cache : tout est réécrit).
func Save(d *sql.DB, state []byte) error { return New(d).Save(state) }

// Load lit toute la base et renvoie l'état JSON.
func (s *Store) Load() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.d
	if e, err := IsEmpty(d); err != nil || e {
		return []byte(Empty), err
	}
	toFill, err := pendingFill(d)
	if err != nil {
		return nil, err
	}
	var b bytes.Buffer
	w := db.ObjWriter{B: &b}
	w.Begin()
	for _, k := range Keys {
		if toFill[keyTable[k]] {
			continue // table créée vide par la reprise : absente de l'état, le navigateur la remplit
		}
		var lb bytes.Buffer
		var err error
		switch k {
		case "styles":
			err = loadStyles(d, &lb)
		case "biblio":
			err = db.WriteBiblio(d, &lb)
		case "html":
			err = db.WriteHtml(d, &lb)
		default:
			sp, _ := listSpec(k)
			err = db.WriteList(d, sp, &lb)
		}
		if err != nil {
			return nil, fmt.Errorf("%s : %w", k, err)
		}
		w.Raw(k, lb.Bytes())
	}
	var kb bytes.Buffer
	kw := db.ObjWriter{B: &kb}
	kw.Begin()
	var eb bytes.Buffer
	if err := loadEquip(d, &eb); err != nil {
		return nil, err
	}
	kw.Raw("equip", eb.Bytes())
	rid, err := db.CurrentRecipe(d)
	if err != nil {
		return nil, err
	}
	if rid != 0 {
		var rb bytes.Buffer
		if err := db.WriteRecipe(d, rid, &rb); err != nil {
			return nil, fmt.Errorf("recette en cours : %w", err)
		}
		kw.Raw("recipe", rb.Bytes())
	} else {
		kw.Raw("recipe", []byte("{}"))
	}
	kw.End()
	w.Raw("kv", kb.Bytes())
	if i18n, err := loadI18n(d); err != nil {
		return nil, err
	} else if i18n != nil {
		w.Raw("i18n", i18n)
	}
	{
		var nom, texte sql.NullString
		err := d.QueryRow(`SELECT nom,texte FROM "licence" LIMIT 1`).Scan(&nom, &texte)
		if err == nil {
			l, _ := db.Marshal(map[string]string{"nom": nom.String, "texte": texte.String})
			w.Raw("licence", l)
		} else if err != sql.ErrNoRows {
			return nil, err
		}
	}
	w.End()
	return b.Bytes(), nil
}

// pendingFill : tables créées vides par la reprise d'une ancienne base et toujours vides.
func pendingFill(d db.Querier) (map[string]bool, error) {
	m := map[string]bool{}
	var x int
	if err := d.QueryRow(`SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?`, db.ToFill).Scan(&x); err != nil || x == 0 {
		return m, err
	}
	r, err := d.Query(`SELECT nom FROM "` + db.ToFill + `"`)
	if err != nil {
		return nil, err
	}
	var names []string
	for r.Next() {
		var t string
		if err := r.Scan(&t); err != nil {
			r.Close()
			return nil, err
		}
		names = append(names, t)
	}
	r.Close()
	for _, t := range names {
		var c int
		if err := d.QueryRow(`SELECT count(*) FROM "` + t + `"`).Scan(&c); err != nil {
			return nil, err
		}
		m[t] = c == 0
	}
	return m, r.Err()
}

func loadStyles(d db.Querier, b *bytes.Buffer) error {
	r, err := d.Query(`SELECT * FROM "style" ORDER BY id`)
	if err != nil {
		return err
	}
	defer r.Close()
	cols, err := r.Columns()
	if err != nil {
		return err
	}
	b.WriteByte('[')
	vals := make([]any, len(cols))
	ptr := make([]any, len(cols))
	for i := range vals {
		ptr[i] = &vals[i]
	}
	for n := 0; r.Next(); n++ {
		if err := r.Scan(ptr...); err != nil {
			return err
		}
		if n > 0 {
			b.WriteByte(',')
		}
		w := db.ObjWriter{B: b}
		w.Begin()
		for i, c := range cols {
			if c == "id" {
				continue
			}
			var v []byte
			switch x := vals[i].(type) {
			case nil:
				v = []byte(`""`)
			case []byte:
				v, _ = db.Marshal(string(x))
			default:
				v, _ = db.Marshal(x)
			}
			w.Raw(c, v)
		}
		w.End()
	}
	b.WriteByte(']')
	return r.Err()
}

// loadEquip : table parametres + logo actif (logos) + polices, comme fromDb() en 3.x.
func loadEquip(d db.Querier, b *bytes.Buffer) error {
	w := db.ObjWriter{B: b}
	w.Begin()
	r, err := d.Query(`SELECT cle,valeur FROM "parametres" ORDER BY rowid`)
	if err != nil {
		return err
	}
	for r.Next() {
		var k string
		var v sql.NullString
		if err := r.Scan(&k, &v); err != nil {
			r.Close()
			return err
		}
		if !v.Valid || !json.Valid([]byte(v.String)) {
			r.Close()
			return fmt.Errorf("parametres.%s : valeur JSON invalide", k)
		}
		w.Raw(k, []byte(v.String))
	}
	r.Close()
	var logo, logon sql.NullString
	err = d.QueryRow(`SELECT nom,donnees FROM "logos" ORDER BY actif DESC,id DESC LIMIT 1`).Scan(&logon, &logo)
	if err == nil {
		l, _ := db.Marshal(logo.String)
		n, _ := db.Marshal(logon.String)
		w.Raw("logo", l)
		w.Raw("logon", n)
	} else if err != sql.ErrNoRows {
		return err
	}
	type font struct {
		N string `json:"n"`
		D string `json:"d"`
		B int    `json:"b,omitempty"`
	}
	var fonts []font
	r, err = d.Query(`SELECT nom,donnees,integree FROM "polices" ORDER BY rowid`)
	if err != nil {
		return err
	}
	for r.Next() {
		var n, dd sql.NullString
		var bi sql.NullInt64
		if err := r.Scan(&n, &dd, &bi); err != nil {
			r.Close()
			return err
		}
		f := font{N: n.String, D: dd.String}
		if bi.Int64 != 0 {
			f.B = 1
		}
		fonts = append(fonts, f)
	}
	r.Close()
	if len(fonts) > 0 {
		fb, _ := db.Marshal(fonts)
		w.Raw("fonts", fb)
	}
	w.End()
	return r.Err()
}

func loadI18n(d db.Querier) ([]byte, error) {
	r, err := d.Query(`SELECT cle,en,es,it,pt FROM "traductions" ORDER BY rowid`)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var b bytes.Buffer
	w := db.ObjWriter{B: &b}
	n := 0
	for r.Next() {
		var k string
		var a, bb, c, e sql.NullString
		if err := r.Scan(&k, &a, &bb, &c, &e); err != nil {
			return nil, err
		}
		if n == 0 {
			w.Begin()
		}
		v, _ := db.Marshal([]string{a.String, bb.String, c.String, e.String})
		w.Raw(k, v)
		n++
	}
	if n == 0 {
		return nil, r.Err()
	}
	w.End()
	return b.Bytes(), r.Err()
}

// --- écriture ---

var (
	reImg  = regexp.MustCompile(`^data:image/([\w+]+)`)
	reFont = regexp.MustCompile(`^data:font/(\w+)`)
)

func sum(b []byte) string {
	h := sha256.Sum256(b)
	return string(h[:])
}

// section : contenu d'une partie de l'état et empreinte de chacun de ses éléments.
type section struct {
	rows []json.RawMessage
	h    []string
}

func newSection(rows []json.RawMessage) section {
	s := section{rows: rows, h: make([]string, len(rows))}
	for i, r := range rows {
		s.h[i] = sum(r)
	}
	return s
}

func (s *Store) same(k string, sec section) bool {
	old, ok := s.hash[k]
	if !ok || len(old) != len(sec.h) {
		return false
	}
	for i := range old {
		if old[i] != sec.h[i] {
			return false
		}
	}
	return true
}

// Save remplace le contenu de la base par l'état reçu, en une transaction ; seules les lignes ou sections
// modifiées depuis la dernière écriture sont réécrites.
func (s *Store) Save(state []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var top map[string]json.RawMessage
	if err := json.Unmarshal(state, &top); err != nil {
		return fmt.Errorf("état JSON invalide : %w", err)
	}
	kvs, err := db.Ordered(top["kv"])
	if err != nil || top["kv"] == nil {
		return fmt.Errorf("état JSON invalide : kv manquant")
	}
	var equipRaw, recipeRaw json.RawMessage
	for _, m := range kvs {
		switch m.K {
		case "equip":
			equipRaw = m.V
		case "recipe":
			recipeRaw = m.V
		}
	}
	equip, err := db.Ordered(equipRaw)
	if err != nil {
		return fmt.Errorf("kv.equip : %w", err)
	}
	if _, err := db.Ordered(recipeRaw); err != nil {
		return fmt.Errorf("kv.recipe : %w", err)
	}
	// sections de l'état
	secs := map[string]section{}
	for _, k := range Keys {
		var rows []json.RawMessage
		if raw, ok := top[k]; ok && string(raw) != "null" {
			if err := json.Unmarshal(raw, &rows); err != nil {
				return fmt.Errorf("%s : %w", k, err)
			}
		}
		secs[k] = newSection(rows)
	}
	var params, fonts, logo []json.RawMessage
	var logon json.RawMessage
	for _, e := range equip {
		switch e.K {
		case "fonts":
			fonts = []json.RawMessage{e.V}
		case "logo":
			logo = append(logo, e.V)
		case "logon":
			logon = e.V
		default:
			k, _ := db.Marshal(e.K)
			params = append(params, json.RawMessage(append(append(k, ':'), e.V...)))
		}
	}
	logo = append(logo, logon)
	secs["equip"] = newSection(params)
	secs["fonts"] = newSection(fonts)
	secs["logo"] = newSection(logo)
	recipeSec := []json.RawMessage{}
	if len(bytes.TrimSpace(recipeRaw)) > 0 {
		recipeSec = append(recipeSec, recipeRaw)
	}
	secs["recipe"] = newSection(recipeSec)
	for _, k := range []string{"i18n", "licence"} {
		var r []json.RawMessage
		if raw, ok := top[k]; ok && string(raw) != "null" {
			r = append(r, raw)
		}
		secs[k] = newSection(r)
	}

	tx, err := s.d.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DROP TABLE IF EXISTS "` + db.ToFill + `"`); err != nil {
		return err
	}
	// listes : ligne par ligne
	for _, k := range Keys {
		if k == "styles" {
			continue
		}
		sec, old := secs[k], s.hash[k]
		for i, raw := range sec.rows {
			if i < len(old) && old[i] == sec.h[i] {
				continue
			}
			switch k {
			case "biblio":
				err = db.UpsertBiblio(tx, i+1, raw)
			case "html":
				err = db.UpsertHtml(tx, i+1, raw)
			default:
				sp, _ := listSpec(k)
				err = db.UpsertList(tx, sp, i+1, raw)
			}
			if err != nil {
				return err
			}
		}
		n := len(sec.rows)
		if k == "biblio" {
			err = db.DeleteBiblioFrom(tx, n+1)
		} else {
			_, err = tx.Exec(`DELETE FROM "`+keyTable[k]+`" WHERE id > ?`, n)
		}
		if err != nil {
			return err
		}
	}
	if !s.same("biblio", secs["biblio"]) || !s.same("html", secs["html"]) {
		if err := db.LinkHtml(tx); err != nil {
			return err
		}
	}
	// sections réécrites en bloc
	if !s.same("styles", secs["styles"]) {
		var objs []map[string]any
		if raw, ok := top["styles"]; ok && string(raw) != "null" {
			if err := json.Unmarshal(raw, &objs); err != nil {
				return fmt.Errorf("styles : %w", err)
			}
		}
		if _, err := tx.Exec(`DELETE FROM "style"`); err != nil {
			return err
		}
		if err := db.InsertStyles(tx, objs); err != nil {
			return err
		}
	}
	if !s.same("equip", secs["equip"]) {
		if err := saveParams(tx, equip); err != nil {
			return err
		}
	}
	if !s.same("logo", secs["logo"]) {
		if err := saveLogo(tx, logo[:len(logo)-1], logon); err != nil {
			return err
		}
	}
	if !s.same("fonts", secs["fonts"]) {
		if err := saveFonts(tx, fonts); err != nil {
			return err
		}
	}
	if !s.same("recipe", secs["recipe"]) {
		if _, err := tx.Exec(`DELETE FROM "recettes" WHERE en_cours = 1`); err != nil {
			return err
		}
		if len(recipeSec) > 0 && bytes.TrimSpace(recipeRaw)[0] == '{' {
			if _, err := db.InsertRecipe(tx, recipeRaw, true); err != nil {
				return err
			}
		}
	}
	if !s.same("i18n", secs["i18n"]) {
		if err := saveI18n(tx, top["i18n"]); err != nil {
			return err
		}
	}
	if !s.same("licence", secs["licence"]) {
		if err := saveLicence(tx, top["licence"]); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	for k, sec := range secs {
		s.hash[k] = sec.h
	}
	return nil
}

// nameOf reproduit `String(x || ”)` côté nom (texte) ; utilisé pour les noms de polices et de logo.
func nameOf(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case bool:
		if x {
			return "true"
		}
		return ""
	case float64:
		if x == 0 {
			return ""
		}
	}
	b, _ := db.Marshal(v)
	return string(b)
}

func saveParams(tx *sql.Tx, equip []db.KV) error {
	if _, err := tx.Exec(`DELETE FROM "parametres"`); err != nil {
		return err
	}
	st, err := tx.Prepare(`INSERT OR REPLACE INTO "parametres" VALUES(?,?)`)
	if err != nil {
		return err
	}
	defer st.Close()
	for _, e := range equip {
		if e.K == "fonts" || e.K == "logo" || e.K == "logon" {
			continue
		}
		if _, err := st.Exec(e.K, string(e.V)); err != nil {
			return err
		}
	}
	return nil
}

func saveLogo(tx *sql.Tx, logo []json.RawMessage, logon json.RawMessage) error {
	if _, err := tx.Exec(`DELETE FROM "logos"`); err != nil {
		return err
	}
	var ls string
	if len(logo) == 0 || json.Unmarshal(logo[0], &ls) != nil || !strings.HasPrefix(ls, "data:image/") {
		return nil
	}
	nom := "Logo des étiquettes"
	var ln any
	if len(logon) > 0 && json.Unmarshal(logon, &ln) == nil {
		if n := nameOf(ln); n != "" {
			nom = n
		}
	}
	f := "png"
	if m := reImg.FindStringSubmatch(ls); m != nil {
		f = m[1]
	}
	_, err := tx.Exec(`INSERT INTO "logos"(nom,format,donnees,actif) VALUES(?,?,?,1)`, nom, f, ls)
	return err
}

func saveFonts(tx *sql.Tx, fonts []json.RawMessage) error {
	if _, err := tx.Exec(`DELETE FROM "polices"`); err != nil {
		return err
	}
	if len(fonts) == 0 {
		return nil
	}
	var fl []json.RawMessage
	_ = json.Unmarshal(fonts[0], &fl)
	st, err := tx.Prepare(`INSERT OR REPLACE INTO "polices" VALUES(?,?,?,?)`)
	if err != nil {
		return err
	}
	defer st.Close()
	for _, raw := range fl {
		var u struct {
			N any `json:"n"`
			D any `json:"d"`
			B any `json:"b"`
		}
		if json.Unmarshal(raw, &u) != nil {
			continue
		}
		ds, ok := u.D.(string)
		n := nameOf(u.N)
		if !ok || n == "" {
			continue
		}
		f := "ttf"
		if m := reFont.FindStringSubmatch(ds); m != nil {
			f = m[1]
		}
		b := 0
		if nameOf(u.B) != "" {
			b = 1
		}
		if _, err := st.Exec(n, f, ds, b); err != nil {
			return err
		}
	}
	return nil
}

func saveI18n(tx *sql.Tx, raw json.RawMessage) error {
	if _, err := tx.Exec(`DELETE FROM "traductions"`); err != nil {
		return err
	}
	tr, err := db.Ordered(raw)
	if err != nil {
		return fmt.Errorf("i18n : %w", err)
	}
	st, err := tx.Prepare(`INSERT OR REPLACE INTO "traductions" VALUES(?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer st.Close()
	for _, e := range tr {
		var v []any
		_ = json.Unmarshal(e.V, &v)
		s := make([]any, 4)
		for i := range s {
			s[i] = ""
			if i < len(v) {
				if x, ok := v[i].(string); ok {
					s[i] = x
				}
			}
		}
		if _, err := st.Exec(e.K, e.K, s[0], s[1], s[2], s[3]); err != nil {
			return err
		}
	}
	return nil
}

func saveLicence(tx *sql.Tx, raw json.RawMessage) error {
	if _, err := tx.Exec(`DELETE FROM "licence"`); err != nil {
		return err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var l struct {
		Nom   string `json:"nom"`
		Texte string `json:"texte"`
	}
	if err := json.Unmarshal(raw, &l); err != nil {
		return fmt.Errorf("licence : %w", err)
	}
	_, err := tx.Exec(`INSERT INTO "licence" VALUES(?,?)`, l.Nom, l.Texte)
	return err
}
