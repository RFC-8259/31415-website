# 31415.me

Eine Sammlung kleiner Web-Werkzeuge. Statisch, ohne Build-Schritt, ohne
Abhängigkeiten — Cloudflare Pages liefert das Repository so aus, wie es hier
liegt. Jedes Werkzeug läuft vollständig im Browser des Besuchers; es gibt kein
Backend und keine Analytik.

## Architektur

```
/                     index.html          Startseite mit der Werkzeugübersicht
/<werkzeug>/          index.html          je Werkzeug ein Ordner, eine Datei
/assets/chrome.css                        gemeinsames Aussehen aller Seiten
/assets/chrome.js                         gemeinsames Verhalten aller Seiten
/assets/favicon.svg
404.html                                  von Cloudflare Pages automatisch genutzt
_headers                                  Sicherheits- und Cache-Header
robots.txt, sitemap.xml, site.webmanifest
tools/check.mjs                           Konsistenzprüfung (siehe unten)
```

**Ein Ordner je Werkzeug ist Absicht.** Daraus ergeben sich saubere Adressen
(`/subnetting/` statt `/subnetting.html`), jede Seite ist unabhängig
auslieferbar und cachebar, und ein defektes Werkzeug kann kein anderes
mitreißen. Was die Struktur früher gekostet hat, war die Verdopplung *innerhalb*
der Dateien — dafür gibt es jetzt `assets/chrome.*` und `tools/check.mjs`.

### Was aus assets/ kommt — und nicht in eine Seite gehört

`assets/chrome.css` ist die einzige Quelle für:

* Farbtokens (`--ink`, `--paper`, `--gold`, …) für hell und dunkel,
* Grundlayout: `.wrap`/`.container` (Aliasse, 1180 px breit, 28 px Rand) und
  `.layer` — Letzteres hebt Inhalt nur über Ziffernregen und Korn, **ohne**
  Breite und Polsterung. Wer dafür `.wrap` nimmt, bekommt die Polsterung
  doppelt,
* Kopfleiste, Seitenkopf (`.app-head`), Footer, Toast, `.skip-link`,
* die Scroll-Einblendung `.reveal` und den Tastaturfokus.

`assets/chrome.js` ist die einzige Quelle für:

* das Theme (folgt dem Betriebssystem, bis jemand den Schalter benutzt),
* den Pi-Ziffernregen auf `#digit-field`,
* die Scroll-Einblendung inkl. nachgeladener Inhalte (`revealScan()`),
* `window.showToast(text[, dauerMs])`,
* den Karten-Spotlight (`--mx`/`--my`) für alle Klassen aus
  `SPOTLIGHT_SELECTOR` — ein delegierter Listener für die ganze Seite,
* `[data-year]` im Footer.

Eine neue Seite bindet beides ein und schreibt in ihr eigenes `<style>`/`<script>`
**nur**, was es wirklich nur auf dieser Seite gibt.

### Aufbau einer Werkzeugseite

```html
<html lang="de">
<head>
  <!-- charset, viewport, theme-color, title, description -->
  <!-- canonical, favicon, manifest, Open Graph -->
  <!-- Google Fonts -->
  <link rel="stylesheet" href="/assets/chrome.css">
  <script src="/assets/chrome.js"></script>
  <style>/* nur Seitenspezifisches */</style>
</head>
<body>
  <a class="skip-link" href="#content">Zum Inhalt springen</a>
  <canvas id="digit-field" aria-hidden="true"></canvas>
  <div class="grain" aria-hidden="true"></div>
  <header><div class="header-inner">…</div></header>
  <div class="app-head reveal">…</div>
  <main id="content" class="wrap">…</main>
  <footer><div class="footer-inner">…</div></footer>
  <script>/* nur Seitenspezifisches */</script>
</body>
</html>
```

Innerhalb von `<main>` bekommt genau ein Element die Inhaltsbreite. Eine
zusätzliche Hülle über der ganzen Seite ist `.layer`, nicht `.wrap`.

`chrome.js` steht bewusst **ohne `defer`** im `<head>`: es setzt das Theme,
bevor der erste Pixel gezeichnet wird, sonst blitzt beim Laden das falsche
Farbschema auf.

## Prüfen

```bash
node tools/check.mjs                  # prüft alle Seiten, Exit 1 bei Befund
node tools/check.mjs --write-sitemap  # sitemap.xml neu erzeugen
```

Ohne Build-Schritt gibt es nichts, was Regeln automatisch erzwingt — das
übernimmt dieses Skript (und derselbe Aufruf in GitHub Actions). Es prüft, dass
jede Seite das gemeinsame Chrome einbindet, Titel, Beschreibung, `canonical`,
Open Graph, Favicon, Manifest und Sprungmarke besitzt, dass keine Seite etwas
aus `assets/` nachbaut, dass Inline-Skripte parsen, dass interne Verweise
irgendwo hinführen und dass `sitemap.xml` zu den vorhandenen Ordnern passt.

Lokal ansehen — jeder statische Server tut es, wichtig ist nur, dass `/` als
Wurzel dient (die Seiten verweisen absolut auf `/assets/…`):

```bash
python3 -m http.server 8080
```

## Neues Werkzeug anlegen

1. Ordner mit `index.html` nach obigem Aufbau anlegen.
2. Karte auf der Startseite ergänzen — Verweis **mit** Schrägstrich am Ende
   (`/neues-werkzeug/`), das spart eine Umleitung.
3. `node tools/check.mjs --write-sitemap` ausführen.
4. Committen. Cloudflare Pages veröffentlicht den Stand der Standard-Branch.

## Hosting

Cloudflare Pages beobachtet dieses Repository und veröffentlicht ohne
Build-Befehl. Zwei Dateien steuern die Auslieferung:

* **`_headers`** — Sicherheits-Header (CSP, `nosniff`, `frame-ancestors`,
  Permissions-Policy, HSTS) und Cache-Regeln.
* **`404.html`** — wird für unbekannte Pfade ausgeliefert.

## Bekannte Abstriche

Bewusste Kompromisse, damit sie nicht später als Versehen gelesen werden:

* **`'unsafe-inline'` in der CSP.** Seiten-CSS und -JS stehen inline im
  Dokument. Das spart pro Werkzeug zwei Anfragen, verhindert aber eine strenge
  CSP. Auslagern nach `/<werkzeug>/app.css|app.js` würde `'unsafe-inline'`
  überflüssig machen — dann bitte die CSP in `_headers` mitziehen.
* **Kein langer Cache für `/assets/`.** `chrome.css` und `chrome.js` tragen
  keinen Hash im Namen, deshalb wird bei jedem Aufruf revalidiert. Ein
  Dateiname wie `chrome.8f3a1c.css` würde `max-age=31536000, immutable`
  erlauben — dann braucht es aber einen Build-Schritt.
* **Schriften von Google Fonts.** Das ist ein Drittanbieter im kritischen
  Ladepfad. Selbst gehostete `woff2`-Dateien unter `/assets/fonts/` wären
  schneller und datensparsamer; die CSP könnte dann auf `default-src 'self'`
  zusammenschrumpfen.
* **HSTS ohne `includeSubDomains`.** In `_headers` steht bewusst nur
  `max-age=31536000`. Die Erweiterung ist bindend und sollte erst gesetzt
  werden, wenn wirklich jede Subdomain dauerhaft per HTTPS erreichbar ist.
* **Kein PNG-Icon.** `favicon.svg` deckt aktuelle Browser ab; für ältere
  Safari-Versionen und Android-Startbildschirme fehlt ein 192/512-PNG.
