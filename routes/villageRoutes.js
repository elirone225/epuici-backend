const express = require('express');
const router = express.Router();
const {
  creerVillage,
  listerVillages,
  listerTousLesVillages,
  obtenirVillage,
  modifierVillage,
  supprimerVillage,
} = require('../controllers/villageController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

// Routes Super Admin (avant /:id pour éviter les conflits de route)
router.get('/tous', protect, autoriserRoles('superadmin'), listerTousLesVillages);
router.post('/', protect, autoriserRoles('superadmin'), creerVillage);
router.put('/:id', protect, autoriserRoles('superadmin'), modifierVillage);
router.delete('/:id', protect, autoriserRoles('superadmin'), supprimerVillage);

// Routes publiques (app mobile)
router.get('/', listerVillages);
router.get('/:id', obtenirVillage);

module.exports = router;
