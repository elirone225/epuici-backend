const express = require('express');
const router = express.Router();
const {
  creerVillage,
  listerVillages,
  listerTousLesVillages,
  obtenirVillage,
  modifierVillage,
  supprimerVillage,
  parametresMonEglise,
  modifierNumeroWave,
} = require('../controllers/villageController');
const { protect, autoriserRoles, autoriserTresorier } = require('../middleware/authMiddleware');

// Paramètres de l'église : lus par l'admin et le trésorier, numéro Wave
// modifiable par le trésorier seulement
router.get('/mon-eglise/parametres', protect, autoriserRoles('villageadmin'), parametresMonEglise);
router.put('/mon-eglise/numero-wave', protect, autoriserTresorier, modifierNumeroWave);

// Routes Super Admin (avant /:id pour éviter les conflits de route)
router.get('/tous', protect, autoriserRoles('superadmin'), listerTousLesVillages);
router.post('/', protect, autoriserRoles('superadmin'), creerVillage);
router.put('/:id', protect, autoriserRoles('superadmin'), modifierVillage);
router.delete('/:id', protect, autoriserRoles('superadmin'), supprimerVillage);

// Routes publiques (app mobile)
router.get('/', listerVillages);
router.get('/:id', obtenirVillage);

module.exports = router;
