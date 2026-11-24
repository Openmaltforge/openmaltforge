package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"openmaltforge/internal/desktop"
)

// PdfBrowser trouve le navigateur Chromium qui produit les PDF (remplacé par les tests).
var PdfBrowser = desktop.FindBrowser

var (
	pdfMu  sync.Mutex // un PDF à la fois (profil du navigateur partagé)
	pdfSrc sync.Map   // jeton → page HTML servie au navigateur sans fenêtre
)

var errPasDeNavigateur = errors.New("aucun navigateur Chrome, Chromium, Edge ou Brave trouvé pour créer le PDF")

// pdf (6.12.0) : POST d'une page HTML complète → fichier PDF (A4), produit par le navigateur en mode sans fenêtre.
func (s *Server) pdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}
	if !writeAllowed(w, r) {
		return
	}
	page, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32<<20))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	b, err := s.PDF(r.Context(), "http://"+r.Host, page)
	if err != nil {
		code := http.StatusInternalServerError
		if errors.Is(err, errPasDeNavigateur) {
			code = http.StatusServiceUnavailable
		}
		http.Error(w, err.Error(), code)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/pdf")
	w.Write(b)
}

// PDF produit le PDF d'une page HTML ; base = adresse du serveur (http://127.0.0.1:port).
func (s *Server) PDF(ctx context.Context, base string, page []byte) ([]byte, error) {
	br := PdfBrowser()
	if br == "" {
		return nil, errPasDeNavigateur
	}
	pdfMu.Lock()
	defer pdfMu.Unlock()
	k := make([]byte, 16)
	rand.Read(k)
	tok := hex.EncodeToString(k)
	pdfSrc.Store(tok, page)
	defer pdfSrc.Delete(tok)
	prof := filepath.Join(s.dir, ".profil-pdf") // à côté du profil de la fenêtre : accessible aux navigateurs « snap »
	if err := os.MkdirAll(prof, 0o755); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	b, err := cdpPrintPDF(ctx, br, prof, base+"/api/pdfsrc/"+tok)
	if err != nil {
		return nil, fmt.Errorf("le navigateur n'a pas produit le PDF : %v", err)
	}
	if len(b) < 5 || string(b[:5]) != "%PDF-" {
		return nil, errors.New("le navigateur n'a pas produit le PDF")
	}
	return b, nil
}

// pdfPage sert au navigateur sans fenêtre la page à imprimer (jeton à usage unique, local seulement).
func (s *Server) pdfPage(w http.ResponseWriter, r *http.Request) {
	tok := strings.TrimPrefix(r.URL.Path, "/api/pdfsrc/")
	v, ok := pdfSrc.Load(tok)
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(v.([]byte))
}
