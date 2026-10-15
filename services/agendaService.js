const Evenement = require('../models/Evenement');
const Utilisateur = require('../models/Utilisateur');
const { envoyerNotificationsMulticast, accepte } = require('./notificationService');

// Agenda : export calendrier (.ics, Google Agenda) et rappels de notification

const FUSEAU = 'Africa/Abidjan';

const heureLocale = (date) =>
  new Date(date).toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' });

const dateLocale = (date) =>
  new Date(date).toLocaleDateString('fr-FR', {
    timeZone: FUSEAU,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

// 2026-10-15T09:30:00.000Z -> 20261015T093000Z
const dateIcs = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const echapperIcs = (texte = '') =>
  String(texte).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Les lignes d'un fichier .ics ne doivent pas dépasser 75 octets
const plierLigne = (ligne) => {
  const morceaux = [];
  let courant = '';
  for (const caractere of ligne) {
    if (Buffer.byteLength(courant + caractere) > 74) {
      morceaux.push(courant);
      courant = ' ' + caractere;
    } else {
      courant += caractere;
    }
  }
  morceaux.push(courant);
  return morceaux.join('\r\n');
};

// Fichier calendrier : ouvert par l'agenda du téléphone (iPhone, Android),
// avec une alarme une heure avant
const genererIcs = (evenement, nomEglise) => {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EPUICI//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evenement._id}@epuici`,
    `DTSTAMP:${dateIcs(new Date())}`,
    `DTSTART:${dateIcs(evenement.dateDebut)}`,
    `DTEND:${dateIcs(evenement.finEffective())}`,
    `SUMMARY:${echapperIcs(evenement.titre)}`,
    `DESCRIPTION:${echapperIcs([nomEglise, evenement.description].filter(Boolean).join('\n\n'))}`,
    ...(evenement.lieu ? [`LOCATION:${echapperIcs(evenement.lieu)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${echapperIcs(evenement.titre)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lignes.map(plierLigne).join('\r\n') + '\r\n';
};

const lienGoogleAgenda = (evenement, nomEglise) => {
  const parametres = new URLSearchParams({
    action: 'TEMPLATE',
    text: evenement.titre,
    dates: `${dateIcs(evenement.dateDebut)}/${dateIcs(evenement.finEffective())}`,
    details: [nomEglise, evenement.description].filter(Boolean).join('\n\n'),
    location: evenement.lieu || '',
  });
  return `https://calendar.google.com/calendar/render?${parametres}`;
};

// --- Rappels ---

const UNE_HEURE = 60 * 60 * 1000;

const envoyerRappel = async (evenement, quand) => {
  const ids = evenement.participants.filter((p) => p.rappel).map((p) => p.utilisateur);
  if (ids.length === 0) return 0;

  const fideles = await Utilisateur.find({
    _id: { $in: ids },
    villagesSuivis: evenement.village,
    tokenNotification: { $exists: true, $ne: null },
    ...accepte('rappels'),
  }).select('tokenNotification');
  const tokens = fideles.map((f) => f.tokenNotification).filter(Boolean);

  const lieu = evenement.lieu ? ` — ${evenement.lieu}` : '';
  await envoyerNotificationsMulticast(tokens, {
    title: `Rappel : ${evenement.titre}`,
    body:
      quand === 'veille'
        ? `${dateLocale(evenement.dateDebut)} à ${heureLocale(evenement.dateDebut)}${lieu}`
        : `Dans une heure, à ${heureLocale(evenement.dateDebut)}${lieu}`,
    data: { type: 'evenement', evenementId: evenement._id.toString() },
  });
  return tokens.length;
};

// Envoie les rappels arrivés à échéance : la veille (24 h avant) et une
// heure avant. Chaque rappel est d'abord marqué "envoyé" de façon atomique,
// donc deux exécutions simultanées n'envoient jamais deux fois.
const envoyerRappelsDus = async () => {
  const maintenant = new Date();
  let envoyes = 0;

  // Rappel de la veille : seulement s'il reste plus de 2 h (sinon le
  // rappel "une heure avant" suffit)
  for (;;) {
    const evenement = await Evenement.findOneAndUpdate(
      {
        rappelVeilleEnvoyeLe: null,
        dateDebut: { $gt: maintenant, $lte: new Date(maintenant.getTime() + 24 * UNE_HEURE) },
      },
      { rappelVeilleEnvoyeLe: maintenant },
      { new: true }
    );
    if (!evenement) break;
    if (evenement.dateDebut - maintenant > 2 * UNE_HEURE) {
      envoyes += await envoyerRappel(evenement, 'veille');
    }
  }

  for (;;) {
    const evenement = await Evenement.findOneAndUpdate(
      {
        rappelHeureEnvoyeLe: null,
        dateDebut: { $gt: maintenant, $lte: new Date(maintenant.getTime() + 75 * 60 * 1000) },
      },
      { rappelHeureEnvoyeLe: maintenant },
      { new: true }
    );
    if (!evenement) break;
    envoyes += await envoyerRappel(evenement, 'heure');
  }

  return envoyes;
};

// Vérification régulière tant que le serveur tourne. Sur l'offre gratuite
// de Render, le serveur s'endort après 15 min sans visite : la route
// POST /api/evenements/rappels/executer, appelée par une tâche planifiée,
// le réveille et envoie les rappels en retard.
const demarrerRappelsAutomatiques = () => {
  const executer = () =>
    envoyerRappelsDus().catch((error) => console.error('Rappels agenda :', error.message));
  setTimeout(executer, 30 * 1000);
  setInterval(executer, 5 * 60 * 1000);
};

module.exports = {
  genererIcs,
  lienGoogleAgenda,
  envoyerRappelsDus,
  demarrerRappelsAutomatiques,
  dateLocale,
  heureLocale,
};
