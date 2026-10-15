const express = require('express');
const router = express.Router();
const {
  listerEvenements,
  obtenirEvenement,
  basculerParticipation,
  changerRappel,
  calendrierEvenement,
  evenementsDeMonEglise,
  creerEvenement,
  modifierEvenement,
  supprimerEvenement,
  participantsEvenement,
  executerRappels,
} = require('../controllers/evenementController');
const { protect, authFacultative, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');
const { uploadPhotoEvenement } = require('../middleware/uploadMiddleware');

// Tâche planifiée : envoi des rappels (protégée par CRON_SECRET)
router.post('/rappels/executer', executerRappels);

// Admin et trésorier de l'église (routes fixes avant /:id)
router.get('/mon-eglise', protect, autoriserRoles('villageadmin'), evenementsDeMonEglise);
router.post(
  '/',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  uploadPhotoEvenement,
  creerEvenement
);
router.put('/:id', protect, autoriserRoles('villageadmin'), uploadPhotoEvenement, modifierEvenement);
router.delete('/:id', protect, autoriserRoles('villageadmin'), supprimerEvenement);
router.get('/:id/participants', protect, autoriserRoles('villageadmin'), participantsEvenement);

// App mobile : lecture publique, personnalisée si le fidèle est connecté
router.get('/village/:villageId', authFacultative, listerEvenements);
router.get('/:id/calendrier.ics', calendrierEvenement);
router.get('/:id', authFacultative, obtenirEvenement);

// Fidèle connecté, membre de l'église
router.post('/:id/participer', protect, autoriserRoles('utilisateur'), basculerParticipation);
router.put('/:id/rappel', protect, autoriserRoles('utilisateur'), changerRappel);

module.exports = router;
