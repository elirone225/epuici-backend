const mongoose = require('mongoose');
const Article = require('../models/Article');
const Evenement = require('../models/Evenement');
const { dateLocale, heureLocale } = require('../services/agendaService');

// Pages de partage : WhatsApp, Facebook... lisent leurs balises Open Graph
// pour afficher un aperçu (titre, image, résumé). Un visiteur, lui, est
// aussitôt renvoyé vers la publication dans la PWA.

const PWA_URL = () => (process.env.PWA_URL || 'https://epuici-app.web.app').replace(/\/$/, '');
const IMAGE_PAR_DEFAUT = () => `${PWA_URL()}/icons/Icon-512.png`;

const echapperHtml = (texte = '') =>
  String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resume = (texte = '', longueur = 180) => {
  const propre = String(texte).replace(/\s+/g, ' ').trim();
  return propre.length > longueur ? `${propre.slice(0, longueur - 1).trimEnd()}…` : propre;
};

const pageApercu = ({ titre, description, image, urlPartage, destination }) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapperHtml(titre)}</title>
<meta name="description" content="${echapperHtml(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="EPUICI">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${echapperHtml(titre)}">
<meta property="og:description" content="${echapperHtml(description)}">
<meta property="og:image" content="${echapperHtml(image)}">
<meta property="og:url" content="${echapperHtml(urlPartage)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${echapperHtml(destination)}">
<style>body{font-family:system-ui,sans-serif;background:#0F2D52;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;margin:0;padding:24px}a{color:#A9D1F2}</style>
</head><body><div><p>Ouverture de la publication dans EPUICI…</p>
<p><a href="${echapperHtml(destination)}">Ouvrir EPUICI</a></p></div>
<script>location.replace(${JSON.stringify(destination)});</script>
</body></html>`;

const urlDeCetteRequete = (req) =>
  `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}${req.originalUrl}`;

// @route GET /api/partage/article/:id
const partageArticle = async (req, res) => {
  const destination = `${PWA_URL()}/?article=${encodeURIComponent(req.params.id)}`;
  try {
    const article = mongoose.Types.ObjectId.isValid(req.params.id)
      ? await Article.findOne({ _id: req.params.id, statut: 'publie' }).populate('village', 'nom')
      : null;
    if (!article) return res.redirect(302, PWA_URL());

    res.set('Cache-Control', 'public, max-age=300');
    res.type('html').send(
      pageApercu({
        titre: `${article.titre} — ${article.village?.nom || 'EPUICI'}`,
        description: resume(article.contenu),
        image: article.photos?.[0] || IMAGE_PAR_DEFAUT(),
        urlPartage: urlDeCetteRequete(req),
        destination,
      })
    );
  } catch {
    res.redirect(302, destination);
  }
};

// @route GET /api/partage/evenement/:id
const partageEvenement = async (req, res) => {
  const destination = `${PWA_URL()}/?evenement=${encodeURIComponent(req.params.id)}`;
  try {
    const evenement = mongoose.Types.ObjectId.isValid(req.params.id)
      ? await Evenement.findById(req.params.id).populate('village', 'nom')
      : null;
    if (!evenement) return res.redirect(302, PWA_URL());

    const quand = `${dateLocale(evenement.dateDebut)} à ${heureLocale(evenement.dateDebut)}`;
    const ou = evenement.lieu ? ` — ${evenement.lieu}` : '';
    res.set('Cache-Control', 'public, max-age=300');
    res.type('html').send(
      pageApercu({
        titre: `${evenement.titre} — ${evenement.village?.nom || 'EPUICI'}`,
        description: resume(`${quand}${ou}. ${evenement.description || ''}`),
        image: evenement.photo || IMAGE_PAR_DEFAUT(),
        urlPartage: urlDeCetteRequete(req),
        destination,
      })
    );
  } catch {
    res.redirect(302, destination);
  }
};

module.exports = { partageArticle, partageEvenement };
