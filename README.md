# Chult Map Online

Diese Version arbeitet absichtlich nur online mit Supabase.

Es gibt keinen localStorage Fallback mehr. Wenn Supabase nicht eingerichtet ist, zeigt die Seite einen Hinweis und erlaubt keine Marker.

## 1. Supabase Projekt erstellen

Erstelle ein neues Projekt unter Supabase.

## 2. Datenbank einrichten

Öffne im Supabase Dashboard den SQL Editor.

Kopiere den kompletten Inhalt aus:

`supabase/setup.sql`

Führe das SQL aus.

Damit wird die Tabelle `markers` erstellt und Realtime aktiviert.

## 3. Project URL und anon key kopieren

Öffne in Supabase die Projekteinstellungen und dort den API Bereich.

Du brauchst:

* Project URL
* anon public key

## 4. config.js bearbeiten

Öffne `config.js`.

Trage deine Werte ein:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://DEINPROJEKT.supabase.co",
  SUPABASE_ANON_KEY: "DEIN_ANON_KEY"
};
```

Der anon key ist dafür gedacht, in einer Browser Anwendung verwendet zu werden.

Verwende niemals einen service_role key in dieser Datei.

## 5. GitHub aktualisieren

Ersetze in deinem GitHub Repository die alten Dateien durch die Dateien aus dieser ZIP.

Danach veröffentlicht GitHub Pages die neue Version automatisch.

## Verhalten

Wenn Spieler A einen Marker erstellt, wird er in Supabase gespeichert.

Spieler B sieht ihn ebenfalls.

Wenn die Seite bei beiden gleichzeitig geöffnet ist, werden Änderungen über Supabase Realtime übertragen.

## Achtung

Die aktuelle SQL Konfiguration erlaubt jedem Besucher mit Zugriff auf die Webseite:

* Marker zu lesen
* Marker zu erstellen
* Marker zu bearbeiten
* Marker zu löschen

Das ist für einen ersten privaten Test gedacht.

Eine spätere Version kann einen Gruppencode oder getrennte Rechte erhalten.
