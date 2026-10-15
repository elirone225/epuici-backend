const mongoose = require('mongoose');
const TransactionDon = require('../models/TransactionDon');
const { CATEGORIES, STATUTS } = require('../models/TransactionDon');
const Utilisateur = require('../models/Utilisateur');
const { filtrePeriode, versClient } = require('./donController');
const { envoyerCsv, envoyerRapportPdf } = require('../services/rapportDonsService');

// Espace "Dons & Dîmes" du trésorier : toutes les requêtes sont limitées à
// SON église (req.user.village), quel que soit le filtre envoyé.

const PAR_PAGE = 25;
const MAX_EXPORT = 10000;

const echapperRegex = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Filtre commun à la liste et aux exports
const construireFiltre = async (req) => {
  const { type, statut, categorie, recherche } = req.query;
  const filtre = { village: req.user.village, ...filtrePeriode(req.query) };

  if (type && CATEGORIES[type]) filtre.type = type;
  if (statut && STATUTS.includes(statut)) filtre.statut = statut;
  if (categorie && typeof categorie === 'string') filtre.categorie = categorie;

  const texte = typeof recherche === 'string' ? recherche.trim() : '';
  if (texte) {
    const motif = new RegExp(echapperRegex(texte.slice(0, 60)), 'i');
    const membres = await Utilisateur.find({ $or: [{ nom: motif }, { telephone: motif }] })
      .select('_id')
      .limit(500);
    filtre.$or = [
      { utilisateur: { $in: membres.map((m) => m._id) } },
      { numeroRecu: motif },
      { transactionWave: motif },
      { referenceWave: motif },
    ];
  }
  return filtre;
};

// Une transaction vue par le trésorier : avec le membre
const versTresorier = (t) => ({
  ...versClient(t),
  lienPaiement: undefined,
  referenceSession: t.referenceWave || null,
  // null si le compte du membre a été supprimé
  membre: t.utilisateur?.telephone
    ? { _id: t.utilisateur._id, nom: t.utilisateur.nom || 'Fidèle', telephone: t.utilisateur.telephone }
    : null,
});

// Totaux des paiements RÉUSSIS de la période (les autres statuts sont
// seulement comptés)
const calculerResume = async (village, query) => {
  const periode = { village: new mongoose.Types.ObjectId(String(village)), ...filtrePeriode(query) };
  const [parType, parStatut, parCategorie] = await Promise.all([
    TransactionDon.aggregate([
      { $match: { ...periode, statut: 'reussi' } },
      { $group: { _id: '$type', montant: { $sum: '$montant' }, nombre: { $sum: 1 } } },
    ]),
    TransactionDon.aggregate([
      { $match: periode },
      { $group: { _id: '$statut', nombre: { $sum: 1 } } },
    ]),
    TransactionDon.aggregate([
      { $match: { ...periode, statut: 'reussi' } },
      { $group: { _id: { type: '$type', categorie: '$categorie' }, montant: { $sum: '$montant' }, nombre: { $sum: 1 } } },
      { $sort: { montant: -1 } },
    ]),
  ]);

  const type = (t) => parType.find((p) => p._id === t) || { montant: 0, nombre: 0 };
  const don = type('don');
  const dime = type('dime');
  return {
    totalGeneral: don.montant + dime.montant,
    totalDons: don.montant,
    totalDimes: dime.montant,
    nombreReussis: don.nombre + dime.nombre,
    nombreDons: don.nombre,
    nombreDimes: dime.nombre,
    nombreParStatut: Object.fromEntries(STATUTS.map((s) => [s, parStatut.find((p) => p._id === s)?.nombre || 0])),
    parCategorie: parCategorie.map((c) => ({
      type: c._id.type,
      categorie: c._id.categorie,
      libelle: TransactionDon.libelleCategorie(c._id.type, c._id.categorie),
      montant: c.montant,
      nombre: c.nombre,
    })),
  };
};

// @route GET /api/dons/eglise/resume?debut=&fin=
const resumeEglise = async (req, res) => {
  try {
    res.json(await calculerResume(req.user.village, req.query));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/dons/eglise/transactions?recherche=&type=&statut=&categorie=&debut=&fin=&page=
const transactionsEglise = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filtre = await construireFiltre(req);

    const [transactions, total] = await Promise.all([
      TransactionDon.find(filtre)
        .populate('utilisateur', 'nom telephone')
        .populate('village', 'nom')
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAR_PAGE)
        .limit(PAR_PAGE),
      TransactionDon.countDocuments(filtre),
    ]);

    res.json({
      transactions: transactions.map(versTresorier),
      page,
      pages: Math.max(1, Math.ceil(total / PAR_PAGE)),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/dons/eglise/transactions/:id
const transactionEglise = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Transaction introuvable.' });
    }
    const transaction = await TransactionDon.findOne({ _id: req.params.id, village: req.user.village })
      .populate('utilisateur', 'nom telephone email')
      .populate('village', 'nom');
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction introuvable.' });
    }
    res.json({
      ...versTresorier(transaction),
      membre: transaction.utilisateur
        ? {
            _id: transaction.utilisateur._id,
            nom: transaction.utilisateur.nom || 'Fidèle',
            telephone: transaction.utilisateur.telephone,
            email: transaction.utilisateur.email || null,
          }
        : null,
      dateModification: transaction.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/dons/eglise/export?format=csv|pdf&(mêmes filtres que la liste)
const exporterEglise = async (req, res) => {
  try {
    const format = req.query.format === 'pdf' ? 'pdf' : 'csv';
    const filtre = await construireFiltre(req);

    const [transactions, resume] = await Promise.all([
      TransactionDon.find(filtre)
        .populate('utilisateur', 'nom telephone')
        .sort({ createdAt: -1 })
        .limit(MAX_EXPORT),
      calculerResume(req.user.village, req.query),
    ]);

    await req.user.populate('village', 'nom');
    const contexte = {
      eglise: req.user.village?.nom || 'Église',
      debut: req.query.debut,
      fin: req.query.fin,
      resume,
    };

    if (format === 'pdf') envoyerRapportPdf(transactions, contexte, res);
    else envoyerCsv(transactions, contexte, res);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = { resumeEglise, transactionsEglise, transactionEglise, exporterEglise };
