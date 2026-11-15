//go:build !windows

package desktop

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

func candidates() []string {
	if runtime.GOOS == "darwin" {
		/* macOS : navigateurs installés dans /Applications (ou ~/Applications) */
		var l []string
		home, _ := os.UserHomeDir()
		for _, a := range []string{"Google Chrome.app/Contents/MacOS/Google Chrome", "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"Brave Browser.app/Contents/MacOS/Brave Browser", "Chromium.app/Contents/MacOS/Chromium", "Vivaldi.app/Contents/MacOS/Vivaldi"} {
			l = append(l, "/Applications/"+a, home+"/Applications/"+a)
		}
		return l
	}
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
	if runtime.GOOS == "darwin" {
		q := strings.ReplaceAll(strings.ReplaceAll(msg, "\\", "\\\\"), `"`, `\"`)
		_ = exec.Command("osascript", "-e", `display alert "OpenMaltForge" message "`+q+`" as critical`).Run()
		return
	}
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
