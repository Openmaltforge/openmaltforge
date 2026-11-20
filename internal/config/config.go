// Package config : version de l'application (fixée à la compilation par -ldflags -X).
package config

// Version d'OpenMaltForge ; remplacée par scripts/build.sh (-X openmaltforge/internal/config.Version=x.y.z).
var Version = "6.8.0"

// DonURL : page de don (Ko-fi) ouverte par l'icône café de l'en-tête, dans le navigateur habituel.
// Vide = pas encore renseignée (l'icône l'indique). Seule cette adresse peut être ouverte par /api/don.
var DonURL = "https://ko-fi.com/G7U82APSVO"
