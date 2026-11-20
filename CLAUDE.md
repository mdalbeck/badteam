# Hinweise für Claude

## Veröffentlichen
- Schreibt der Nutzer nur **„pushen“** (oder „push“), heißt das: die fertigen Änderungen
  ohne weitere Rückfrage auf `main` bringen (Arbeitsbranch in `main` mergen, `main` pushen,
  Arbeitsbranch auf denselben Stand bringen). Vorher kurz testen; bei Merge-Konflikten
  oder roten Tests nachfragen statt pushen.
- Am Ende einer Änderung nicht lang fragen, sondern kurz: „Sag ‚pushen‘, dann geht’s online.“
- Bei Änderungen an `js/`, `styles.css` oder `index.html` die Cache-Version in `sw.js`
  (`bt-shell-vNN`) erhöhen, sonst laden installierte Apps die neue Version nicht.
