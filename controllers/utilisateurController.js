const crypto = require('crypto');
const Utilisateur = require('../models/Utilisateur');
const Village = require('../models/Village');
const Groupe = require('../models/Groupe');
const DemandeGroupe = require('../models/DemandeGroupe');
const generateToken = require('../utils/generateToken');
const { envoyerCodeReinitialisation } = require('../services/emailService');

const MAX_VILLAGES_SUIVIS = 5;
const DUREE_VALIDITE_CODE_MS = 15 * 60 * 1000;

const hacherCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

// @route POST /api/utilisateurs/inscription
const inscrireUtilisateur = async (req, res) => {
  try {
    const { nom, telephone, email, motDePasse } = req.body;

    const existant = await Utilisateur.findOne({ telephone });
    if (existant) {
      return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
    }

    if (email) {
      const emailExistant = await Utilisateur.findOne({ email: email.toLowerCase().trim() });
      if (emailExistant) {
        return res.status(400).json({ message: 'Cet e-mail est déjà utilisé.' });
      }
    }

    const utilisateur = await Utilisateur.create({
      nom,
      telephone,
      email: email ? email.toLowerCase().trim() : undefined,
      motDePasse,
      photoProfil: req.file ? req.file.path : undefined,
      derniereConnexion: new Date(),
    });

    res.status(201).json({
      _id: utilisateur._id,
      nom: utilisateur.nom,
      telephone: utilisateur.telephone,
      email: utilisateur.email,
      photoProfil: utilisateur.photoProfil,
      villagesSuivis: utilisateur.villagesSuivis,
      token: generateToken(utilisateur._id, 'utilisateur'),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/utilisateurs/mot-de-passe-oublie
// Envoie un code de réinitialisation à l'e-mail du compte, si celui-ci en a un.
// Répond toujours avec le même message (même si l'e-mail n'existe pas) pour
// éviter de révéler quels e-mails sont enregistrés.
const demanderReinitialisationMotDePasse = async (req, res) => {
  try {
    const { email } = req.body;
    const messageGenerique =
      "Si un compte est associé à cet e-mail, un code de réinitialisation vient d'être envoyé.";

    if (!email) {
      return res.status(400).json({ message: 'E-mail requis.' });
    }

    const utilisateur = await Utilisateur.findOne({ email: email.toLowerCase().trim() });
    if (!utilisateur) {
      return res.json({ message: messageGenerique });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    utilisateur.codeReinitialisation = hacherCode(code);
    utilisateur.codeReinitialisationExpire = new Date(Date.now() + DUREE_VALIDITE_CODE_MS);
    await utilisateur.save();

    await envoyerCodeReinitialisation(utilisateur.email, code);

    res.json({ message: messageGenerique });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/utilisateurs/reinitialiser-mot-de-passe
const reinitialiserMotDePasse = async (req, res) => {
  try {
    const { email, code, nouveauMotDePasse } = req.body;

    if (!email || !code || !nouveauMotDePasse) {
      return res.status(400).json({ message: 'E-mail, code et nouveau mot de passe requis.' });
    }
    if (nouveauMotDePasse.length < 6) {
      return res
        .status(400)
        .json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const utilisateur = await Utilisateur.findOne({ email: email.toLowerCase().trim() });
    if (
      !utilisateur ||
      !utilisateur.codeReinitialisation ||
      !utilisateur.codeReinitialisationExpire ||
      utilisateur.codeReinitialisationExpire < new Date() ||
      utilisateur.codeReinitialisation !== hacherCode(code)
    ) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    utilisateur.motDePasse = nouveauMotDePasse;
    utilisateur.codeReinitialisation = undefined;
    utilisateur.codeReinitialisationExpire = undefined;
    await utilisateur.save();

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/utilisateurs/login
const connecterUtilisateur = async (req, res) => {
  try {
    const { telephone, motDePasse } = req.body;
    const utilisateur = await Utilisateur.findOne({ telephone }).populate(
      'villagesSuivis',
      'nom region'
    );

    if (!utilisateur || !(await utilisateur.verifierMotDePasse(motDePasse))) {
      return res.status(401).json({ message: 'Téléphone ou mot de passe incorrect.' });
    }

    if (utilisateur.statut === 'bloque') {
      return res.status(403).json({ message: 'Ce compte a été bloqué.' });
    }

    utilisateur.derniereConnexion = new Date();
    await utilisateur.save();

    res.json({
      _id: utilisateur._id,
      nom: utilisateur.nom,
      telephone: utilisateur.telephone,
      photoProfil: utilisateur.photoProfil,
      villagesSuivis: utilisateur.villagesSuivis,
      token: generateToken(utilisateur._id, 'utilisateur'),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/utilisateurs/mon-profil
const monProfil = async (req, res) => {
  const utilisateur = await Utilisateur.findById(req.user._id).populate(
    'villagesSuivis',
    'nom region photoCouverture'
  );
  res.json(utilisateur);
};

// @route PUT /api/utilisateurs/mon-profil
const modifierMonProfil = async (req, res) => {
  try {
    const { nom, email, photoProfil, tokenNotification } = req.body;
    const utilisateur = await Utilisateur.findById(req.user._id);

    if (nom) utilisateur.nom = nom;
    if (email) {
      const emailExistant = await Utilisateur.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: utilisateur._id },
      });
      if (emailExistant) {
        return res.status(400).json({ message: 'Cet e-mail est déjà utilisé.' });
      }
      utilisateur.email = email.toLowerCase().trim();
    }
    if (req.file) utilisateur.photoProfil = req.file.path;
    else if (photoProfil) utilisateur.photoProfil = photoProfil;
    if (tokenNotification) utilisateur.tokenNotification = tokenNotification;

    const utilisateurModifie = await utilisateur.save();
    res.json(utilisateurModifie);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/utilisateurs/suivre/:villageId
// L'utilisateur suit un nouveau village (max 5)
const suivreVillage = async (req, res) => {
  try {
    const village = await Village.findById(req.params.villageId);
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    const utilisateur = await Utilisateur.findById(req.user._id);

    if (utilisateur.villagesSuivis.some((id) => id.toString() === req.params.villageId)) {
      return res.status(400).json({ message: 'Vous suivez déjà cette église.' });
    }

    if (utilisateur.villagesSuivis.length >= MAX_VILLAGES_SUIVIS) {
      return res.status(400).json({
        message: `Vous ne pouvez suivre que ${MAX_VILLAGES_SUIVIS} églises maximum. Retirez-en une pour en ajouter une nouvelle.`,
      });
    }

    utilisateur.villagesSuivis.push(village._id);
    await utilisateur.save();

    const utilisateurMisAJour = await Utilisateur.findById(req.user._id).populate(
      'villagesSuivis',
      'nom region'
    );

    res.json(utilisateurMisAJour);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/utilisateurs/ne-plus-suivre/:villageId
const neSuivreupPlusVillage = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findById(req.user._id);

    utilisateur.villagesSuivis = utilisateur.villagesSuivis.filter(
      (id) => id.toString() !== req.params.villageId
    );

    await utilisateur.save();

    const utilisateurMisAJour = await Utilisateur.findById(req.user._id).populate(
      'villagesSuivis',
      'nom region'
    );

    res.json(utilisateurMisAJour);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/utilisateurs
// Réservé au Super Admin : liste de tous les habitants inscrits
const listerUtilisateurs = async (req, res) => {
  try {
    const { page = 1, limite = 50 } = req.query;

    const utilisateurs = await Utilisateur.find()
      .select('-motDePasse')
      .populate('villagesSuivis', 'nom')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limite)
      .limit(Number(limite));

    const total = await Utilisateur.countDocuments();

    res.json({ utilisateurs, total, page: Number(page), totalPages: Math.ceil(total / limite) });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/utilisateurs/:id/bloquer
// Réservé au Super Admin
const bloquerUtilisateur = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findById(req.params.id);
    if (!utilisateur) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    utilisateur.statut = utilisateur.statut === 'bloque' ? 'actif' : 'bloque';
    await utilisateur.save();
    res.json({ message: `Statut mis à jour : ${utilisateur.statut}`, statut: utilisateur.statut });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/utilisateurs/:id
// Réservé au Super Admin : supprime définitivement un compte habitant
const supprimerUtilisateur = async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findById(req.params.id);
    if (!utilisateur) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // Le retire de ses groupes ; ses anciens messages restent (auteur supprimé)
    await Groupe.updateMany(
      { membres: utilisateur._id },
      { $pull: { membres: utilisateur._id, responsables: utilisateur._id } }
    );
    await DemandeGroupe.deleteMany({ utilisateur: utilisateur._id });
    await utilisateur.deleteOne();
    res.json({ message: 'Utilisateur supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/utilisateurs/mon-village/abonnes
// Réservé au Village Admin : liste des habitants qui suivent SON village,
// avec une estimation du nombre "actifs maintenant" (connectés dans les 15 dernières minutes)
const abonnesDeMonVillage = async (req, res) => {
  try {
    const villageId = req.user.village;

    const abonnes = await Utilisateur.find({ villagesSuivis: villageId })
      .select('nom telephone derniereConnexion createdAt')
      .sort({ derniereConnexion: -1 });

    const quinzeMinutesAvant = new Date(Date.now() - 15 * 60 * 1000);
    const actifsMaintenant = abonnes.filter(
      (u) => u.derniereConnexion && new Date(u.derniereConnexion) > quinzeMinutesAvant
    ).length;

    res.json({
      total: abonnes.length,
      actifsMaintenant,
      abonnes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/utilisateurs/token-notification
// Enregistre/rafraîchit le token FCM de l'appareil pour les notifications push
const enregistrerTokenNotification = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token manquant.' });
    }

    await Utilisateur.updateOne({ _id: req.user._id }, { tokenNotification: token });
    res.json({ message: 'Token enregistré.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  inscrireUtilisateur,
  connecterUtilisateur,
  demanderReinitialisationMotDePasse,
  reinitialiserMotDePasse,
  monProfil,
  modifierMonProfil,
  enregistrerTokenNotification,
  suivreVillage,
  neSuivreupPlusVillage,
  listerUtilisateurs,
  bloquerUtilisateur,
  supprimerUtilisateur,
  abonnesDeMonVillage,
};
