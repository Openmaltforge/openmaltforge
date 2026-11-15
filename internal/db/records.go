package db

// Lecture et écriture des objets de l'état dans le schéma normalisé (structure 2).

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// Querier : *sql.DB ou *sql.Tx.
type Querier interface {
	Query(string, ...any) (*sql.Rows, error)
	QueryRow(string, ...any) *sql.Row
	Exec(string, ...any) (sql.Result, error)
}

func isArray(raw json.RawMessage) bool {
	tr := bytes.TrimSpace(raw)
	return len(tr) > 0 && tr[0] == '['
}

// UpsertList écrit l'objet raw à la position id (1, 2…) de la table s.
func UpsertList(q Querier, s Spec, id int, raw json.RawMessage) error {
	obj, err := Ordered(raw)
	if err != nil {
		return fmt.Errorf("%s ligne %d : %w", s.Key, id, err)
	}
	vals, extra := Split(obj, s.Cols, nil)
	a := append([]any{id}, vals...)
	a = append(a, EncodeExtra(extra))
	set := make([]string, 0, len(s.Cols)+1)
	for _, c := range s.Cols {
		set = append(set, `"`+c.Name+`"=excluded."`+c.Name+`"`)
	}
	set = append(set, "extra=excluded.extra")
	_, err = q.Exec(`INSERT INTO "`+s.Table+`"(id,`+ColNames(s.Cols)+`,extra) VALUES(?,`+Placeholders(len(s.Cols))+`,?)
		ON CONFLICT(id) DO UPDATE SET `+strings.Join(set, ","), a...)
	return err
}

// recipeLists : listes d'objets d'une recette rangées dans les tables de lignes (dans l'ordre des clés).
func recipeLists(obj []KV) (keys []string, lists map[string][]json.RawMessage) {
	known := map[string]bool{}
	for _, s := range RecipeLists {
		known[s.Key] = true
	}
	lists = map[string][]json.RawMessage{}
	for _, m := range obj {
		if !known[m.K] || !isArray(m.V) {
			continue
		}
		var items []json.RawMessage
		if json.Unmarshal(m.V, &items) != nil {
			continue
		}
		ok := true
		for _, it := range items {
			if tr := bytes.TrimSpace(it); len(tr) == 0 || tr[0] != '{' {
				ok = false // élément qui n'est pas un objet : la liste reste dans extra
			}
		}
		if ok {
			keys = append(keys, m.K)
			lists[m.K] = items
		}
	}
	return keys, lists
}

// InsertRecipe crée une recette (objet « recipe ») et ses lignes ; renvoie son id.
func InsertRecipe(q Querier, raw json.RawMessage, enCours bool) (int64, error) {
	obj, err := Ordered(raw)
	if err != nil {
		return 0, fmt.Errorf("recette : %w", err)
	}
	keys, lists := recipeLists(obj)
	vals, extra := Split(obj, RecipeCols, func(k string) bool { _, ok := lists[k]; return ok })
	ec := 0
	if enCours {
		ec = 1
	}
	a := append([]any{ec}, vals...)
	a = append(a, strings.Join(keys, ","), EncodeExtra(extra))
	res, err := q.Exec(`INSERT INTO "recettes"(en_cours,`+ColNames(RecipeCols)+`,listes,extra) VALUES(?,`+Placeholders(len(RecipeCols))+`,?,?)`, a...)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	for _, s := range RecipeLists {
		for i, it := range lists[s.Key] {
			o, err := Ordered(it)
			if err != nil {
				return 0, err
			}
			v, ex := Split(o, s.Cols, nil)
			b := append([]any{id, i + 1}, v...)
			b = append(b, EncodeExtra(ex))
			if _, err := q.Exec(`INSERT INTO "`+s.Table+`"(recette_id,ordre,`+ColNames(s.Cols)+`,extra) VALUES(?,?,`+Placeholders(len(s.Cols))+`,?)`, b...); err != nil {
				return 0, err
			}
		}
	}
	return id, nil
}

// UpsertBiblio écrit l'entrée de bibliothèque raw à la position id ; sa recette (champ recipe) est recréée.
func UpsertBiblio(q Querier, id int, raw json.RawMessage) error {
	obj, err := Ordered(raw)
	if err != nil {
		return fmt.Errorf("bibliothèque ligne %d : %w", id, err)
	}
	var recRaw json.RawMessage
	for _, m := range obj {
		if m.K == "recipe" {
			if tr := bytes.TrimSpace(m.V); len(tr) > 0 && tr[0] == '{' {
				recRaw = m.V
			}
			break
		}
	}
	if _, err := q.Exec(`DELETE FROM "recettes" WHERE id = (SELECT recette_id FROM "bibliotheque" WHERE id = ?)`, id); err != nil {
		return err
	}
	var rid any
	if recRaw != nil {
		if rid, err = InsertRecipe(q, recRaw, false); err != nil {
			return err
		}
	}
	vals, extra := Split(obj, BiblioCols, func(k string) bool { return k == "recipe" && recRaw != nil })
	a := append([]any{id}, vals...)
	a = append(a, rid, EncodeExtra(extra))
	set := []string{"recette_id=excluded.recette_id", "extra=excluded.extra"}
	for _, c := range BiblioCols {
		set = append(set, `"`+c.Name+`"=excluded."`+c.Name+`"`)
	}
	_, err = q.Exec(`INSERT INTO "bibliotheque"(id,`+ColNames(BiblioCols)+`,recette_id,extra) VALUES(?,`+Placeholders(len(BiblioCols))+`,?,?)
		ON CONFLICT(id) DO UPDATE SET `+strings.Join(set, ","), a...)
	return err
}

// DeleteBiblioFrom supprime les entrées de bibliothèque de position ≥ id et leurs recettes.
func DeleteBiblioFrom(q Querier, id int) error {
	if _, err := q.Exec(`DELETE FROM "recettes" WHERE id IN (SELECT recette_id FROM "bibliotheque" WHERE id >= ?)`, id); err != nil {
		return err
	}
	_, err := q.Exec(`DELETE FROM "bibliotheque" WHERE id >= ?`, id)
	return err
}

// UpsertHtml écrit le rendu HTML raw à la position id, relié à l'entrée de bibliothèque de même identifiant.
func UpsertHtml(q Querier, id int, raw json.RawMessage) error {
	obj, err := Ordered(raw)
	if err != nil {
		return fmt.Errorf("html ligne %d : %w", id, err)
	}
	vals, extra := Split(obj, HtmlCols, nil)
	a := append([]any{id, vals[0]}, vals...)
	a = append(a, EncodeExtra(extra))
	set := []string{"bibliotheque_id=excluded.bibliotheque_id", "extra=excluded.extra"}
	for _, c := range HtmlCols {
		set = append(set, `"`+c.Name+`"=excluded."`+c.Name+`"`)
	}
	_, err = q.Exec(`INSERT INTO "html"(id,bibliotheque_id,`+ColNames(HtmlCols)+`,extra)
		VALUES(?,(SELECT min(id) FROM "bibliotheque" WHERE ident = ?),`+Placeholders(len(HtmlCols))+`,?)
		ON CONFLICT(id) DO UPDATE SET `+strings.Join(set, ","), a...)
	return err
}

// LinkHtml relie les rendus HTML à leur entrée de bibliothèque (après une réécriture de la bibliothèque).
func LinkHtml(q Querier) error {
	_, err := q.Exec(`UPDATE "html" SET bibliotheque_id = (SELECT min(id) FROM "bibliotheque" b WHERE b.ident = html.ident)`)
	return err
}

// --- lecture ---

func scanRow(rows *sql.Rows, n int) ([]any, sql.NullString, error) {
	vals := make([]any, n)
	var extra sql.NullString
	ptr := make([]any, n+1)
	for i := range vals {
		ptr[i] = &vals[i]
	}
	ptr[n] = &extra
	err := rows.Scan(ptr...)
	return vals, extra, err
}

// WriteList écrit la liste JSON de la table s (ordre des positions).
func WriteList(q Querier, s Spec, b *bytes.Buffer) error {
	rows, err := q.Query(`SELECT ` + ColNames(s.Cols) + `,extra FROM "` + s.Table + `" ORDER BY id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	b.WriteByte('[')
	for n := 0; rows.Next(); n++ {
		vals, extra, err := scanRow(rows, len(s.Cols))
		if err != nil {
			return err
		}
		if n > 0 {
			b.WriteByte(',')
		}
		w := ObjWriter{B: b}
		w.Begin()
		if err := w.Cols(s.Cols, vals); err != nil {
			return err
		}
		if err := w.Extra(extra); err != nil {
			return err
		}
		w.End()
	}
	b.WriteByte(']')
	return rows.Err()
}

// WriteRecipe écrit la recette id (objet « recipe »).
func WriteRecipe(q Querier, id int64, b *bytes.Buffer) error {
	rows, err := q.Query(`SELECT `+ColNames(RecipeCols)+`,listes,extra FROM "recettes" WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if !rows.Next() {
		rows.Close()
		return fmt.Errorf("recette %d introuvable", id)
	}
	vals := make([]any, len(RecipeCols))
	ptr := make([]any, len(RecipeCols)+2)
	for i := range vals {
		ptr[i] = &vals[i]
	}
	var listes, extra sql.NullString
	ptr[len(vals)], ptr[len(vals)+1] = &listes, &extra
	err = rows.Scan(ptr...)
	rows.Close()
	if err != nil {
		return err
	}
	w := ObjWriter{B: b}
	w.Begin()
	if err := w.Cols(RecipeCols, vals); err != nil {
		return err
	}
	if listes.String != "" {
		for _, k := range strings.Split(listes.String, ",") {
			var s Spec
			for _, x := range RecipeLists {
				if x.Key == k {
					s = x
				}
			}
			if s.Table == "" {
				return fmt.Errorf("liste de recette inconnue : %s", k)
			}
			var lb bytes.Buffer
			if err := writeLines(q, s, id, &lb); err != nil {
				return err
			}
			w.Raw(k, lb.Bytes())
		}
	}
	if err := w.Extra(extra); err != nil {
		return err
	}
	w.End()
	return nil
}

func writeLines(q Querier, s Spec, id int64, b *bytes.Buffer) error {
	rows, err := q.Query(`SELECT `+ColNames(s.Cols)+`,extra FROM "`+s.Table+`" WHERE recette_id = ? ORDER BY ordre`, id)
	if err != nil {
		return err
	}
	defer rows.Close()
	b.WriteByte('[')
	for n := 0; rows.Next(); n++ {
		vals, extra, err := scanRow(rows, len(s.Cols))
		if err != nil {
			return err
		}
		if n > 0 {
			b.WriteByte(',')
		}
		w := ObjWriter{B: b}
		w.Begin()
		if err := w.Cols(s.Cols, vals); err != nil {
			return err
		}
		if err := w.Extra(extra); err != nil {
			return err
		}
		w.End()
	}
	b.WriteByte(']')
	return rows.Err()
}

// WriteBiblio écrit la bibliothèque (liste JSON).
func WriteBiblio(q Querier, b *bytes.Buffer) error {
	rows, err := q.Query(`SELECT ` + ColNames(BiblioCols) + `,recette_id,extra FROM "bibliotheque" ORDER BY id`)
	if err != nil {
		return err
	}
	type entry struct {
		vals  []any
		rid   sql.NullInt64
		extra sql.NullString
	}
	var es []entry
	for rows.Next() {
		e := entry{vals: make([]any, len(BiblioCols))}
		ptr := make([]any, len(BiblioCols)+2)
		for i := range e.vals {
			ptr[i] = &e.vals[i]
		}
		ptr[len(e.vals)], ptr[len(e.vals)+1] = &e.rid, &e.extra
		if err := rows.Scan(ptr...); err != nil {
			rows.Close()
			return err
		}
		es = append(es, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	b.WriteByte('[')
	for n, e := range es {
		if n > 0 {
			b.WriteByte(',')
		}
		w := ObjWriter{B: b}
		w.Begin()
		if err := w.Cols(BiblioCols, e.vals); err != nil {
			return err
		}
		if e.rid.Valid {
			var rb bytes.Buffer
			if err := WriteRecipe(q, e.rid.Int64, &rb); err != nil {
				return err
			}
			w.Raw("recipe", rb.Bytes())
		}
		if err := w.Extra(e.extra); err != nil {
			return err
		}
		w.End()
	}
	b.WriteByte(']')
	return nil
}

// WriteHtml écrit la liste des rendus HTML.
func WriteHtml(q Querier, b *bytes.Buffer) error {
	return WriteList(q, Spec{"html", "html", HtmlCols}, b)
}

// CurrentRecipe : id de la recette en cours (0 si aucune).
func CurrentRecipe(q Querier) (int64, error) {
	var id int64
	err := q.QueryRow(`SELECT id FROM "recettes" WHERE en_cours = 1`).Scan(&id)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return id, err
}
