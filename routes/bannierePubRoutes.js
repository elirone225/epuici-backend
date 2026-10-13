const express = require('express');
const router = express.Router();
const {
  creerBannierePub,
  listerBannieresPub,
  supprimerBannierePub,
} = require('../controllers/bannierePubController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const { uploadImageBannierePub } = require('../middleware/uploadMiddleware');

// Public : bandes pub affichées dans l'app mobile
router.get('/', listerBannieresPub);

// Réservé au Super Admin
router.post(
  '/',
  protect,
  autoriserRoles('superadmin'),
  uploadImageBannierePub,
  creerBannierePub
);
router.delete('/:id', protect, autoriserRoles('superadmin'), supprimerBannierePub);

module.exports = router;
