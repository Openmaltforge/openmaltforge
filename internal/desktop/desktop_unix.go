//go:build !windows

package desktop

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

func candidates() []string {
	return []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
		"microsoft-edge", "microsoft-edge-stable", "brave-browser", "brave-browser-stable", "vivaldi-stable"}
}

// OpenURL ouvre une adresse dans le navigateur habituel de l'utilisateur.
func OpenURL(u string) error {
	name, args := "xdg-open", []string{u}
	if runtime.GOOS == "darwin" {
		name = "open"
	}
	c := exec.Command(name, args...)
	if err := c.Start(); err != nil {
		return err
	}
	go c.Wait() // pas de processus zombie
	return nil
}

// Alert affiche un message d'erreur graphique si possible (lancement depuis le menu).
func Alert(msg string) {
	fmt.Fprintln(os.Stderr, "OpenMaltForge : "+msg)
	for _, c := range [][]string{
		{"zenity", "--error", "--title=OpenMaltForge", "--text=" + msg},
		{"kdialog", "--title", "OpenMaltForge", "--error", msg},
		{"notify-send", "-a", "OpenMaltForge", "OpenMaltForge", msg},
	} {
		if p, err := exec.LookPath(c[0]); err == nil {
			_ = exec.Command(p, c[1:]...).Run()
			return
		}
	}
}
