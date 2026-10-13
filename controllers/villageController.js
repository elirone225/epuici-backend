const Village = require('../models/Village');
const VillageAdmin = require('../models/VillageAdmin');
const Abonnement = require('../models/Abonnement');

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
    const villages = await Village.find().sort({ createdAt: -1 });

    // Pour chaque village, on vérifie s'il a déjà un admin
    const villagesAvecAdmin = await Promise.all(
      villages.map(async (village) => {
        const admin = await VillageAdmin.findOne({ village: village._id }).select(
          'nom telephone statut abonnementExpireLe'
        );
        return { ...village.toObject(), admin: admin || null };
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
// administrateur associé et les abonnements liés, s'ils existent
// (suppression en cascade).
const supprimerVillage = async (req, res) => {
  try {
    const village = await Village.findById(req.params.id);
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    const villageAdmin = await VillageAdmin.findOne({ village: village._id });
    if (villageAdmin) {
      await Abonnement.deleteMany({ villageAdmin: villageAdmin._id });
      await villageAdmin.deleteOne();
    }
    await village.deleteOne();

    res.json({ message: 'Église supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerVillage,
  listerVillages,
  listerTousLesVillages,
  obtenirVillage,
  modifierVillage,
  supprimerVillage,
};
