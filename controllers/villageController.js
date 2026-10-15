const Village = require('../models/Village');
const VillageAdmin = require('../models/VillageAdmin');
const Abonnement = require('../models/Abonnement');
const Groupe = require('../models/Groupe');
const DemandeGroupe = require('../models/DemandeGroupe');
const MessageGroupe = require('../models/MessageGroupe');

// @route POST /api/villages
// Réservé au Super Admin
const creerVillage = async (req, res) => {
  try {
    const { nom, region, departement, description } = req.body;

    const existant = await Village.findOne({ nom: nom.trim() });
    if (existant) {
      return res.status(400).json({ message: 'Une église avec ce nom existe déjà.' });
    }

    const village = await Village.create({ nom, region, departement, description });
    res.status(201).json(village);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/villages
// Public : utilisé par l'app mobile pour lister tous les villages disponibles
const listerVillages = async (req, res) => {
  try {
    const villages = await Village.find({ statut: 'actif' }).sort({ nom: 1 });
    res.json(villages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/villages/tous
// Réservé au Super Admin : liste TOUS les villages (actifs + inactifs) avec infos admin
const listerTousLesVillages = async (req, res) => {
  try {
    // Le Super Admin voit le numéro Wave de chaque église (reversements)
    const villages = await Village.find().select('+numeroWave +numeroWaveModifieLe').sort({ createdAt: -1 });

    // Pour chaque village, on vérifie s'il a déjà un admin
    const villagesAvecAdmin = await Promise.all(
      villages.map(async (village) => {
        const comptes = await VillageAdmin.find({ village: village._id }).select(
          'nom telephone email statut role abonnementExpireLe'
        );
        const admin = comptes.find((c) => c.role !== 'tresorier');
        const tresorier = comptes.find((c) => c.role === 'tresorier');
        return { ...village.toObject(), admin: admin || null, tresorier: tresorier || null };
      })
    );

    res.json(villagesAvecAdmin);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/villages/:id
const obtenirVillage = async (req, res) => {
  try {
    const village = await Village.findById(req.params.id);
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    res.json(village);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/villages/:id
// Réservé au Super Admin
const modifierVillage = async (req, res) => {
  try {
    const { nom, region, departement, description, statut, photoCouverture } = req.body;

    const village = await Village.findById(req.params.id);
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    if (nom) village.nom = nom;
    if (region) village.region = region;
    if (departement) village.departement = departement;
    if (description) village.description = description;
    if (statut) village.statut = statut;
    if (photoCouverture) village.photoCouverture = photoCouverture;

    const villageModifie = await village.save();
    res.json(villageModifie);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/villages/:id
// Réservé au Super Admin : supprime le village ainsi que son compte
// administrateur associé, les abonnements liés et les groupes de l'église
// (avec leurs demandes et messages), s'ils existent
// (suppression en cascade).
const supprimerVillage = async (req, res) => {
  try {
    const village = await Village.findById(req.params.id);
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    // Comptes de l'église (admin et trésorier) et leurs abonnements
    const comptes = await VillageAdmin.find({ village: village._id }).select('_id');
    const idsComptes = comptes.map((c) => c._id);
    await Abonnement.deleteMany({ villageAdmin: { $in: idsComptes } });
    await VillageAdmin.deleteMany({ _id: { $in: idsComptes } });
    const idsGroupes = (await Groupe.find({ village: village._id }).select('_id')).map((g) => g._id);
    await DemandeGroupe.deleteMany({ groupe: { $in: idsGroupes } });
    await MessageGroupe.deleteMany({ groupe: { $in: idsGroupes } });
    await Groupe.deleteMany({ _id: { $in: idsGroupes } });
    await village.deleteOne();

    res.json({ message: 'Église supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Numéro Wave ivoirien : 10 chiffres commençant par 01, 05 ou 07, avec ou
// sans indicatif. Renvoie la forme "+225XXXXXXXXXX", ou null si invalide.
const normaliserNumeroWave = (saisie) => {
  let chiffres = String(saisie || '').replace(/[\s.()-]/g, '');
  if (chiffres.startsWith('+225')) chiffres = chiffres.slice(4);
  else if (chiffres.startsWith('00225')) chiffres = chiffres.slice(5);
  else if (chiffres.length === 13 && chiffres.startsWith('225')) chiffres = chiffres.slice(3);
  return /^0[157]\d{8}$/.test(chiffres) ? `+225${chiffres}` : null;
};

// @route GET /api/villages/mon-eglise/parametres
// Admin et trésorier de l'église : paramètres de leur église
const parametresMonEglise = async (req, res) => {
  try {
    const village = await Village.findById(req.user.village).select(
      'nom +numeroWave +numeroWaveModifieLe'
    );
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    res.json({
      nom: village.nom,
      numeroWave: village.numeroWave || null,
      numeroWaveModifieLe: village.numeroWaveModifieLe || null,
      modifiable: req.user.role === 'tresorier',
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/villages/mon-eglise/numero-wave
// Réservé au trésorier : enregistre le numéro Wave de l'église
const modifierNumeroWave = async (req, res) => {
  try {
    const numero = normaliserNumeroWave(req.body.numeroWave);
    if (!numero) {
      return res.status(400).json({
        message: 'Numéro Wave invalide. Saisissez un numéro ivoirien à 10 chiffres (ex : 07 00 00 00 00).',
      });
    }

    const village = await Village.findByIdAndUpdate(
      req.user.village,
      { numeroWave: numero, numeroWaveModifieLe: new Date() },
      { new: true }
    ).select('nom +numeroWave +numeroWaveModifieLe');
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    res.json({
      nom: village.nom,
      numeroWave: village.numeroWave,
      numeroWaveModifieLe: village.numeroWaveModifieLe,
      modifiable: true,
      message: 'Numéro Wave enregistré.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  parametresMonEglise,
  modifierNumeroWave,
  normaliserNumeroWave,
  creerVillage,
  listerVillages,
  listerTousLesVillages,
  obtenirVillage,
  modifierVillage,
  supprimerVillage,
};
