//go:build windows

package desktop

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

func candidates() []string {
	var c []string
	for _, r := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LocalAppData")} {
		if r == "" {
			continue
		}
		c = append(c,
			filepath.Join(r, `Microsoft\Edge\Application\msedge.exe`),
			filepath.Join(r, `Google\Chrome\Application\chrome.exe`),
			filepath.Join(r, `BraveSoftware\Brave-Browser\Application\brave.exe`))
	}
	return c
}

// OpenURL ouvre une adresse dans le navigateur habituel de l'utilisateur.
func OpenURL(u string) error {
	c := exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	if err := c.Start(); err != nil {
		return err
	}
	go c.Wait()
	return nil
}

// Alert affiche une boîte de message Windows.
func Alert(msg string) {
	u := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString("OpenMaltForge")
	m, _ := syscall.UTF16PtrFromString(msg)
	u.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}
