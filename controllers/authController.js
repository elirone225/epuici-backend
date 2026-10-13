const SuperAdmin = require('../models/SuperAdmin');
const VillageAdmin = require('../models/VillageAdmin');
const Village = require('../models/Village');
const generateToken = require('../utils/generateToken');

// @route POST /api/auth/superadmin/login
const loginSuperAdmin = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    const superAdmin = await SuperAdmin.findOne({ email });

    if (!superAdmin || !(await superAdmin.verifierMotDePasse(motDePasse))) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    res.json({
      _id: superAdmin._id,
      nom: superAdmin.nom,
      email: superAdmin.email,
      role: 'superadmin',
      token: generateToken(superAdmin._id, 'superadmin'),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/auth/villageadmin/login
const loginVillageAdmin = async (req, res) => {
  try {
    const { telephone, motDePasse } = req.body;
    const admin = await VillageAdmin.findOne({ telephone }).populate('village', 'nom region');

    if (!admin || !(await admin.verifierMotDePasse(motDePasse))) {
      return res.status(401).json({ message: 'Téléphone ou mot de passe incorrect.' });
    }

    if (admin.statut === 'suspendu') {
      return res.status(403).json({ message: 'Ce compte a été suspendu par le Super Admin.' });
    }

    res.json({
      _id: admin._id,
      nom: admin.nom,
      telephone: admin.telephone,
      village: admin.village,
      role: 'villageadmin',
      abonnementActif: admin.abonnementEstValide(),
      abonnementExpireLe: admin.abonnementExpireLe,
      token: generateToken(admin._id, 'villageadmin'),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/auth/villageadmin/creer
// Réservé au Super Admin : c'est lui, et lui seul, qui crée les comptes Village Admin
const creerVillageAdmin = async (req, res) => {
  try {
    const { nom, telephone, email, motDePasse, villageId } = req.body;

    const village = await Village.findById(villageId);
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    const adminExistant = await VillageAdmin.findOne({ village: villageId });
    if (adminExistant) {
      return res.status(400).json({ message: 'Cette église a déjà un administrateur.' });
    }

    const telephoneExistant = await VillageAdmin.findOne({ telephone });
    if (telephoneExistant) {
      return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
    }

    const nouvelAdmin = await VillageAdmin.create({
      nom,
      telephone,
      email,
      motDePasse,
      village: villageId,
      creePar: req.user._id,
    });

    res.status(201).json({
      _id: nouvelAdmin._id,
      nom: nouvelAdmin.nom,
      telephone: nouvelAdmin.telephone,
      village: village.nom,
      message: "Compte admin d'église créé avec succès.",
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/auth/villageadmin/:id
// Réservé au Super Admin : modifie les informations d'un Village Admin
// (identifiant, mot de passe, statut...). Le mot de passe n'est changé
// que s'il est fourni.
const modifierVillageAdmin = async (req, res) => {
  try {
    const { nom, telephone, email, motDePasse, statut } = req.body;

    const admin = await VillageAdmin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin d'église introuvable." });
    }

    if (telephone && telephone !== admin.telephone) {
      const telephoneExistant = await VillageAdmin.findOne({
        telephone,
        _id: { $ne: admin._id },
      });
      if (telephoneExistant) {
        return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
      }
      admin.telephone = telephone;
    }

    if (nom) admin.nom = nom;
    if (email !== undefined) admin.email = email;
    if (statut && ['actif', 'suspendu'].includes(statut)) admin.statut = statut;

    if (motDePasse) {
      if (motDePasse.length < 6) {
        return res
          .status(400)
          .json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      }
      admin.motDePasse = motDePasse;
    }

    const adminModifie = await admin.save();

    res.json({
      _id: adminModifie._id,
      nom: adminModifie.nom,
      telephone: adminModifie.telephone,
      email: adminModifie.email,
      statut: adminModifie.statut,
      message: "Admin d'église modifié avec succès.",
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/auth/me
// Retourne les infos de l'utilisateur connecté (superadmin ou villageadmin)
const getMonProfil = async (req, res) => {
  res.json({ user: req.user, role: req.role });
};

// @route PUT /api/auth/villageadmin/mot-de-passe
// Permet à un Village Admin de changer son propre mot de passe à tout moment
const modifierMotDePasseVillageAdmin = async (req, res) => {
  try {
    const { motDePasseActuel, nouveauMotDePasse } = req.body;

    if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
      return res
        .status(400)
        .json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }

    const admin = await VillageAdmin.findById(req.user._id);
    if (!admin || !(await admin.verifierMotDePasse(motDePasseActuel))) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
    }

    admin.motDePasse = nouveauMotDePasse;
    await admin.save();

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/auth/superadmin/mot-de-passe
// Permet au Super Admin de changer son propre mot de passe à tout moment
const modifierMotDePasseSuperAdmin = async (req, res) => {
  try {
    const { motDePasseActuel, nouveauMotDePasse } = req.body;

    if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
      return res
        .status(400)
        .json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }

    const superAdmin = await SuperAdmin.findById(req.user._id);
    if (!superAdmin || !(await superAdmin.verifierMotDePasse(motDePasseActuel))) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
    }

    superAdmin.motDePasse = nouveauMotDePasse;
    await superAdmin.save();

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  loginSuperAdmin,
  loginVillageAdmin,
  creerVillageAdmin,
  modifierVillageAdmin,
  getMonProfil,
  modifierMotDePasseVillageAdmin,
  modifierMotDePasseSuperAdmin,
};
