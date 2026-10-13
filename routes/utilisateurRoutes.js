const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/utilisateurController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const { uploadPhotoProfil } = require('../middleware/uploadMiddleware');

// Public
router.post('/inscription', uploadPhotoProfil, inscrireUtilisateur);
router.post('/login', connecterUtilisateur);
router.post('/mot-de-passe-oublie', demanderReinitialisationMotDePasse);
router.post('/reinitialiser-mot-de-passe', reinitialiserMotDePasse);

// Utilisateur connecté
router.get('/mon-profil', protect, autoriserRoles('utilisateur'), monProfil);
router.put(
  '/mon-profil',
  protect,
  autoriserRoles('utilisateur'),
  uploadPhotoProfil,
  modifierMonProfil
);
router.put(
  '/token-notification',
  protect,
  autoriserRoles('utilisateur'),
  enregistrerTokenNotification
);
router.put('/suivre/:villageId', protect, autoriserRoles('utilisateur'), suivreVillage);
router.put(
  '/ne-plus-suivre/:villageId',
  protect,
  autoriserRoles('utilisateur'),
  neSuivreupPlusVillage
);

// Village Admin : voir les abonnés de son propre village
router.get(
  '/mon-village/abonnes',
  protect,
  autoriserRoles('villageadmin'),
  abonnesDeMonVillage
);

// Super Admin
router.get('/', protect, autoriserRoles('superadmin'), listerUtilisateurs);
router.put('/:id/bloquer', protect, autoriserRoles('superadmin'), bloquerUtilisateur);
router.delete('/:id', protect, autoriserRoles('superadmin'), supprimerUtilisateur);

module.exports = router;
