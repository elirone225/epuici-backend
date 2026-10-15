const mongoose = require('mongoose');
const TransactionDon = require('../models/TransactionDon');
const { CATEGORIES, MONTANT_MIN, MONTANT_MAX, STATUTS } = require('../models/TransactionDon');
const EvenementWave = require('../models/EvenementWave');
const Village = require('../models/Village');
const Abonnement = require('../models/Abonnement');
const { activerAbonnement } = require('./abonnementController');
const {
  waveConfigure,
  simulationActive,
  creerSessionCheckout,
  obtenirSessionCheckout,
  expirerSessionCheckout,
  verifierSignatureWebhook,
} = require('../services/waveService');
const { envoyerRecuPdf, formaterMontant } = require('../services/recuService');
const { envoyerNotificationsMulticast } = require('../services/notificationService');

const PWA_URL = () => (process.env.PWA_URL || 'https://epuici-app.web.app').replace(/\/$/, '');
const MONTANTS_RAPIDES = {
  don: [1000, 2000, 5000, 10000, 25000, 50000],
  dime: [5000, 10000, 25000, 50000, 100000, 200000],
};
const PAR_PAGE = 20;
// Au-delà, la session Wave a expiré : on va vérifier son état auprès de Wave
const DELAI_RECONCILIATION_MS = 35 * 60 * 1000;

const idValide = (id) => mongoose.Types.ObjectId.isValid(id);

// Champs renvoyés au fidèle (pas de lien de paiement une fois terminé)
const versClient = (t) => ({
  _id: t._id,
  type: t.type,
  categorie: t.categorie,
  libelleCategorie: TransactionDon.libelleCategorie(t.type, t.categorie),
  montant: t.montant,
  devise: t.devise,
  statut: t.statut,
  referenceWave: t.transactionWave || t.referenceWave || null,
  numeroRecu: t.numeroRecu || null,
  motifEchec: t.motifEchec || null,
  lienPaiement: t.statut === 'en_attente' ? t.lienPaiement : null,
  simulation: t.simulation,
  village: t.village?.nom ? { _id: t.village._id, nom: t.village.nom } : t.village,
  dateConfirmation: t.dateConfirmation || null,
  createdAt: t.createdAt,
});

const numeroRecu = (transaction) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefixe = transaction.type === 'dime' ? 'DIM' : 'DON';
  return `${prefixe}-${date}-${transaction._id.toString().slice(-6).toUpperCase()}`;
};

// Seul point d'entrée qui change le statut d'une transaction. Les mises à
// jour sont conditionnelles (atomiques) : rejouer un même résultat est sans
// effet, ce qui rend webhook, réconciliation et simulation idempotents.
const appliquerResultat = async (transaction, { statut, transactionWave, motif }) => {
  let misAJour;
  if (statut === 'reussi') {
    // Un paiement confirmé par Wave l'emporte sur tout autre statut
    // (ex : le fidèle a annulé pendant que Wave validait le paiement).
    misAJour = await TransactionDon.findOneAndUpdate(
      { _id: transaction._id, statut: { $ne: 'reussi' } },
      {
        statut: 'reussi',
        transactionWave: transactionWave || transaction.transactionWave,
        numeroRecu: transaction.numeroRecu || numeroRecu(transaction),
        dateConfirmation: new Date(),
        $unset: { motifEchec: 1 },
      },
      { new: true }
    );
    if (misAJour) notifierDonReussi(misAJour);
  } else {
    misAJour = await TransactionDon.findOneAndUpdate(
      { _id: transaction._id, statut: 'en_attente' },
      { statut, ...(motif ? { motifEchec: motif } : {}) },
      { new: true }
    );
  }
  return misAJour || (await TransactionDon.findById(transaction._id));
};

const notifierDonReussi = async (transaction) => {
  try {
    const Utilisateur = mongoose.model('Utilisateur');
    const fidele = await Utilisateur.findById(transaction.utilisateur).select('tokenNotification');
    if (!fidele?.tokenNotification) return;
    await envoyerNotificationsMulticast([fidele.tokenNotification], {
      title: transaction.type === 'dime' ? 'Dîme reçue' : 'Don reçu',
      body: `Merci ! Votre paiement Wave de ${formaterMontant(transaction.montant)} a bien été reçu.`,
      data: { type: 'don', transactionId: transaction._id.toString() },
    });
  } catch (error) {
    console.error('Notification don :', error.message);
  }
};

// Traduit une session Wave en résultat. null = toujours en cours.
const resultatDepuisSession = (session) => {
  if (!session) return null;
  if (session.payment_status === 'succeeded') {
    return { statut: 'reussi', transactionWave: session.transaction_id };
  }
  if (session.checkout_status === 'expired') {
    return { statut: 'annule', motif: 'Le délai de paiement Wave a expiré.' };
  }
  if (session.payment_status === 'cancelled') {
    return {
      statut: 'echoue',
      motif: session.last_payment_error?.message || 'Le paiement Wave a été refusé.',
    };
  }
  return null;
};

// @route GET /api/dons/config?village=<id>
// Public : catégories, montants suggérés et disponibilité du paiement Wave.
// Avec ?village=, indique aussi si l'église a enregistré son numéro Wave.
const configurationDons = async (req, res) => {
  let egliseConfiguree = null;
  if (req.query.village && idValide(req.query.village)) {
    const village = await Village.findById(req.query.village).select('+numeroWave').catch(() => null);
    egliseConfiguree = Boolean(village?.numeroWave);
  }

  const categories = Object.fromEntries(
    Object.entries(CATEGORIES).map(([type, liste]) => [
      type,
      Object.entries(liste).map(([code, libelle]) => ({ code, libelle })),
    ])
  );
  res.json({
    disponible: waveConfigure() || simulationActive(),
    simulation: simulationActive(),
    egliseConfiguree,
    devise: 'XOF',
    montantMin: MONTANT_MIN,
    montantMax: MONTANT_MAX,
    montantsRapides: MONTANTS_RAPIDES,
    categories,
  });
};

// @route POST /api/dons
// Fidèle connecté : crée la transaction et la session de paiement Wave.
// Le statut reste "en_attente" jusqu'à la confirmation par le webhook Wave.
const creerTransaction = async (req, res) => {
  try {
    const { type, categorie } = req.body;
    const montant = Number(req.body.montant);

    if (!CATEGORIES[type]) {
      return res.status(400).json({ message: 'Type de paiement invalide (don ou dîme).' });
    }
    const categorieFinale = type === 'dime' ? 'dime' : categorie;
    if (!CATEGORIES[type][categorieFinale]) {
      return res.status(400).json({ message: 'Veuillez choisir une catégorie valide.' });
    }
    if (!Number.isInteger(montant) || montant < MONTANT_MIN || montant > MONTANT_MAX) {
      return res.status(400).json({
        message: `Le montant doit être un nombre entier entre ${formaterMontant(MONTANT_MIN)} et ${formaterMontant(MONTANT_MAX)}.`,
      });
    }

    const villageId = req.user.villagesSuivis?.[0];
    if (!villageId) {
      return res.status(400).json({
        message: "Vous devez d'abord choisir votre église dans le menu.",
      });
    }
    const village = await Village.findById(villageId).select('nom statut +numeroWave');
    if (!village || village.statut !== 'actif') {
      return res.status(400).json({ message: "Votre église n'accepte pas de paiement pour le moment." });
    }
    // Sans numéro Wave, l'argent ne pourrait pas être reversé à l'église
    if (!village.numeroWave) {
      return res.status(400).json({
        message: "Votre église n'a pas encore enregistré son numéro Wave. Réessayez plus tard.",
      });
    }

    const simulation = simulationActive();
    if (!waveConfigure() && !simulation) {
      return res.status(503).json({
        message: "Le paiement Wave n'est pas encore activé. Réessayez plus tard.",
      });
    }

    // Protection contre les clics répétés : 5 paiements en attente maximum
    const enAttenteRecents = await TransactionDon.countDocuments({
      utilisateur: req.user._id,
      statut: 'en_attente',
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });
    if (enAttenteRecents >= 5) {
      return res.status(429).json({
        message: 'Vous avez déjà plusieurs paiements en attente. Terminez-les ou patientez quelques minutes.',
      });
    }

    const transaction = await TransactionDon.create({
      village: village._id,
      utilisateur: req.user._id,
      type,
      categorie: categorieFinale,
      montant,
      simulation,
    });

    const id = transaction._id.toString();
    if (simulation) {
      const protocole = req.get('x-forwarded-proto') || req.protocol;
      transaction.referenceWave = `SIMULATION-${id}`;
      transaction.lienPaiement = `${protocole}://${req.get('host')}/api/dons/simulation/${id}`;
    } else {
      try {
        const session = await creerSessionCheckout({
          montant,
          referenceClient: `DON-${id}`,
          urlSucces: `${PWA_URL()}/?paiement=${id}`,
          urlErreur: `${PWA_URL()}/?paiement=${id}&echec=1`,
          cleIdempotence: id,
        });
        transaction.referenceWave = session.id;
        transaction.lienPaiement = session.wave_launch_url;
      } catch (error) {
        transaction.statut = 'echoue';
        transaction.motifEchec = 'Wave est momentanément indisponible.';
        await transaction.save();
        return res.status(502).json({
          message: 'Wave est momentanément indisponible. Veuillez réessayer dans quelques instants.',
          erreur: error.message,
        });
      }
    }
    await transaction.save();

    res.status(201).json({ transaction: versClient(transaction), lienPaiement: transaction.lienPaiement });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Transaction du fidèle connecté, ou null
const transactionDuFidele = async (req) => {
  if (!idValide(req.params.id)) return null;
  return TransactionDon.findOne({ _id: req.params.id, utilisateur: req.user._id });
};

// @route GET /api/dons/:id
// Fidèle : état d'un paiement (l'écran d'attente interroge cette route).
// Si Wave n'a toujours pas appelé le webhook bien après l'expiration de la
// session, le serveur vérifie lui-même auprès de Wave.
const obtenirTransaction = async (req, res) => {
  try {
    let transaction = await transactionDuFidele(req);
    if (!transaction) {
      return res.status(404).json({ message: 'Paiement introuvable.' });
    }

    const ancienne = Date.now() - transaction.createdAt.getTime() > DELAI_RECONCILIATION_MS;
    if (transaction.statut === 'en_attente' && ancienne && !transaction.simulation && waveConfigure()) {
      const resultat = resultatDepuisSession(await obtenirSessionCheckout(transaction.referenceWave));
      if (resultat) transaction = await appliquerResultat(transaction, resultat);
    }

    await transaction.populate('village', 'nom');
    res.json(versClient(transaction));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/dons/:id/annuler
// Fidèle : abandonne un paiement encore en attente
const annulerTransaction = async (req, res) => {
  try {
    const transaction = await transactionDuFidele(req);
    if (!transaction) {
      return res.status(404).json({ message: 'Paiement introuvable.' });
    }
    if (transaction.statut !== 'en_attente') {
      return res.status(400).json({ message: 'Ce paiement est déjà terminé.' });
    }

    if (!transaction.simulation && waveConfigure()) {
      // Ferme la session côté Wave pour empêcher un paiement tardif
      await expirerSessionCheckout(transaction.referenceWave);
    }
    const resultat = await appliquerResultat(transaction, {
      statut: 'annule',
      motif: 'Paiement annulé.',
    });
    await resultat.populate('village', 'nom');
    res.json(versClient(resultat));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Filtre commun : type, statut et période (debut / fin au format AAAA-MM-JJ)
const filtrePeriode = ({ debut, fin }) => {
  const createdAt = {};
  if (debut && !Number.isNaN(Date.parse(debut))) createdAt.$gte = new Date(debut);
  if (fin && !Number.isNaN(Date.parse(fin))) {
    const dateFin = new Date(fin);
    // Une date seule (sans heure) inclut toute la journée
    if (/^\d{4}-\d{2}-\d{2}$/.test(fin)) dateFin.setUTCHours(23, 59, 59, 999);
    createdAt.$lte = dateFin;
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
};

// @route GET /api/dons/mes-transactions?type=&statut=&debut=&fin=&page=
// Fidèle : historique de ses dons et dîmes, avec le total réussi de la période
const mesTransactions = async (req, res) => {
  try {
    const { type, statut } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const filtre = { utilisateur: req.user._id, ...filtrePeriode(req.query) };
    if (type && CATEGORIES[type]) filtre.type = type;
    if (statut && STATUTS.includes(statut)) filtre.statut = statut;

    const [transactions, total, totaux] = await Promise.all([
      TransactionDon.find(filtre)
        .populate('village', 'nom')
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAR_PAGE)
        .limit(PAR_PAGE),
      TransactionDon.countDocuments(filtre),
      TransactionDon.aggregate([
        { $match: { ...filtre, statut: 'reussi' } },
        { $group: { _id: '$type', montant: { $sum: '$montant' } } },
      ]),
    ]);

    const parType = Object.fromEntries(totaux.map((t) => [t._id, t.montant]));
    res.json({
      transactions: transactions.map(versClient),
      page,
      pages: Math.max(1, Math.ceil(total / PAR_PAGE)),
      total,
      totalDons: parType.don || 0,
      totalDimes: parType.dime || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/dons/:id/recu
// Reçu PDF d'un paiement réussi : le fidèle concerné, ou l'admin de l'église
const recuTransaction = async (req, res) => {
  try {
    if (!idValide(req.params.id)) {
      return res.status(404).json({ message: 'Paiement introuvable.' });
    }
    const filtre = { _id: req.params.id };
    if (req.role === 'utilisateur') {
      filtre.utilisateur = req.user._id;
    } else if (req.user.role === 'tresorier') {
      filtre.village = req.user.village;
    } else {
      return res.status(403).json({ message: "Accès réservé au trésorier de l'église." });
    }

    const transaction = await TransactionDon.findOne(filtre)
      .populate('village', 'nom')
      .populate('utilisateur', 'nom telephone');
    if (!transaction) {
      return res.status(404).json({ message: 'Paiement introuvable.' });
    }
    if (transaction.statut !== 'reussi') {
      return res.status(400).json({ message: 'Le reçu est disponible uniquement pour un paiement réussi.' });
    }

    envoyerRecuPdf(transaction, res);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/dons/webhook-wave
// Appelée par Wave (pas par l'app). C'est la SEULE source de confirmation
// d'un paiement : signature vérifiée, événements dédoublonnés, montant contrôlé.
// Traite aussi les abonnements des églises (client_reference sans préfixe DON-).
const webhookWave = async (req, res) => {
  if (!verifierSignatureWebhook(req)) {
    return res.status(401).json({ message: 'Signature Wave invalide.' });
  }

  try {
    const { id: idEvenement, type, data: session } = req.body || {};
    if (!idEvenement || !session) {
      return res.status(400).json({ message: 'Événement Wave incomplet.' });
    }

    if (await EvenementWave.exists({ idEvenement })) {
      return res.status(200).json({ message: 'Événement déjà traité.' });
    }

    const reference = String(session.client_reference || '');

    if (reference.startsWith('DON-')) {
      const idTransaction = reference.slice(4);
      const transaction = idValide(idTransaction)
        ? await TransactionDon.findById(idTransaction)
        : await TransactionDon.findOne({ referenceWave: session.id });

      if (!transaction) {
        // 200 : inutile que Wave réessaie pour une référence inconnue
        console.warn('Webhook Wave : transaction introuvable', reference);
        return res.status(200).json({ message: 'Transaction inconnue, ignorée.' });
      }

      let resultat = null;
      if (type === 'checkout.session.completed' && session.payment_status === 'succeeded') {
        const montantRecu = Number(session.amount);
        if (montantRecu !== transaction.montant || (session.currency && session.currency !== 'XOF')) {
          console.error('Webhook Wave : montant incohérent', reference, session.amount, session.currency);
          resultat = { statut: 'echoue', motif: 'Montant reçu incohérent, contactez votre église.' };
        } else {
          resultat = { statut: 'reussi', transactionWave: session.transaction_id };
        }
      } else if (type === 'checkout.session.payment_failed') {
        resultat = {
          statut: 'echoue',
          motif: session.last_payment_error?.message || 'Le paiement Wave a échoué.',
        };
      }

      if (resultat) await appliquerResultat(transaction, resultat);
    } else if (type === 'checkout.session.completed' && session.payment_status === 'succeeded') {
      const abonnement = idValide(reference) ? await Abonnement.findById(reference) : null;
      if (abonnement && abonnement.statutPaiement !== 'valide') {
        await activerAbonnement(abonnement);
      }
    }

    await EvenementWave.create({ idEvenement, type, referenceWave: session.id }).catch((error) => {
      // Deux livraisons simultanées du même événement : l'autre l'a enregistré
      if (error.code !== 11000) throw error;
    });

    res.status(200).json({ message: 'Événement traité.' });
  } catch (error) {
    console.error('Webhook Wave :', error);
    // 500 : Wave renverra l'événement plus tard
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// --- Mode simulation (WAVE_SIMULATION=true et aucune clé Wave) ---
// Remplace la page Wave pour tester tout le parcours sans argent réel.

const pageSimulation = async (req, res) => {
  if (!simulationActive() || !idValide(req.params.id)) {
    return res.status(404).send('Page introuvable.');
  }
  const transaction = await TransactionDon.findById(req.params.id);
  if (!transaction || !transaction.simulation) {
    return res.status(404).send('Paiement introuvable.');
  }

  res.type('html').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wave (simulation)</title>
<style>
body{font-family:system-ui,sans-serif;background:#1DC8FF;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
.carte{background:#fff;border-radius:18px;padding:28px;max-width:340px;width:90%;text-align:center}
h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:4px 0 18px}.montant{font-size:30px;font-weight:700;color:#0B5CA8}
button{display:block;width:100%;padding:14px;border:0;border-radius:12px;font-size:15px;font-weight:600;margin-top:10px;cursor:pointer}
.ok{background:#2F7D32;color:#fff}.ko{background:#eee;color:#C62828}
</style></head><body><div class="carte">
<h1>Paiement Wave — SIMULATION</h1><p>Aucun argent ne sera débité.</p>
<div class="montant">${formaterMontant(transaction.montant)}</div>
<p>${transaction.type === 'dime' ? 'Dîme' : 'Don'} — statut actuel : ${transaction.statut}</p>
<form method="post"><button class="ok" name="resultat" value="reussi">Simuler un paiement réussi</button>
<button class="ko" name="resultat" value="echoue">Simuler un échec</button></form>
</div></body></html>`);
};

const validerSimulation = async (req, res) => {
  if (!simulationActive() || !idValide(req.params.id)) {
    return res.status(404).send('Page introuvable.');
  }
  const transaction = await TransactionDon.findById(req.params.id);
  if (!transaction || !transaction.simulation) {
    return res.status(404).send('Paiement introuvable.');
  }

  const reussi = req.body?.resultat === 'reussi';
  await appliquerResultat(
    transaction,
    reussi
      ? { statut: 'reussi', transactionWave: `SIM-T-${transaction._id.toString().slice(-8)}` }
      : { statut: 'echoue', motif: 'Échec simulé.' }
  );
  const id = transaction._id.toString();
  res.redirect(303, `${PWA_URL()}/?paiement=${id}${reussi ? '' : '&echec=1'}`);
};

module.exports = {
  configurationDons,
  creerTransaction,
  obtenirTransaction,
  annulerTransaction,
  mesTransactions,
  recuTransaction,
  webhookWave,
  pageSimulation,
  validerSimulation,
  // réutilisés par l'espace admin (phase 2)
  filtrePeriode,
  versClient,
};
