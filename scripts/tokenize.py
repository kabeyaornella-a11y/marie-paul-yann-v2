#!/usr/bin/env python3
"""
tokenize.py — Pose les tokens {{TOKEN}} dans _template/ depuis les sources.
Idempotent : recopie les sources puis applique les remplacements.
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMPL = os.path.join(ROOT, '_template')

REPLACEMENTS = [
    # ── Date / longue ─────────────────────────────────────────────────────
    ("Journée entière du samedi 22 mai 2027.", "{{DATE_LONGUE}}."),
    ("Samedi 22 mai 2027.",                    "{{DATE_LONGUE}}."),
    # ── SEO ───────────────────────────────────────────────────────────────
    ("Marie-Paul &amp; Yann · Mariage 2027",   "{{META_TITLE}}"),
    ("Marie-Paul &amp; Yann · Mariage",        "{{META_TITLE_TWITTER}}"),
    ("Vous êtes cordialement invités à célébrer le mariage de Marie-Paul &amp; Yann. Deux âmes, une promesse : une éternité à écrire ensemble.",
                                                "{{META_DESCRIPTION}}"),
    ("Marie-Paul &amp; Yann · 2027 · v31",     "{{META_TITLE}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/couple-hero.png",
                                                "{{OG_IMAGE}}"),
    # ── Médias Cloudinary ─────────────────────────────────────────────────
    ("https://res.cloudinary.com/didid8vcu/video/upload/q_auto/f_auto/v1780082988/2026-05-29_21_29_06_aciw5j.mp4",
                                                "{{CDN_VIDEO_BASE}}/{{VIDEO_OUVERTURE}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/door-entrance.jpeg",
                                                "{{CDN_BASE}}/{{PHOTO_PORTE}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/lustre-principal.webp",
                                                "{{CDN_BASE}}/{{PHOTO_LUSTRE}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/couple-story-1.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_HISTOIRE_1}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/couple-story-2.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_HISTOIRE_2}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/couple-story-4.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_HISTOIRE_3}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/couple-story-5.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_HISTOIRE_4}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/mairie-civile-1.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_CIVIL_1}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/mairie-civile-2.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_CIVIL_2}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/mairie-civile-3.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_CIVIL_3}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/salle3.webp",
                                                "{{CDN_BASE}}/{{PHOTO_RECEPTION_1}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/salle4.webp",
                                                "{{CDN_BASE}}/{{PHOTO_RECEPTION_2}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/salle2.webp",
                                                "{{CDN_BASE}}/{{PHOTO_RECEPTION_3}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/salle.webp",
                                                "{{CDN_BASE}}/{{PHOTO_RECEPTION_4}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/dresscode-podium.png",
                                                "{{CDN_BASE}}/{{PHOTO_DRESSCODE_PODIUM}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/dresscode-silhouettes.png",
                                                "{{CDN_BASE}}/{{PHOTO_DRESSCODE_SILHOUETTES}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/assets/parrot-world.jpg",
                                                "{{CDN_BASE}}/{{PHOTO_ACTIVITE_1}}"),
    ("https://res.cloudinary.com/didid8vcu/image/upload/mpyann/couple-cadre-baroque.png",
                                                "{{CDN_BASE}}/{{PHOTO_FINALE}}"),
    # ── Lieux ─────────────────────────────────────────────────────────────
    ("https://maps.app.goo.gl/3pwRhroAQNu8L7ns8?g_st=ic", "{{LIEU_CIVIL_MAPS}}"),
    ("https://maps.app.goo.gl/6nWRTcQzJziX74Ra8?g_st=ic", "{{LIEU_RECEPTION_MAPS}}"),
    ("Mairie de Gennevilliers puis Domaine des Rois",       "{{ICS_LOCATION}}"),
    ("Mairie de Gennevilliers",                             "{{LIEU_CIVIL_NOM}}"),
    ("Salle des mariages",                                  "{{LIEU_CIVIL_ALT_2}}"),
    ('alt="Escalier d\'honneur"',                           'alt="{{LIEU_CIVIL_ALT_3}}"'),
    ("entre Échouboulains et Fontainebleau",                "{{LIEU_RECEPTION_REGION}}"),
    ("Domaine des Rois",                                    "{{LIEU_RECEPTION_NOM}}"),
    # ── ICS ───────────────────────────────────────────────────────────────
    ("marie-paul-yann-20270522@eventiasignature.fr",        "{{ICS_UID}}"),
    ("DTSTART;VALUE=DATE:20270522",    "DTSTART;VALUE=DATE:{{DATE_ICS}}"),
    ("DTEND;VALUE=DATE:20270523",      "DTEND;VALUE=DATE:{{DATE_ICS_END}}"),
    ("DTSTART:20270522T110000Z",       "DTSTART:{{DATE_ICS_START_FULL}}"),
    ("DTEND:20270522T215900Z",         "DTEND:{{DATE_ICS_END_FULL}}"),
    ("Mariage de Marie-Paul et Yann",  "{{ICS_SUMMARY}}"),
    ("Mariage civil à la Mairie de Gennevilliers. Bénédiction et réception au Domaine des Rois. Journée entière du samedi 22 mai 2027.",
                                        "{{ICS_DESCRIPTION}}"),
    ("13h00 - Cérémonie civile à la Mairie de Gennevilliers. Bénédiction nuptiale et réception au Domaine des Rois. Samedi 22 mai 2027.",
                                        "{{ICS_DESCRIPTION_LONG}}"),
    ("mariage-marie-paul-yann-22-05-2027.ics",             "{{ICS_DOWNLOAD_FILE}}"),
    # ── Prénoms ───────────────────────────────────────────────────────────
    ("Marie-Paul &amp; Yann vous remercient du fond du cœur.",
     "{{PRENOMS_HTML}} vous remercient du fond du cœur."),
    ("Marie-Paul &amp; Yann vous remercient chaleureusement et se réjouissent",
     "{{PRENOMS_HTML}} vous remercient chaleureusement et se réjouissent"),
    ("Marie-Paul &amp; Yann vous remercient chaleureusement pour votre retour.",
     "{{PRENOMS_HTML}} vous remercient chaleureusement pour votre retour."),
    ("Marie-Paul & Yann vous remercient chaleureusement pour votre retour.",
     "{{PRENOMS}} vous remercient chaleureusement pour votre retour."),
    ("Marie-Paul & Yann vous remercient chaleureusement et se réjouissent",
     "{{PRENOMS}} vous remercient chaleureusement et se réjouissent"),
    ("Marie-Paul & Yann vous remercient du fond du cœur.",
     "{{PRENOMS}} vous remercient du fond du cœur."),
    ("Marie-Paul & Yann",              "{{PRENOMS}}"),
    ("Marie-Paul &amp; Yann",          "{{PRENOMS_HTML}}"),
    ("Marie-Paul et Yann",             "{{PRENOMS_ET}}"),
    ("Hero {{PRENOMS_ET}}",            "Hero {{PRENOMS_ET}}"),  # no-op guard
    ("Hero Marie-Paul et Yann",        "Hero {{PRENOMS_ET}}"),
    ("Marie-Paul",                     "{{PRENOM_1}}"),
    # ── Date ──────────────────────────────────────────────────────────────
    ("2027-04-17T15:00:00",            "{{DATE_ISO_DATETIME}}"),
    ("2027-04-17",                     "{{DATE_ISO}}"),
    ("22 décembre 2026",               "{{DATE_RSVP_LIMITE}}"),
    ("· 2027 ·",                       "· {{ANNEE_MARIAGE}} ·"),
    # ── Audio ─────────────────────────────────────────────────────────────
    ('src="musique.m4a"',              'src="{{AUDIO_SRC}}"'),
    ("PRODID:-//Eventia Signature//Marie-Paul et Yann//FR",
     "PRODID:-//Eventia Signature//{{PRENOMS_ET}}//FR"),
    # ── Titre ─────────────────────────────────────────────────────────────
    ("{{META_TITLE}} · v31",           "{{META_TITLE}}"),
]

REPLACEMENTS_COUNTDOWN = [
    ("2027-04-17T15:00:00", "{{DATE_ISO_DATETIME}}"),
]

REPLACEMENTS_SCRATCH = [
    ("marie-paul-yann-20270522@eventiasignature.fr",  "{{ICS_UID}}"),
    ("DTSTART:20270522T110000Z",  "DTSTART:{{DATE_ICS_START_FULL}}"),
    ("DTEND:20270522T215900Z",    "DTEND:{{DATE_ICS_END_FULL}}"),
    ("Mariage de Marie-Paul et Yann",  "{{ICS_SUMMARY}}"),
    ("13h00 - Cérémonie civile à la Mairie de Gennevilliers. Bénédiction nuptiale et réception au Domaine des Rois. Samedi 22 mai 2027.",
     "{{ICS_DESCRIPTION_LONG}}"),
    ("Mairie de Gennevilliers puis Domaine des Rois",  "{{ICS_LOCATION}}"),
    ("mariage-marie-paul-yann-22-05-2027.ics",        "{{ICS_DOWNLOAD_FILE}}"),
]


def process(src, replacements):
    with open(src, encoding='utf-8') as f:
        c = f.read()
    hits = 0
    for old, new in replacements:
        if old in c:
            c = c.replace(old, new)
            hits += 1
    with open(src, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"  ✓ {os.path.relpath(src, ROOT)} — {hits} remplacements")


print("\n── Tokenisation _template/ ──")
process(os.path.join(TMPL, 'index.html'),              REPLACEMENTS)
process(os.path.join(TMPL, 'countdown', 'index.html'), REPLACEMENTS_COUNTDOWN)
process(os.path.join(TMPL, 'scratch', 'index.html'),   REPLACEMENTS_SCRATCH)
print("  ✅ _template/ prêt\n")
