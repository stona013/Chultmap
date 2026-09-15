# Chult Map Demo

Diese Version ist für einen ersten Test gedacht und kann direkt über GitHub Pages veröffentlicht werden.

## Was bereits funktioniert

* Die Chult Karte wird als interaktive Karte angezeigt.
* Zoomen und Verschieben funktioniert.
* Über "Marker setzen" kann ein neuer Marker auf der Karte angelegt werden.
* Marker besitzen Titel, Kategorie und Notiz.
* Marker können bearbeitet und gelöscht werden.
* Marker können als JSON exportiert werden.
* Ohne weitere Einrichtung werden Marker lokal im Browser gespeichert.
* Optional kann Supabase aktiviert werden. Dann sehen alle Besucher dieselben Marker und Änderungen werden automatisch synchronisiert.

## Schnelltest ohne Supabase

1. Lade den Ordner auf einen Webserver oder auf GitHub Pages.
2. Öffne die Seite.
3. Klicke oben auf "Marker setzen".
4. Klicke auf eine Stelle der Karte.
5. Trage Titel und Notiz ein und speichere den Marker.

Wichtig: Im lokalen Modus sieht nur der jeweilige Browser seine eigenen Marker.

## GitHub Pages

1. Erstelle auf GitHub ein neues Repository, zum Beispiel `chult-map`.
2. Lade alle Dateien aus diesem Ordner in das Repository hoch.
3. Öffne im Repository `Settings`.
4. Öffne `Pages`.
5. Wähle unter `Build and deployment` die Option `Deploy from a branch`.
6. Wähle den Branch `main` und den Ordner `/root`.
7. Speichere die Einstellung.

Nach kurzer Zeit stellt GitHub eine öffentliche URL für die Karte bereit.

## Gemeinsame Marker mit Supabase

Für gemeinsame Marker wird ein kostenloses Supabase Projekt benötigt.

1. Erstelle ein Supabase Projekt.
2. Öffne dort den SQL Editor.
3. Kopiere den Inhalt von `supabase/setup.sql` in den SQL Editor und führe ihn aus.
4. Öffne in Supabase die API Einstellungen deines Projekts.
5. Kopiere die Project URL und den öffentlichen anon key.
6. Öffne `config.js`.
7. Trage beide Werte ein.

Beispiel:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://deinprojekt.supabase.co",
  SUPABASE_ANON_KEY: "DEIN_ANON_KEY"
};
```

Danach arbeitet die Seite automatisch im gemeinsamen Modus.

## Sicherheit

Die mitgelieferte SQL Datei erlaubt absichtlich jedem Besucher das Lesen, Erstellen, Bearbeiten und Löschen von Markern. Das ist für einen ersten privaten Test einfach, aber nicht für eine stark öffentlich beworbene Seite geeignet.

Für eine spätere Version sollte mindestens ein Gruppencode oder ein anderes einfaches Berechtigungssystem ergänzt werden.

## Dateien

* `index.html` enthält die Seite.
* `style.css` enthält das Design.
* `app.js` enthält Kartenlogik, Marker und Speicherung.
* `config.js` enthält optional die Supabase Zugangsdaten.
* `assets/chult-map.png` ist die Karte.
* `supabase/setup.sql` erstellt die Datenbanktabelle und die Zugriffsregeln.
