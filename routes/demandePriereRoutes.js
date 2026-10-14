const express = require('express');
const router = express.Router();
const {
  creerDemandePriere,
  demandesDeMonVillage,
  changerStatutDemande,
  supprimerDemande,
} = require('../controllers/demandePriereController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

// Fidèle connecté : envoie une demande de prière à l'admin de son église
router.post('/', protect, autoriserRoles('utilisateur'), creerDemandePriere);

// Village Admin : consulte et traite les demandes reçues par son église
router.get('/mon-village', protect, autoriserRoles('villageadmin'), demandesDeMonVillage);
router.put('/:id/statut', protect, autoriserRoles('villageadmin'), changerStatutDemande);
router.delete('/:id', protect, autoriserRoles('villageadmin'), supprimerDemande);

module.exports = router;
