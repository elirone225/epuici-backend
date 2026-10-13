const express = require('express');
const router = express.Router();
const {
  creerOffre,
  listerOffresParVillage,
  obtenirOffre,
  mesOffres,
  modifierOffre,
  supprimerOffre,
} = require('../controllers/immoController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');
const { uploadPhotosImmo } = require('../middleware/uploadMiddleware');

// Village Admin
router.get('/mes-offres', protect, autoriserRoles('villageadmin'), mesOffres);

router.post(
  '/',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  uploadPhotosImmo,
  creerOffre
);

router.put(
  '/:id',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  uploadPhotosImmo,
  modifierOffre
);

router.delete('/:id', protect, autoriserRoles('villageadmin'), supprimerOffre);

// Public (app mobile)
router.get('/village/:villageId', listerOffresParVillage);
router.get('/:id', obtenirOffre);

module.exports = router;
