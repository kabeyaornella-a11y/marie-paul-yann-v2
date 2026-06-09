#!/usr/bin/env node
/**
 * build.js — Génère une invitation Eventia Signature
 *
 * Résolution des blocs actifs :
 *   blocs_actifs = blocs_toujours_actifs
 *               + blocs_inclus[palier]
 *               + options_achetees (blocs supplémentaires payés)
 *
 * Usage :
 *   node scripts/build.js --couple=marie-paul-yann
 *   node scripts/build.js --couple=sophie-thomas --dry-run
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

if (!args.couple) {
  console.error('Usage: node scripts/build.js --couple=<id> [--dry-run]');
  process.exit(1);
}

const ROOT       = path.dirname(__dirname);
const TMPL_DIR   = path.join(ROOT, '_template');
const DIST_DIR   = path.join(ROOT, 'dist', args.couple);
const DATA_FILE  = path.join(ROOT, 'couples',  `${args.couple}.json`);
const TIERS_FILE = path.join(ROOT, 'config',   'tiers.json');

for (const f of [DATA_FILE, TIERS_FILE]) {
  if (!fs.existsSync(f)) { console.error(`❌  Fichier manquant : ${f}`); process.exit(1); }
}

const data  = JSON.parse(fs.readFileSync(DATA_FILE,  'utf8'));
const tiers = JSON.parse(fs.readFileSync(TIERS_FILE, 'utf8'));

// ─── Résolution des blocs actifs ─────────────────────────────────────────────
function resolveBlocs(data, tiers) {
  const commande = data.commande || {};
  const palier   = commande.palier || 'essentielle';
  const options  = commande.options_achetees || [];

  const palierDef = tiers.paliers[palier];
  if (!palierDef) {
    console.warn(`  ⚠️  Palier inconnu : "${palier}" — utilisation de "essentielle"`);
  }

  const inclus    = (palierDef || tiers.paliers.essentielle).blocs_inclus;
  const actifs    = new Set([
    ...tiers.blocs_toujours_actifs,
    ...inclus,
    ...options,
  ]);

  // Tous les blocs optionnels = union de tous les paliers
  const tousOptionnels = Object.keys(tiers.options);
  const result = {};
  for (const id of tousOptionnels) {
    result[id] = actifs.has(id);
  }

  return { actifs: result, palier, inclus, options };
}

const { actifs: blocsActifs, palier, inclus, options } = resolveBlocs(data, tiers);

// ─── Aplatir les tokens ───────────────────────────────────────────────────────
function flatten(obj) {
  const map = {};
  for (const section of Object.values(obj)) {
    if (typeof section === 'object' && !Array.isArray(section)) {
      for (const [k, v] of Object.entries(section)) {
        if (typeof v === 'string') map[k] = v;
      }
    }
  }
  return map;
}

const tokens = flatten(data);

// ─── Substitution tokens ──────────────────────────────────────────────────────
function applyTokens(content) {
  let unresolved = 0;
  const result = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (tokens[key] !== undefined) return tokens[key];
    console.warn(`  ⚠️  Token non résolu : {{${key}}}`);
    unresolved++;
    return match;
  });
  return { result, unresolved };
}

// ─── Suppression des blocs inactifs ──────────────────────────────────────────
function applyBlocs(content) {
  let removed = 0;
  for (const [id, active] of Object.entries(blocsActifs)) {
    if (!active) {
      const re = new RegExp(
        `<!-- BLOC:${id}:START -->[\\s\\S]*?<!-- BLOC:${id}:END -->`,
        'g'
      );
      if (re.test(content)) {
        content = content.replace(re, `<!-- BLOC:${id} désactivé -->`);
        removed++;
        console.log(`  ○  Bloc "${id}" désactivé (hors palier/options)`);
      }
    }
  }
  return { result: content, removed };
}

// ─── Injection CSS univers ────────────────────────────────────────────────────
function applyUnivers(content) {
  const univers = data._meta?.univers;
  if (!univers) return content;
  const cssFile = `univers/${univers}.css`;
  const cssPath = path.join(DIST_DIR, cssFile);
  if (!fs.existsSync(cssPath)) {
    console.warn(`  ⚠️  CSS univers introuvable : ${cssFile}`);
    return content;
  }
  const tag = `<link rel="stylesheet" href="${cssFile}">`;
  // Injecter après <head> ou avant le premier <link>
  // Injecter juste avant le premier <link rel="stylesheet" ou après <head>
  return content.replace(/<head>/, `<head>\n  ${tag}`);
}

// ─── Copie récursive ──────────────────────────────────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function getDirSize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((acc, e) => {
    const full = path.join(dir, e.name);
    return acc + (e.isDirectory() ? getDirSize(full) : fs.statSync(full).size);
  }, 0);
}

// ─── Dry-run ─────────────────────────────────────────────────────────────────
function dryRun() {
  const tmpl = fs.readFileSync(path.join(TMPL_DIR, 'index.html'), 'utf8');
  const used  = [...new Set([...tmpl.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map(m => m[1]))];
  const missing = used.filter(k => tokens[k] === undefined);

  console.log('\n── Dry-run ──────────────────────────────────────────');
  console.log(`   Palier          : ${palier} (${tiers.paliers[palier]?.prix_base} €)`);
  console.log(`   Blocs du palier : ${inclus.length ? inclus.join(', ') : 'aucun'}`);
  console.log(`   Options payées  : ${options.length ? options.join(', ') : 'aucune'}`);
  console.log(`\n   Blocs actifs    :`);
  for (const [id, active] of Object.entries(blocsActifs)) {
    const opt = tiers.options[id];
    const prix = opt ? `+${opt.prix} €` : '';
    console.log(`     ${active ? '✅' : '○ '} ${id.padEnd(20)} ${prix}`);
  }
  if (missing.length) {
    console.warn(`\n   ⚠️  Tokens manquants dans ${args.couple}.json :`);
    missing.forEach(k => console.warn(`      {{${k}}}`));
  } else {
    console.log(`\n   ✅  Tous les tokens sont résolus.`);
  }
  console.log('');
}

// ─── Build ────────────────────────────────────────────────────────────────────
function build() {
  console.log(`\n── Build Eventia Signature ──────────────────────────`);
  console.log(`   Couple   : ${args.couple}`);
  console.log(`   Palier   : ${palier} (${tiers.paliers[palier]?.prix_base} €)`);
  console.log(`   Options  : ${options.length ? options.join(', ') : 'aucune'}`);
  console.log(`   Sortie   : dist/${args.couple}/\n`);

  if (args['dry-run']) return dryRun();

  if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
  copyDir(TMPL_DIR, DIST_DIR);

  // Traitement de tous les HTML
  let totalTokens = 0, totalRemoved = 0;

  const htmlFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      e.isDirectory() ? walk(full) : e.name.endsWith('.html') && htmlFiles.push(full);
    }
  })(DIST_DIR);

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    const { result: afterBlocs, removed } = applyBlocs(content);
    const afterUnivers = file.endsWith('index.html') && path.dirname(file) === DIST_DIR
      ? applyUnivers(afterBlocs)
      : afterBlocs;
    const { result: afterTokens, unresolved } = applyTokens(afterUnivers);
    fs.writeFileSync(file, afterTokens, 'utf8');

    const tokensResolved = (content.match(/\{\{[A-Z0-9_]+\}\}/g) || []).length - unresolved;
    totalTokens  += tokensResolved;
    totalRemoved += removed;

    const rel = path.relative(DIST_DIR, file);
    console.log(`  ✓  ${rel} — ${tokensResolved} tokens, ${removed} blocs supprimés`);
  }

  const ko = Math.round(getDirSize(DIST_DIR) / 1024);
  console.log(`\n  TOKENS  : ${totalTokens} résolus`);
  console.log(`  BLOCS   : ${totalRemoved} désactivés`);
  console.log(`  TAILLE  : ${ko} Ko`);
  console.log(`  URL     : https://${data._meta?.slug ?? args.couple}.netlify.app`);
  console.log(`\n  ✅  dist/${args.couple}/ prêt pour : netlify deploy --prod --dir=dist/${args.couple}\n`);
}

build();
