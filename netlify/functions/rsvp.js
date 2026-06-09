/**
 * Netlify Function — RSVP Handler
 * Reçoit le formulaire RSVP, déclenche 4 actions en parallèle :
 *   1. Email de confirmation à l'invité (Resend)
 *   2. Notification email au propriétaire du site (Resend)
 *   3. Ajout d'une ligne dans Google Sheets (Apps Script webhook)
 *   4. Redéploiement Netlify (Deploy Hook)
 *
 * Variables d'environnement requises dans Netlify :
 *   RESEND_API_KEY          — clé API Resend (https://resend.com)
 *   EMAIL_FROM              — ex: "Marie-Paul & Yann <rsvp@votredomaine.fr>"
 *   OWNER_EMAIL             — email qui reçoit les notifications
 *   COUPLE_NAMES            — "Marie-Paul & Yann"
 *   WEDDING_DATE            — "samedi 22 mai 2027"
 *   SHEETS_WEBHOOK_URL      — URL du web app Google Apps Script
 *   NETLIFY_DEPLOY_HOOK_URL — URL du deploy hook Netlify (déclenche rebuild)
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    prenom    = '',
    nom       = '',
    email     = '',
    telephone = '',
    presence  = '',
    adultes   = '0',
    enfants   = '0',
    menu      = '',
    allergies = '',
    message   = '',
  } = data;

  const tasks = [
    sendGuestEmail({ prenom, email, presence }),
    sendOwnerEmail({ prenom, nom, email, telephone, presence, adultes, enfants, menu, allergies, message }),
    logToSheets({ prenom, nom, email, telephone, presence, adultes, enfants, menu, allergies, message }),
    triggerRedeploy(),
  ];

  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`RSVP action[${i}] failed:`, r.reason?.message || r.reason);
    }
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};

// ─── 1. Email de confirmation invité ─────────────────────────────────────────

async function sendGuestEmail({ prenom, email, presence }) {
  if (!email || !process.env.RESEND_API_KEY) return;

  const coupleNames  = process.env.COUPLE_NAMES  || 'Les mariés';
  const weddingDate  = process.env.WEDDING_DATE  || 'le jour du mariage';
  const isPresent    = presence === 'oui';

  const subject = isPresent
    ? `Votre présence est confirmée — ${coupleNames} 💛`
    : `Votre réponse a bien été reçue — ${coupleNames}`;

  const bodyHtml = isPresent
    ? guestHtmlYes({ prenom, coupleNames, weddingDate })
    : guestHtmlNo({ prenom, coupleNames });

  return resendSend({
    from: process.env.EMAIL_FROM || `${coupleNames} <noreply@resend.dev>`,
    to: email,
    subject,
    html: bodyHtml,
  });
}

// ─── 2. Notification propriétaire ────────────────────────────────────────────

async function sendOwnerEmail(fields) {
  if (!process.env.OWNER_EMAIL || !process.env.RESEND_API_KEY) return;

  const { prenom, nom, email, presence } = fields;
  const icon = presence === 'oui' ? '✅' : '❌';
  const rows = [
    ['Prénom',    fields.prenom],
    ['Nom',       fields.nom],
    ['Email',     fields.email],
    ['Téléphone', fields.telephone || '—'],
    ['Présence',  presence === 'oui' ? 'Oui, avec joie' : 'Non, avec regret'],
    ['Adultes',   fields.adultes || '0'],
    ['Enfants',   fields.enfants || '0'],
    ['Menu',      fields.menu || '—'],
    ['Allergies', fields.allergies || '—'],
    ['Message',   fields.message || '—'],
  ];

  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 12px;font-weight:600;color:#452819;white-space:nowrap">${k}</td>` +
    `<td style="padding:6px 12px;color:#3a2218">${escHtml(String(v))}</td></tr>`
  ).join('');

  return resendSend({
    from: process.env.EMAIL_FROM || `RSVP <noreply@resend.dev>`,
    to: process.env.OWNER_EMAIL,
    subject: `Nouveau RSVP ${icon} — ${prenom} ${nom} (${email})`,
    html: `
<!DOCTYPE html><html><body style="font-family:'Cormorant Garamond',Georgia,serif;background:#F7EFE3;margin:0;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(183,143,67,.3);padding:32px">
  <p style="font-size:13px;letter-spacing:.12em;color:#A77A35;text-transform:uppercase;margin:0 0 16px">Eventia Signature — Nouveau RSVP</p>
  <h2 style="font-size:22px;color:#452819;margin:0 0 24px">${icon} ${escHtml(prenom)} ${escHtml(nom)}</h2>
  <table style="border-collapse:collapse;width:100%;font-size:16px">${tableRows}</table>
  <p style="font-size:12px;color:#999;margin:24px 0 0">Reçu le ${new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}</p>
</div></body></html>`,
  });
}

// ─── 3. Google Sheets ─────────────────────────────────────────────────────────

async function logToSheets(fields) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...fields,
      date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Sheets webhook responded ${res.status}`);
}

// ─── 4. Netlify deploy hook ───────────────────────────────────────────────────

async function triggerRedeploy() {
  const url = process.env.NETLIFY_DEPLOY_HOOK_URL;
  if (!url) return;

  const res = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Deploy hook responded ${res.status}`);
}

// ─── Resend helper ────────────────────────────────────────────────────────────

async function resendSend({ from, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ─── Templates email invité ───────────────────────────────────────────────────

function guestHtmlYes({ prenom, coupleNames, weddingDate }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmation de présence</title></head>
<body style="margin:0;padding:0;background:#F7EFE3;font-family:'Cormorant Garamond',Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7EFE3;padding:40px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border:1px solid rgba(167,122,53,.25);box-shadow:0 4px 24px rgba(69,40,25,.08)">
  <!-- Header doré -->
  <tr><td style="background:linear-gradient(135deg,#7A4E18 0%,#A77A35 40%,#F3D391 60%,#A77A35 100%);padding:2px 0"></td></tr>
  <!-- Corps -->
  <tr><td style="padding:48px 40px 36px;text-align:center">
    <p style="font-size:11px;letter-spacing:.18em;color:#A77A35;text-transform:uppercase;margin:0 0 24px">Confirmation de présence</p>
    <h1 style="font-size:32px;font-weight:400;color:#452819;margin:0 0 8px">${escHtml(coupleNames)}</h1>
    <p style="font-size:14px;color:#A77A35;letter-spacing:.12em;margin:0 0 32px">${escHtml(weddingDate)}</p>
    <div style="width:48px;height:1px;background:linear-gradient(to right,transparent,#A77A35,transparent);margin:0 auto 32px"></div>
    <p style="font-size:20px;color:#452819;line-height:1.7;margin:0 0 20px">
      Cher·ère ${escHtml(prenom)},
    </p>
    <p style="font-size:18px;color:#5C3D26;line-height:1.8;margin:0 0 28px">
      Votre présence a été confirmée avec joie.<br>
      ${escHtml(coupleNames)} vous remercient chaleureusement<br>
      et se réjouissent de partager ce moment avec vous.
    </p>
    <p style="font-size:15px;color:#A77A35;font-style:italic;margin:0 0 36px">
      « Le plus beau chapitre de notre histoire reste encore à écrire. »
    </p>
    <div style="width:48px;height:1px;background:linear-gradient(to right,transparent,#A77A35,transparent);margin:0 auto 32px"></div>
    <p style="font-size:14px;color:#999;margin:0">
      Si vous avez des questions, répondez simplement à cet email.
    </p>
  </td></tr>
  <!-- Footer doré -->
  <tr><td style="background:linear-gradient(135deg,#7A4E18 0%,#A77A35 40%,#F3D391 60%,#A77A35 100%);padding:2px 0"></td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function guestHtmlNo({ prenom, coupleNames }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Votre réponse a été reçue</title></head>
<body style="margin:0;padding:0;background:#F7EFE3;font-family:'Cormorant Garamond',Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7EFE3;padding:40px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border:1px solid rgba(167,122,53,.25);box-shadow:0 4px 24px rgba(69,40,25,.08)">
  <tr><td style="background:linear-gradient(135deg,#7A4E18 0%,#A77A35 40%,#F3D391 60%,#A77A35 100%);padding:2px 0"></td></tr>
  <tr><td style="padding:48px 40px 36px;text-align:center">
    <p style="font-size:11px;letter-spacing:.18em;color:#A77A35;text-transform:uppercase;margin:0 0 24px">Réponse enregistrée</p>
    <h1 style="font-size:32px;font-weight:400;color:#452819;margin:0 0 32px">${escHtml(coupleNames)}</h1>
    <div style="width:48px;height:1px;background:linear-gradient(to right,transparent,#A77A35,transparent);margin:0 auto 32px"></div>
    <p style="font-size:20px;color:#452819;line-height:1.7;margin:0 0 20px">Cher·ère ${escHtml(prenom)},</p>
    <p style="font-size:18px;color:#5C3D26;line-height:1.8;margin:0 0 28px">
      Votre réponse a bien été reçue.<br>
      ${escHtml(coupleNames)} vous remercient chaleureusement<br>
      pour votre retour et gardent une pensée affectueuse pour vous.
    </p>
    <div style="width:48px;height:1px;background:linear-gradient(to right,transparent,#A77A35,transparent);margin:0 auto 32px"></div>
    <p style="font-size:14px;color:#999;margin:0">
      Si votre situation change, n'hésitez pas à les contacter directement.
    </p>
  </td></tr>
  <tr><td style="background:linear-gradient(135deg,#7A4E18 0%,#A77A35 40%,#F3D391 60%,#A77A35 100%);padding:2px 0"></td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
