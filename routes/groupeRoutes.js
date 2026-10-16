const express = require('express');
const router = express.Router();
const {
  groupesDeMonEglise,
  creerGroupe,
  modifierGroupe,
  supprimerGroupe,
  groupesDeLEglise,
  mesGroupes,
  demanderAdhesion,
  annulerDemande,
  quitterGroupe,
  detailGroupe,
  demandesDuGroupe,
  traiterDemande,
  retirerMembre,
  listerMessages,
  envoyerMessage,
  supprimerMessage,
  exigerMembreGroupe,
  totalNonLus,
  marquerLu,
  modifierPreferences,
  creerSondage,
  voterSondage,
  fermerSondage,
} = require('../controllers/groupeController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');
const { uploadMediaGroupe } = require('../middleware/uploadMiddleware');

const admin = [protect, autoriserRoles('villageadmin')];
const fidele = [protect, autoriserRoles('utilisateur')];

// Admin de l'église
router.get('/mon-eglise', ...admin, groupesDeMonEglise);
router.post('/', ...admin, verifierAbonnementActif, creerGroupe);

// Fidèles (app mobile) — routes fixes avant les routes /:id
router.get('/mes-groupes', ...fidele, mesGroupes);
router.get('/non-lus', ...fidele, totalNonLus);
router.get('/eglise/:villageId', ...fidele, groupesDeLEglise);
router.put('/demandes/:demandeId', ...fidele, traiterDemande);

router.put('/:id', ...admin, modifierGroupe);
router.delete('/:id', ...admin, supprimerGroupe);

router.get('/:id', ...fidele, detailGroupe);
router.post('/:id/demande', ...fidele, demanderAdhesion);
router.delete('/:id/demande', ...fidele, annulerDemande);
router.post('/:id/quitter', ...fidele, quitterGroupe);
router.get('/:id/demandes', ...fidele, demandesDuGroupe);
router.delete('/:id/membres/:utilisateurId', ...fidele, retirerMembre);
router.get('/:id/messages', ...fidele, listerMessages);
router.post('/:id/messages', ...fidele, exigerMembreGroupe, uploadMediaGroupe, envoyerMessage);

// Lu / non lu, épinglage, sourdine
router.delete('/:id/messages/:messageId', ...fidele, supprimerMessage);
router.post('/:id/lu', ...fidele, marquerLu);
router.put('/:id/preferences', ...fidele, modifierPreferences);

// Sondages
router.post('/:id/sondages', ...fidele, creerSondage);
router.post('/:id/sondages/:messageId/vote', ...fidele, voterSondage);
router.post('/:id/sondages/:messageId/fermer', ...fidele, fermerSondage);

module.exports = router;
