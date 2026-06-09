#!/usr/bin/env node
/**
 * build.js — Génère une invitation Eventia Signature depuis un couple JSON
 *
 * Usage :
 *   node scripts/build.js --couple=marie-paul-yann
 *   node scripts/build.js --couple=sophie-thomas --dry-run
 *
 * Produit : dist/<couple-id>/  (clone complet prêt à déployer sur Netlify)
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

if (!args.couple) {
  console.error('Usage: node scripts/build.js --couple=<id> [--dry-run]');
  process.exit(1);
}

const ROOT      = path.dirname(__dirname);
const TMPL_DIR  = path.join(ROOT, '_template');
const DIST_DIR  = path.join(ROOT, 'dist', args.couple);
const DATA_FILE = path.join(ROOT, 'couples', `${args.couple}.json`);

if (!fs.existsSync(DATA_FILE)) {
  console.error(`❌  Fichier introuvable : ${DATA_FILE}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// ─── Aplatir toutes les valeurs du JSON en une map token → valeur ─────────────
function flatten(obj, map = {}) {
  for (const [, section] of Object.entries(obj)) {
    if (typeof section === 'object' && !Array.isArray(section)) {
      for (const [key, val] of Object.entries(section)) {
        if (typeof val === 'string') map[key] = val;
      }
    }
  }
  return map;
}

const tokens = flatten(data);

// ─── Substitution ────────────────────────────────────────────────────────────
function applyTokens(content, tokens) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (tokens[key] !== undefined) return tokens[key];
    // Token non résolu → on le laisse pour signaler le manque
    console.warn(`  ⚠️  Token non résolu : {{${key}}}`);
    return match;
  });
}

// ─── Blocs conditionnels ─────────────────────────────────────────────────────
// Les blocs optionnels sont marqués dans le HTML :
//   <!-- BLOC:notre-histoire:START --> ... <!-- BLOC:notre-histoire:END -->
// Si blocs_actifs[id] === false → le bloc est supprimé du HTML

function applyBlocs(content, blocs_actifs) {
  const inactive = Object.entries(blocs_actifs || {})
    .filter(([, active]) => !active)
    .map(([id]) => id);

  for (const id of inactive) {
    const re = new RegExp(
      `<!-- BLOC:${id}:START -->[\\s\\S]*?<!-- BLOC:${id}:END -->`,
      'g'
    );
    const before = content.length;
    content = content.replace(re, `<!-- BLOC:${id} désactivé -->`);
    if (content.length < before) {
      console.log(`  ○  Bloc "${id}" désactivé`);
    }
  }
  return content;
}

// ─── Copie du dossier template ────────────────────────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// ─── Build ────────────────────────────────────────────────────────────────────
function build() {
  console.log(`\n── Build Eventia Signature ──────────────────────────`);
  console.log(`   Couple  : ${args.couple}`);
  console.log(`   Univers : ${data._meta?.univers ?? 'défaut'}`);
  console.log(`   Palier  : ${data._meta?.tier ?? 'signature'}`);
  console.log(`   Sortie  : dist/${args.couple}/\n`);

  if (args['dry-run']) {
    console.log('  [DRY-RUN] Aucun fichier écrit.\n');
    const unresolved = [];
    const tmplContent = fs.readFileSync(path.join(TMPL_DIR, 'index.html'), 'utf8');
    const tokens_used = [...new Set([...tmplContent.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map(m => m[1]))];
    const missing = tokens_used.filter(k => tokens[k] === undefined);
    if (missing.length) {
      console.warn(`  ⚠️  Tokens manquants dans ${args.couple}.json :`);
      missing.forEach(k => console.warn(`      {{${k}}}`));
    } else {
      console.log(`  ✅  Tous les tokens sont résolus.`);
    }
    return;
  }

  // 1. Copie de l'arborescence template
  if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
  copyDir(TMPL_DIR, DIST_DIR);

  // 2. Traitement de chaque HTML
  const htmlFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) htmlFiles.push(full);
    }
  })(DIST_DIR);

  let totalTokens = 0;
  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    const before = (content.match(/\{\{[A-Z0-9_]+\}\}/g) || []).length;

    content = applyBlocs(content, data.blocs_actifs);
    content = applyTokens(content, tokens);

    const after = (content.match(/\{\{[A-Z0-9_]+\}\}/g) || []).length;
    totalTokens += (before - after);

    fs.writeFileSync(file, content, 'utf8');
    const rel = path.relative(DIST_DIR, file);
    console.log(`  ✓  ${rel} — ${before - after} tokens résolus${after > 0 ? ` (${after} manquants)` : ''}`);
  }

  // 3. Rapport
  const distSize = getDirSize(DIST_DIR);
  console.log(`\n  TOTAL   : ${totalTokens} tokens résolus`);
  console.log(`  TAILLE  : ${(distSize / 1024).toFixed(0)} Ko`);
  console.log(`  URL     : https://${data._meta?.slug ?? args.couple}.netlify.app`);
  console.log(`\n  ✅  dist/${args.couple}/ prêt pour netlify deploy\n`);
}

function getDirSize(dir) {
  let size = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) size += getDirSize(full);
    else size += fs.statSync(full).size;
  }
  return size;
}

build();
