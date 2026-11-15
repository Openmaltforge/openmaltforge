// Package web embarque l'interface : HTML, CSS, JavaScript sans framework, icône.
package web

import "embed"

//go:embed index.html icon.png css js lib doc
var FS embed.FS
