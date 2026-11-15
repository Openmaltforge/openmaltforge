// OpenMaltForge — application de bureau : serveur local (127.0.0.1) qui sert l'interface embarquée et
// gère la base SQLite, affichée dans une fenêtre Chromium en mode application.
//
//	openmaltforge                     ouvre la fenêtre
//	openmaltforge --no-browser        serveur seul (affiche l'adresse) — utilisé par les tests
//	openmaltforge --port 8765         port d'écoute (sinon 8765, ou un port libre)
//	openmaltforge --dossier <chemin>  dossier de données (défaut ~/OpenMaltForge ; variable OPENMALTFORGE_DIR ;
//	                              au 1er lancement, reprise de ~/OpenBrew/openbrew.sqlite
//	                              ou ~/BrewCraft/brewcraft.sqlite)
//	openmaltforge --version
package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"openmaltforge/internal/config"
	"openmaltforge/internal/desktop"
	"openmaltforge/internal/server"
	"openmaltforge/web"
)

func home() string {
	h, err := os.UserHomeDir()
	if err != nil {
		h = "."
	}
	return h
}

func dataDir() string {
	if d := os.Getenv("OPENMALTFORGE_DIR"); d != "" {
		return d
	}
	return filepath.Join(home(), "OpenMaltForge")
}

// legacyDirs : dossiers de données des anciens noms (OpenBrew 5.x, puis BrewCraft), dont la base est reprise au
// premier lancement, dans cet ordre.
func legacyDirs() []string {
	ob, bc := os.Getenv("OPENBREW_DIR"), os.Getenv("BREWCRAFT_DIR")
	if ob == "" {
		ob = filepath.Join(home(), "OpenBrew")
	}
	if bc == "" {
		bc = filepath.Join(home(), "BrewCraft")
	}
	return []string{ob, bc}
}

// quiet : mode serveur seul (tests) — pas de boîte de dialogue graphique, message sur la sortie d'erreur.
var quiet bool

func fail(msg string) {
	if quiet {
		fmt.Fprintln(os.Stderr, "OpenMaltForge : "+msg)
	} else {
		desktop.Alert(msg)
	}
	os.Exit(1)
}

func main() {
	noBrowser := flag.Bool("no-browser", false, "serveur seul, sans fenêtre")
	port := flag.String("port", "8765", "port d'écoute (0 = port libre)")
	dir := flag.String("dossier", dataDir(), "dossier de données")
	showVersion := flag.Bool("version", false, "affiche la version")
	flag.Parse()
	quiet = *noBrowser
	if *showVersion {
		fmt.Println("OpenMaltForge", config.Version)
		return
	}
	/* reprise de la base d’OpenBrew / BrewCraft seulement pour le dossier par défaut (pas avec --dossier, ni dans les tests) */
	var legacy []string
	dirSet := false
	flag.Visit(func(f *flag.Flag) { dirSet = dirSet || f.Name == "dossier" })
	if !dirSet && os.Getenv("OPENMALTFORGE_DIR") == "" {
		legacy = legacyDirs()
	}
	srv, err := server.Open(*dir, web.FS, legacy...)
	if err != nil {
		fail("Impossible d'ouvrir la base de données : " + err.Error())
	}
	defer srv.Close()
	if srv.Imported != "" {
		fmt.Println("Base reprise :", srv.Imported)
	}
	if srv.Backup != "" {
		fmt.Println("Sauvegarde avant migration :", srv.Backup)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+*port)
	if err != nil {
		if ln, err = net.Listen("tcp", "127.0.0.1:0"); err != nil {
			fail("Impossible de démarrer le serveur : " + err.Error())
		}
	}
	appURL := fmt.Sprintf("http://localhost:%d/", ln.Addr().(*net.TCPAddr).Port)
	hs := &http.Server{Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	fmt.Println("OpenMaltForge", config.Version, "-", appURL)
	fmt.Println("Base de données :", srv.Path())
	if *noBrowser {
		if err := hs.Serve(ln); err != nil {
			fail(err.Error())
		}
		return
	}
	go hs.Serve(ln)
	if desktop.InstallDesktop() {
		time.Sleep(1500 * time.Millisecond) // laisse le bureau repérer la nouvelle entrée de menu
	}
	b := desktop.FindBrowser()
	if b == "" {
		fail("Aucun navigateur Chromium (Microsoft Edge, Google Chrome, Chromium ou Brave) n'a été trouvé. Installez l'un d'eux puis relancez OpenMaltForge.")
	}
	t0 := time.Now()
	srv.TouchPing()
	cmd := desktop.AppCommand(b, appURL, filepath.Join(*dir, ".profil"))
	if err := cmd.Start(); err != nil {
		fail("Impossible d'ouvrir la fenêtre : " + err.Error())
	}
	_ = cmd.Wait()
	// Navigateur terminé : fenêtre fermée → arrêt. S'il a rendu la main tout de suite (Brave, Edge,
	// snap…), la fenêtre vit dans un autre processus : on reste actif tant qu'elle envoie des battements.
	if time.Since(t0) > 8*time.Second {
		return
	}
	for time.Since(srv.LastPing()) < server.PingTimeout {
		time.Sleep(time.Second)
	}
}
