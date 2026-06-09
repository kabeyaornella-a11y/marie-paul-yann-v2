/**
 * Google Apps Script — RSVP Webhook
 *
 * INSTALLATION (à faire une seule fois) :
 *   1. Ouvrir Google Sheets → Extensions → Apps Script
 *   2. Coller CE FICHIER entier dans l'éditeur (remplacer le code existant)
 *   3. Cliquer sur "Déployer" → "Nouveau déploiement"
 *      - Type : Application Web
 *      - Exécuter en tant que : Moi
 *      - Qui a accès : Tout le monde
 *   4. Copier l'URL générée → la coller dans SHEETS_WEBHOOK_URL dans Netlify
 *
 * Structure de la feuille (créée automatiquement si absente) :
 *   Date | Prénom | Nom | Email | Téléphone | Présence | Adultes | Enfants | Menu | Allergies | Message
 */

var SHEET_NAME = 'RSVP';
var HEADERS = ['Date', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Présence', 'Adultes', 'Enfants', 'Menu', 'Allergies', 'Message'];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet();

    sheet.appendRow([
      data.date        || new Date().toLocaleString('fr-FR'),
      data.prenom      || '',
      data.nom         || '',
      data.email       || '',
      data.telephone   || '',
      data.presence === 'oui' ? 'Oui ✅' : 'Non ❌',
      data.adultes     || '0',
      data.enfants     || '0',
      data.menu        || '',
      data.allergies   || '',
      data.message     || '',
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#F3D391')
      .setFontColor('#452819');
    sheet.setFrozenRows(1);
  }

  return sheet;
}
