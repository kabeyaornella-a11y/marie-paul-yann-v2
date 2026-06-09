# Guide d'utilisation — Eventia Signature

## Vue d'ensemble en 2 minutes

```
Un couple passe commande
        ↓
Tu crées son fichier JSON  →  couples/prenom1-prenom2.json
        ↓
Tu lances la construction  →  node scripts/build.js --couple=prenom1-prenom2
        ↓
Un dossier dist/ est créé  →  dist/prenom1-prenom2/index.html (prêt à déployer)
```

### Les fichiers importants

| Fichier | Rôle |
|---|---|
| `couples/marie-paul-yann.json` | Les données du couple (noms, date, lieux, photos…) |
| `config/tiers.json` | Définition des paliers et prix des options |
| `_template/index.html` | L'invitation de base avec des marqueurs `{{TOKEN}}` et `<!-- BLOC -->` |
| `_template/univers/*.css` | Les 4 ambiances visuelles |
| `scripts/build.js` | La machine qui assemble tout |

---

## Workflow 1 : Nouvelle commande (cas simple)

### Étape 1 — Créer le fichier JSON du couple

Copier le fichier existant comme point de départ :

```bash
cp couples/marie-paul-yann.json couples/sophie-thomas.json
```

Puis remplir les valeurs dans `couples/sophie-thomas.json` :

```json
{
  "_meta": {
    "id": "sophie-thomas",
    "univers": "les-voiles",
    "slug": "sophie-thomas-2027"
  },
  "couple": {
    "PRENOM_1": "Sophie",
    "PRENOM_2": "Thomas",
    "PRENOMS": "Sophie & Thomas",
    "PRENOMS_ET": "Sophie et Thomas",
    "PRENOMS_HTML": "Sophie &amp; Thomas",
    "ANNEE_MARIAGE": "2027"
  },
  "commande": {
    "palier": "essentielle",
    "options_achetees": [],
    "prix_total": 179,
    "date_commande": "2026-06-15",
    "statut": "livree"
  }
}
```

### Étape 2 — Choisir le palier

| Palier | Prix | Blocs inclus |
|---|---|---|
| `essentielle` | 179 € | Seulement les blocs de base |
| `signature` | 269 € | + Notre Histoire, Dress Code, Empreintes |
| `exception` | 549 € | + tout : Hébergements, Activités, Cadeaux |

### Étape 3 — Construire l'invitation

```bash
node scripts/build.js --couple=sophie-thomas
```

L'invitation est générée dans `dist/sophie-thomas/`.

### Étape 4 — Tester en local

```bash
npx serve dist/sophie-thomas
```
Puis ouvrir http://localhost:3000

### Étape 5 — Déployer sur Netlify

```bash
netlify deploy --prod --dir=dist/sophie-thomas --site=ID_DU_SITE
```

---

## Workflow 2 : Commande avec options payantes

Un couple choisit **L'Essentielle à 179 €**, puis ajoute en option :
- Notre Histoire (+20 €)
- Hébergements (+20 €)

Total : 179 + 20 + 20 = **219 €**

Dans le JSON :

```json
"commande": {
  "palier": "essentielle",
  "options_achetees": ["notre-histoire", "hebergements"],
  "prix_total": 219,
  "date_commande": "2026-06-15",
  "statut": "livree"
}
```

Le script `build.js` active automatiquement les blocs correspondants.

### Tarifs des options (config/tiers.json)

| Option | Prix |
|---|---|
| Notre Histoire | +20 € |
| Dress Code | +15 € |
| Nos Empreintes | +15 € |
| Hébergements | +20 € |
| Activités | +20 € |
| Liste de cadeaux | +15 € |

---

## Workflow 3 : Changer l'univers visuel

Modifier `_meta.univers` dans le JSON du couple :

```json
"_meta": {
  "univers": "les-voiles"
}
```

Les 4 univers disponibles :

| Univers | Ambiance | Couleurs |
|---|---|---|
| `les-seuils` | Ivoire chaud, or, brun-vanille | Défaut Marie-Paul & Yann |
| `les-voiles` | Blanc pur, argent nacré, bleu nuit | Mariage en bord de mer |
| `les-ecrins` | Vert forêt, or chaud, crème écru | Château dans les bois |
| `l-union` | Noir profond, or vif | Luxe, soirée de gala |

---

## Workflow 4 : Ajouter un nouveau bloc optionnel

Exemple : ajouter un bloc "Animaux de compagnie acceptés" (`animaux`).

### 4.1 — Ajouter le bloc dans `_template/index.html`

Entourer le HTML du bloc avec des marqueurs :

```html
<!-- BLOC:animaux:START -->
<section id="animaux">
  <h2>Vos compagnons sont les bienvenus</h2>
  <!-- contenu -->
</section>
<!-- BLOC:animaux:END -->
```

### 4.2 — Déclarer l'option dans `config/tiers.json`

Dans la section `"options"` :

```json
"animaux": {
  "label": "Animaux acceptés",
  "description": "Section signalant que les animaux sont bienvenus",
  "prix": 10
}
```

Et dans les paliers qui l'incluent par défaut (ex: `exception`) :

```json
"exception": {
  "blocs_inclus": ["notre-histoire", "dresscode", "empreintes", "hebergements", "autour", "cadeaux", "animaux"]
}
```

### 4.3 — Ajouter les tokens si le bloc contient du texte variable

Dans `_template/index.html`, remplacer les valeurs hardcodées par `{{NOM_TOKEN}}`.

Puis ajouter la valeur dans le JSON du couple :

```json
"ANIMAUX_MSG": "Chiens et chats sont les bienvenus dans les jardins."
```

### 4.4 — Reconstruire

```bash
node scripts/build.js --couple=sophie-thomas
```

---

## Workflow 5 : Créer un nouvel univers visuel

Copier un univers existant :

```bash
cp _template/univers/les-voiles.css _template/univers/les-jardins.css
```

Modifier les couleurs dans `les-jardins.css` :

```css
:root {
  --ev-accent:       #6B8F4E;   /* vert sauge */
  --ev-accent-deep:  #3D5C2A;
  --ev-accent-light: #C8DFB0;
  --ev-bg:           #F4F7F0;
  --ev-bg-section:   #E8F0E2;
  --ev-text:         #1A2E0E;
  --ev-text-soft:    #3A5C2A;
  --ev-text-muted:   #6B7D5E;
  /* typographies et tailles : identiques aux autres univers */
}
```

Puis l'utiliser dans le JSON du couple :

```json
"_meta": { "univers": "les-jardins" }
```

---

## Référence rapide

### Commandes

```bash
# Construire une invitation
node scripts/build.js --couple=NOM_COUPLE

# Simuler sans écrire (dry-run)
node scripts/build.js --couple=NOM_COUPLE --dry-run

# Servir en local
npx serve dist/NOM_COUPLE

# Déployer
netlify deploy --prod --dir=dist/NOM_COUPLE
```

### Structure d'un fichier couple (sections obligatoires)

```
_meta         → univers, slug
couple        → prénoms dans toutes les formes
date          → date ISO, texte long, données ICS
lieux         → noms + liens Maps
media         → chemins Cloudinary de toutes les photos
seo           → titre + description
commande      → palier + options_achetees + prix_total
```

### Tokens dans la template

Les tokens `{{NOM}}` dans `_template/index.html` sont remplacés par les valeurs du JSON couple. Si un token reste non résolu à la construction, le script affiche un avertissement.

Pour voir tous les tokens disponibles :

```bash
grep -o '{{[A-Z_]*}}' _template/index.html | sort -u
```

### Blocs conditionnels

Les blocs activés dépendent de :
1. **Le palier** (`commande.palier`) → blocs de base inclus dans le tarif
2. **Les options achetées** (`commande.options_achetees`) → blocs extras payants

Les deux listes sont fusionnées. Un bloc présent dans l'une ou l'autre est actif.

---

## En cas de problème

**"Token non résolu"** → Le token existe dans la template mais pas dans le JSON couple. Vérifier le nom exact (majuscules, tirets bas).

**Bloc toujours visible alors qu'il devrait être masqué** → Vérifier que les marqueurs `<!-- BLOC:id:START -->` et `<!-- BLOC:id:END -->` sont bien présents dans `_template/index.html` et que l'id correspond exactement à ce qui est dans `tiers.json`.

**L'univers ne change pas** → Vérifier que `_meta.univers` dans le JSON correspond exactement au nom du fichier CSS (sans l'extension).
