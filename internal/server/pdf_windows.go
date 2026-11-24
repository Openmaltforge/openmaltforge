package server

import (
	"os/exec"
	"syscall"
)

// hideWindow : pas de fenêtre de console pour le navigateur sans fenêtre (Windows).
func hideWindow(c *exec.Cmd) {
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
}

// killTree arrête le navigateur (ses sous-processus s'arrêtent avec lui).
func killTree(c *exec.Cmd) {
	if c.Process != nil {
		c.Process.Kill()
	}
}
