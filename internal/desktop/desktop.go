// Package desktop : mode bureau — fenêtre Chromium en mode application (--app) avec un profil
// dédié, entrée de menu Linux et icônes. Repris du lanceur de BrewCraft 3.x.
// Les parties propres au système sont dans desktop_unix.go et desktop_windows.go.
package desktop

import (
	"embed"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

//go:embed icons/*.png
var iconFiles embed.FS

// FindBrowser renvoie le chemin d'un navigateur à moteur Chromium ("" si aucun).
// OPENMALTFORGE_BROWSER force le navigateur.
func FindBrowser() string {
	if p := os.Getenv("OPENMALTFORGE_BROWSER"); p != "" {
		if lp, err := exec.LookPath(p); err == nil {
			return lp
		}
		return p
	}
	for _, c := range candidates() {
		if filepath.IsAbs(c) {
			if _, err := os.Stat(c); err == nil {
				return c
			}
			continue
		}
		if p, err := exec.LookPath(c); err == nil {
			return p
		}
	}
	return ""
}

// AppCommand prépare la fenêtre d'application (sans onglets ni barre d'adresse).
func AppCommand(browser, url, profileDir string) *exec.Cmd {
	args := []string{"--app=" + url, "--user-data-dir=" + profileDir,
		"--no-first-run", "--no-default-browser-check", "--window-size=1440,900", "--disable-features=Translate"}
	if runtime.GOOS != "windows" {
		args = append(args, "--class=openmaltforge") // regroupe la fenêtre sous l'icône OpenMaltForge du panneau
	}
	return exec.Command(browser, args...)
}

// InstallDesktop (Linux) crée si besoin l'entrée de menu et les icônes de l'utilisateur, pour que
// la fenêtre ait son icône même quand le binaire est lancé seul (sans paquet .deb).
// Renvoie true si l'entrée vient d'être créée ou modifiée.
func InstallDesktop() bool {
	if runtime.GOOS != "linux" {
		return false
	}
	if _, err := os.Stat("/usr/share/applications/openmaltforge.desktop"); err == nil {
		return false
	}
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	h, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	base := filepath.Join(h, ".local", "share")
	ents, _ := fs.ReadDir(iconFiles, "icons")
	for _, e := range ents {
		sz := strings.TrimSuffix(strings.TrimPrefix(e.Name(), "icon"), ".png")
		d := filepath.Join(base, "icons", "hicolor", sz+"x"+sz, "apps")
		if _, err := os.Stat(filepath.Join(d, "openmaltforge.png")); err == nil {
			continue
		}
		if b, err := iconFiles.ReadFile("icons/" + e.Name()); err == nil {
			_ = os.MkdirAll(d, 0o755)
			_ = os.WriteFile(filepath.Join(d, "openmaltforge.png"), b, 0o644)
		}
	}
	icon := filepath.Join(base, "icons", "hicolor", "256x256", "apps", "openmaltforge.png")
	desk := "[Desktop Entry]\nType=Application\nName=OpenMaltForge\nComment=Feuille de calcul de brassage\nExec=\"" + exe +
		"\"\nIcon=" + icon + "\nTerminal=false\nCategories=Utility;\nStartupWMClass=openmaltforge\nStartupNotify=true\nX-OpenMaltForge-Auto=true\n"
	f := filepath.Join(base, "applications", "openmaltforge.desktop")
	/* entrées de menu créées automatiquement sous les anciens noms (BrewCraft, OpenBrew) : retirées */
	for _, o := range [][2]string{{"brewcraft.desktop", "X-BrewCraft-Auto"}, {"openbrew.desktop", "X-OpenBrew-Auto"}} {
		if b, err := os.ReadFile(filepath.Join(base, "applications", o[0])); err == nil && strings.Contains(string(b), o[1]) {
			_ = os.Remove(filepath.Join(base, "applications", o[0]))
		}
	}
	if old, err := os.ReadFile(f); err == nil && (string(old) == desk || !strings.Contains(string(old), "X-OpenMaltForge-Auto")) {
		return false // déjà à jour, ou entrée écrite à la main par l'utilisateur
	}
	_ = os.MkdirAll(filepath.Dir(f), 0o755)
	_ = os.WriteFile(f, []byte(desk), 0o644)
	for _, c := range [][]string{{"update-desktop-database", "-q", filepath.Dir(f)},
		{"gtk-update-icon-cache", "-q", "-t", "-f", filepath.Join(base, "icons", "hicolor")}, {"kbuildsycoca5", "--noincremental"}} {
		if p, err := exec.LookPath(c[0]); err == nil {
			_ = exec.Command(p, c[1:]...).Run()
		}
	}
	return true
}
