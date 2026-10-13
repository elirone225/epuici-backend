const express = require('express');
const router = express.Router();
const {
  loginSuperAdmin,
  loginVillageAdmin,
  creerVillageAdmin,
  modifierVillageAdmin,
  getMonProfil,
  modifierMotDePasseVillageAdmin,
  modifierMotDePasseSuperAdmin,
} = require('../controllers/authController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

// Connexion
router.post('/superadmin/login', loginSuperAdmin);
router.post('/villageadmin/login', loginVillageAdmin);

// Création d'un Village Admin - réservé au Super Admin uniquement
router.post('/villageadmin/creer', protect, autoriserRoles('superadmin'), creerVillageAdmin);

// Profil de l'utilisateur connecté (superadmin ou villageadmin)
router.get('/me', protect, getMonProfil);

// Le Village Admin change son propre mot de passe quand il le souhaite
// (route fixe déclarée avant /villageadmin/:id pour éviter tout conflit)
router.put(
  '/villageadmin/mot-de-passe',
  protect,
  autoriserRoles('villageadmin'),
  modifierMotDePasseVillageAdmin
);

// Modification d'un Village Admin par le Super Admin (identifiant, mot de passe, statut...)
router.put('/villageadmin/:id', protect, autoriserRoles('superadmin'), modifierVillageAdmin);

// Le Super Admin change son propre mot de passe quand il le souhaite
router.put(
  '/superadmin/mot-de-passe',
  protect,
  autoriserRoles('superadmin'),
  modifierMotDePasseSuperAdmin
);

module.exports = router;
