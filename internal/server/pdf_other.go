//go:build !windows

package server

import (
	"os/exec"
	"syscall"
)

// hideWindow : groupe de processus à part, pour tout arrêter à la fin.
func hideWindow(c *exec.Cmd) { c.SysProcAttr = &syscall.SysProcAttr{Setpgid: true} }

// killTree arrête le navigateur et ses sous-processus (groupe de processus).
func killTree(c *exec.Cmd) {
	if c.Process != nil {
		syscall.Kill(-c.Process.Pid, syscall.SIGKILL)
		c.Process.Kill()
	}
}
