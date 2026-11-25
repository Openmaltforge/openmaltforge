package server

// Impression PDF par le protocole DevTools (6.12.0) : certains navigateurs (Brave) ne rendent jamais la main
// avec --print-to-pdf ; on pilote donc la page par le port de débogage, avec un client WebSocket minimal
// (texte seulement, sans dépendance).

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type wsConn struct {
	c  net.Conn
	br *bufio.Reader
}

func wsDial(ctx context.Context, u string) (*wsConn, error) {
	pu, err := url.Parse(u)
	if err != nil {
		return nil, err
	}
	var d net.Dialer
	c, err := d.DialContext(ctx, "tcp", pu.Host)
	if err != nil {
		return nil, err
	}
	if dl, ok := ctx.Deadline(); ok {
		c.SetDeadline(dl)
	}
	k := make([]byte, 16)
	rand.Read(k)
	fmt.Fprintf(c, "GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n",
		pu.RequestURI(), pu.Host, base64.StdEncoding.EncodeToString(k))
	br := bufio.NewReader(c)
	st, err := br.ReadString('\n')
	if err != nil || !strings.Contains(st, " 101 ") {
		c.Close()
		return nil, fmt.Errorf("connexion DevTools refusée : %q %v", strings.TrimSpace(st), err)
	}
	for {
		l, err := br.ReadString('\n')
		if err != nil {
			c.Close()
			return nil, err
		}
		if l == "\r\n" {
			break
		}
	}
	return &wsConn{c: c, br: br}, nil
}

func (w *wsConn) write(op byte, p []byte) error {
	h := []byte{0x80 | op}
	switch n := len(p); {
	case n < 126:
		h = append(h, 0x80|byte(n))
	case n < 1<<16:
		h = append(h, 0x80|126, byte(n>>8), byte(n))
	default:
		h = append(h, 0x80|127)
		h = binary.BigEndian.AppendUint64(h, uint64(n))
	}
	m := make([]byte, 4)
	rand.Read(m)
	h = append(h, m...)
	b := make([]byte, len(p))
	for i := range p {
		b[i] = p[i] ^ m[i%4]
	}
	_, err := w.c.Write(append(h, b...))
	return err
}

// read renvoie le prochain message texte (fragments réassemblés ; ping → pong).
func (w *wsConn) read() ([]byte, error) {
	var msg []byte
	for {
		h := make([]byte, 2)
		if _, err := io.ReadFull(w.br, h); err != nil {
			return nil, err
		}
		fin, op, n := h[0]&0x80 != 0, h[0]&0x0f, uint64(h[1]&0x7f)
		switch n {
		case 126:
			e := make([]byte, 2)
			if _, err := io.ReadFull(w.br, e); err != nil {
				return nil, err
			}
			n = uint64(binary.BigEndian.Uint16(e))
		case 127:
			e := make([]byte, 8)
			if _, err := io.ReadFull(w.br, e); err != nil {
				return nil, err
			}
			n = binary.BigEndian.Uint64(e)
		}
		if n > 256<<20 {
			return nil, errors.New("message DevTools trop long")
		}
		p := make([]byte, n)
		if _, err := io.ReadFull(w.br, p); err != nil {
			return nil, err
		}
		switch op {
		case 8:
			return nil, io.EOF
		case 9:
			w.write(10, p)
			continue
		case 10:
			continue
		}
		msg = append(msg, p...)
		if fin {
			return msg, nil
		}
	}
}

type cdpSess struct {
	ws *wsConn
	id int
}

// call envoie une commande et attend sa réponse ; evt (facultatif) reçoit les événements lus entre-temps.
func (s *cdpSess) call(method string, params any, evt func(string)) (json.RawMessage, error) {
	s.id++
	b, _ := json.Marshal(map[string]any{"id": s.id, "method": method, "params": params})
	if err := s.ws.write(1, b); err != nil {
		return nil, err
	}
	for {
		m, err := s.ws.read()
		if err != nil {
			return nil, err
		}
		var r struct {
			ID     int             `json:"id"`
			Method string          `json:"method"`
			Result json.RawMessage `json:"result"`
			Error  *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(m, &r) != nil {
			continue
		}
		if r.ID == s.id {
			if r.Error != nil {
				return nil, fmt.Errorf("%s : %s", method, r.Error.Message)
			}
			return r.Result, nil
		}
		if r.Method != "" && evt != nil {
			evt(r.Method)
		}
	}
}

// waitEvent lit les messages jusqu'à l'événement name.
func (s *cdpSess) waitEvent(name string) error {
	for {
		m, err := s.ws.read()
		if err != nil {
			return err
		}
		if strings.Contains(string(m), `"method":"`+name+`"`) {
			return nil
		}
	}
}

// cdpPrintPDF lance le navigateur sans fenêtre (profil prof), charge pageURL en mode impression, laisse la page se
// répartir en pages (fonction omfPaginate, si présente) et renvoie le PDF (A4) et le nombre de pages annoncé.
func cdpPrintPDF(ctx context.Context, browser, prof, pageURL string) ([]byte, int, error) {
	port := filepath.Join(prof, "DevToolsActivePort")
	os.Remove(port)
	cmd := exec.Command(browser, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
		"--disable-extensions", "--disable-background-networking", "--user-data-dir="+prof, "--remote-debugging-port=0",
		"about:blank")
	hideWindow(cmd)
	cmd.WaitDelay = 3 * time.Second
	if err := cmd.Start(); err != nil {
		return nil, 0, err
	}
	defer func() {
		killTree(cmd)
		cmd.Wait()
	}()
	var p string
	for p == "" {
		if b, err := os.ReadFile(port); err == nil {
			if l := strings.SplitN(string(b), "\n", 2); len(l) == 2 && strings.TrimSpace(l[0]) != "" {
				p = strings.TrimSpace(l[0])
				break
			}
		}
		select {
		case <-ctx.Done():
			return nil, 0, errors.New("le navigateur sans fenêtre n'a pas démarré")
		case <-time.After(100 * time.Millisecond):
		}
	}
	var wsURL string
	for wsURL == "" {
		req, _ := http.NewRequestWithContext(ctx, "GET", "http://127.0.0.1:"+p+"/json/list", nil)
		if r, err := http.DefaultClient.Do(req); err == nil {
			var l []struct {
				Type string `json:"type"`
				WS   string `json:"webSocketDebuggerUrl"`
			}
			json.NewDecoder(r.Body).Decode(&l)
			r.Body.Close()
			for _, t := range l {
				if t.Type == "page" && t.WS != "" {
					wsURL = t.WS
					break
				}
			}
		}
		if wsURL == "" {
			select {
			case <-ctx.Done():
				return nil, 0, errors.New("page du navigateur sans fenêtre introuvable")
			case <-time.After(100 * time.Millisecond):
			}
		}
	}
	ws, err := wsDial(ctx, wsURL)
	if err != nil {
		return nil, 0, err
	}
	defer ws.c.Close()
	s := &cdpSess{ws: ws}
	if _, err := s.call("Page.enable", map[string]any{}, nil); err != nil {
		return nil, 0, err
	}
	if _, err := s.call("Emulation.setEmulatedMedia", map[string]any{"media": "print"}, nil); err != nil {
		return nil, 0, err
	}
	loaded := false
	if _, err := s.call("Page.navigate", map[string]any{"url": pageURL}, func(m string) { loaded = loaded || m == "Page.loadEventFired" }); err != nil {
		return nil, 0, err
	}
	if !loaded {
		if err := s.waitEvent("Page.loadEventFired"); err != nil {
			return nil, 0, err
		}
	}
	pages := 0
	if res, err := s.call("Runtime.evaluate", map[string]any{"expression": "document.fonts.ready.then(() => (typeof omfPaginate === 'function' ? omfPaginate() : 0))",
		"awaitPromise": true, "returnByValue": true}, nil); err == nil {
		var v struct {
			Result struct {
				Value float64 `json:"value"`
			} `json:"result"`
		}
		if json.Unmarshal(res, &v) == nil {
			pages = int(v.Result.Value)
		}
	}
	res, err := s.call("Page.printToPDF", map[string]any{"printBackground": true, "preferCSSPageSize": true,
		"paperWidth": 8.27, "paperHeight": 11.69, "displayHeaderFooter": false}, nil)
	if err != nil {
		return nil, 0, err
	}
	var out struct {
		Data string `json:"data"`
	}
	if err := json.Unmarshal(res, &out); err != nil {
		return nil, 0, err
	}
	b, err := base64.StdEncoding.DecodeString(out.Data)
	return b, pages, err
}
