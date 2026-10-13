const express = require('express');
const router = express.Router();
const {
  creerAlerte,
  alertesDeMonVillage,
  changerStatutAlerte,
  supprimerAlerte,
  supprimerAlertes,
  bloquerEnvoiAlertesUtilisateur,
} = require('../controllers/alerteController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const { uploadPhotosAlerte } = require('../middleware/uploadMiddleware');

// Habitant connecté : envoie une alerte au Village Admin du village choisi
router.post('/', protect, autoriserRoles('utilisateur'), uploadPhotosAlerte, creerAlerte);

// Village Admin : voit et traite les alertes reçues pour son village
router.get('/mon-village', protect, autoriserRoles('villageadmin'), alertesDeMonVillage);
router.put('/:id/statut', protect, autoriserRoles('villageadmin'), changerStatutAlerte);
router.delete('/', protect, autoriserRoles('villageadmin'), supprimerAlertes);
router.delete('/:id', protect, autoriserRoles('villageadmin'), supprimerAlerte);
router.put(
  '/utilisateur/:utilisateurId/bloquer',
  protect,
  autoriserRoles('villageadmin'),
  bloquerEnvoiAlertesUtilisateur
);

module.exports = router;
