const express = require('express');
const router = express.Router();
const {
  creerDemandePriere,
  murDePriere,
  mesDemandes,
  basculerPriere,
  marquerExaucee,
  supprimerMaDemande,
  demandesDeMonVillage,
  changerStatutDemande,
  retirerDuMur,
  supprimerDemande,
} = require('../controllers/demandePriereController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

const fidele = [protect, autoriserRoles('utilisateur')];
const admin = [protect, autoriserRoles('villageadmin')];

// Fidèle connecté : envoie une demande de prière (privée pour l'admin de
// son église, ou publique sur le mur de prière)
router.post('/', ...fidele, creerDemandePriere);
router.get('/mur', ...fidele, murDePriere);
router.get('/mes-demandes', ...fidele, mesDemandes);
router.post('/:id/prie', ...fidele, basculerPriere);
router.put('/:id/exaucee', ...fidele, marquerExaucee);
router.delete('/:id/mienne', ...fidele, supprimerMaDemande);

// Village Admin : consulte, traite et modère les demandes de son église
router.get('/mon-village', ...admin, demandesDeMonVillage);
router.put('/:id/statut', ...admin, changerStatutDemande);
router.put('/:id/retirer-du-mur', ...admin, retirerDuMur);
router.delete('/:id', ...admin, supprimerDemande);

module.exports = router;
