#!/usr/bin/env node
/**
 * Konsistenzprüfung für 31415.me
 * ---------------------------------------------------------------------------
 * Die Seite kommt ohne Build-Schritt aus: Cloudflare Pages liefert die Dateien
 * aus dem Repository unverändert aus. Damit die 18 Seiten trotzdem nicht
 * auseinanderlaufen, prüft dieses Skript die Regeln, die ein Build sonst
 * erzwingen würde.
 *
 *   node tools/check.mjs                  prüfen (Exit 1 bei Befund)
 *   node tools/check.mjs --write-sitemap  sitemap.xml neu schreiben
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://31415.me';

const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

/* ---------- Seiten einsammeln ---------- */
const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'assets' && e.name !== 'tools')
  .map(e => e.name)
  .filter(name => {
    try { return statSync(join(ROOT, name, 'index.html')).isFile(); } catch { return false; }
  })
  .sort();

const pages = [{ file: 'index.html', url: '/' }, ...dirs.map(d => ({ file: `${d}/index.html`, url: `/${d}/` }))];
/* 404.html wird von Cloudflare Pages für unbekannte Pfade ausgeliefert. Sie
   trägt dasselbe Chrome, gehört aber weder in die Sitemap noch in den Index. */
const checked = [...pages, { file: '404.html', url: null }];

/* ---------- 1. Jede Seite trägt das gemeinsame Chrome und vollständige Metadaten ---------- */
const REQUIRED = [
  ['<html lang="de">',                             'kein lang="de" am <html>'],
  ['<link rel="stylesheet" href="/assets/chrome.css">', 'assets/chrome.css nicht eingebunden'],
  ['<script src="/assets/chrome.js"></script>',    'assets/chrome.js nicht eingebunden'],
  ['<link rel="icon" href="/assets/favicon.svg"',  'kein Favicon'],
  ['<link rel="manifest" href="/site.webmanifest">', 'kein Web-App-Manifest'],
  ['<meta name="description"',                     'keine Meta-Beschreibung'],
  ['<meta name="theme-color"',                     'keine theme-color'],
  ['class="skip-link"',                            'keine Sprungmarke zum Inhalt'],
];

/* Nur für Seiten, die im Index landen sollen — die 404 gehört nicht dazu. */
const REQUIRED_INDEXED = [
  ['<meta property="og:title"',                    'keine Open-Graph-Daten'],
  ['<meta property="og:description"',              'keine Open-Graph-Beschreibung'],
];

/* ---------- 2. Was in assets/ steht, gehört nicht in die Seite ---------- */
const DUPLICATES = [
  [/function\s+showToast\b/,        'eigene showToast-Umsetzung — window.showToast aus chrome.js nutzen'],
  [/setProperty\('--mx'/,           'eigener Karten-Spotlight — chrome.js erledigt das delegiert'],
  [/:root\s*\{[^}]*--ink\s*:/,      'Farbtokens neu definiert — sie stehen in chrome.css'],
  [/\.(?:wrap|container)\s*\{[^}]*max-width:\s*1180px/, 'Inhaltsbreite neu definiert — .wrap/.container kommen aus chrome.css'],
  [/getElementById\('themeToggle'\)/, 'eigene Theme-Umschaltung — chrome.js hängt sich selbst an den Schalter'],
];

const html = new Map();
for (const { file } of checked) html.set(file, readFileSync(join(ROOT, file), 'utf8'));

for (const { file, url } of checked) {
  const s = html.get(file);

  for (const [needle, msg] of REQUIRED) if (!s.includes(needle)) fail(file, msg);
  if (url) for (const [needle, msg] of REQUIRED_INDEXED) if (!s.includes(needle)) fail(file, msg);
  for (const [re, msg] of DUPLICATES)   if (re.test(s))          fail(file, msg);

  if (url) {
    const canonical = `<link rel="canonical" href="${SITE}${url}">`;
    if (!s.includes(canonical)) fail(file, `canonical fehlt oder zeigt nicht auf ${SITE}${url}`);
  }

  const title = s.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
  if (!title.trim()) fail(file, 'kein <title>');
  if (file !== 'index.html' && !title.endsWith('— 31415.me')) fail(file, `Titel endet nicht auf "— 31415.me": ${title}`);

  /* Sprungmarke muss auf ein vorhandenes Ziel zeigen. */
  const target = s.match(/class="skip-link" href="#([\w-]+)"/)?.[1];
  if (target && !s.includes(`id="${target}"`)) fail(file, `Sprungmarke zeigt auf #${target}, das es nicht gibt`);

  /* Inline-Skripte müssen wenigstens fehlerfrei parsen. */
  const scripts = [...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  scripts.forEach((m, i) => {
    try { new vm.Script(m[1]); }
    catch (e) { fail(file, `Inline-Skript #${i + 1} ist syntaktisch fehlerhaft: ${e.message}`); }
  });

  /* Interne Verweise müssen auf etwas Ausgeliefertes zeigen. */
  for (const m of s.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
    const p = m[1];
    const candidates = p.endsWith('/') ? [join(ROOT, p, 'index.html')] : [join(ROOT, p)];
    if (!candidates.some(c => { try { return statSync(c).isFile(); } catch { return false; } })) {
      fail(file, `toter interner Verweis: ${p}`);
    }
  }
}

/* ---------- 3. sitemap.xml deckt sich mit den vorhandenen Seiten ---------- */
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map(p => `  <url><loc>${SITE}${p.url}</loc></url>`),
  '</urlset>',
  '',
].join('\n');

if (process.argv.includes('--write-sitemap')) {
  writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`sitemap.xml geschrieben — ${pages.length} Seiten.`);
} else {
  let current = '';
  try { current = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'); } catch {}
  if (current !== sitemap) fail('sitemap.xml', 'nicht mehr aktuell — "node tools/check.mjs --write-sitemap" ausführen');
}

/* ---------- Ergebnis ---------- */
if (problems.length) {
  console.error(`\n${problems.length} Befund(e):\n`);
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('');
  process.exit(1);
}
console.log(`Alles in Ordnung — ${checked.length} Seiten geprüft.`);
