package server

import (
	"strings"
	"testing"
)

// 6.12.0 : page HTML → PDF par le navigateur sans fenêtre (test ignoré sans navigateur Chromium).
func TestPDF(t *testing.T) {
	if PdfBrowser() == "" {
		t.Skip("aucun navigateur Chromium")
	}
	_, ts := newServer(t, t.TempDir())
	if r, _ := do(t, "POST", ts.URL+"/api/pdf", []byte("<p>x</p>"), nil); r.StatusCode != 403 {
		t.Errorf("sans en-tête : %d, attendu 403", r.StatusCode)
	}
	r, b := do(t, "POST", ts.URL+"/api/pdf", []byte("<!doctype html><meta charset=utf-8><h1>Recette d’essai</h1><table><tr><td>Pilsen</td></tr></table>"), w1)
	if r.StatusCode != 200 || !strings.HasPrefix(string(b), "%PDF-") || r.Header.Get("Content-Type") != "application/pdf" {
		t.Fatalf("PDF : %d %q %.80s", r.StatusCode, r.Header.Get("Content-Type"), b)
	}
	if r, _ := do(t, "GET", ts.URL+"/api/pdfsrc/inconnu", nil, nil); r.StatusCode != 404 {
		t.Errorf("page inconnue : %d, attendu 404", r.StatusCode)
	}
}

func TestPDFSansNavigateur(t *testing.T) {
	old := PdfBrowser
	PdfBrowser = func() string { return "" }
	defer func() { PdfBrowser = old }()
	_, ts := newServer(t, t.TempDir())
	if r, b := do(t, "POST", ts.URL+"/api/pdf", []byte("<p>x</p>"), w1); r.StatusCode != 503 || !strings.Contains(string(b), "navigateur") {
		t.Errorf("sans navigateur : %d %s", r.StatusCode, b)
	}
}
