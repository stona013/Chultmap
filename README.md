# Chult Map Update

Dieses Update ergänzt die bestehende Karte um zwei gemeinsame Funktionen.

## Tage Unterwegs

Oben in der Leiste befindet sich der Zähler `Tage Unterwegs`.
Mit Plus wird der Wert erhöht. Mit Minus wird er reduziert.
Der Wert wird in Supabase gespeichert und ist damit für alle Besucher gleich.

## Notizbuch

Über `Notizbuch` öffnet sich ein gemeinsames Notizbuch.
Dort können Seiten erstellt, bearbeitet und gelöscht werden.
Jede Seite besitzt einen Titel und einen frei beschreibbaren Inhalt.
Alle Seiten werden in Supabase gespeichert.

## Installation

1. Führe `supabase/tracker_notebook.sql` im Supabase SQL Editor aus.
2. Ersetze auf GitHub `index.html`, `style.css` und `app.js` mit den Dateien aus diesem Update.
3. Lass deine bestehende `config.js` unverändert.
4. Lass `assets/Chult-map.webp` unverändert.
5. Warte auf das GitHub Pages Deployment und lade die Seite vollständig neu.
