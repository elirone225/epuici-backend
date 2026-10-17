const { getMessaging } = require('firebase-admin/messaging');
const appFirebase = require('../config/firebase');
const Utilisateur = require('../models/Utilisateur');

const messaging = appFirebase ? getMessaging(appFirebase) : null;

// FCM limite les envois multicast à 500 tokens par appel
const TAILLE_PAQUET = 500;

const URL_PWA = (process.env.PWA_URL || 'https://epuici-app.web.app').replace(/\/$/, '');

// Adresse ouverte quand le fidèle touche la notification sur la PWA :
// l'app lit ?notif=<type>&<id> au démarrage et ouvre le bon écran
const lienPwa = (donnees) => {
  const parametres = new URLSearchParams();
  if (donnees.type) parametres.set('notif', donnees.type);
  for (const cle of ['articleId', 'evenementId', 'groupeId', 'alerteId', 'transactionId']) {
    if (donnees[cle]) parametres.set(cle, donnees[cle]);
  }
  return `${URL_PWA}/?${parametres.toString()}`;
};

// Jetons d'appareils qui ne reçoivent plus rien (app désinstallée,
// notifications révoquées) : on les oublie pour ne plus les viser
const ERREURS_JETON_MORT = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

const oublierJetons = async (tokens) => {
  if (!tokens.length) return;
  try {
    await Utilisateur.updateMany({ tokenNotification: { $in: tokens } }, { $unset: { tokenNotification: 1 } });
  } catch (error) {
    console.error('Erreur nettoyage jetons FCM:', error.message);
  }
};

const envoyerNotificationsMulticast = async (tokens, { title, body, data = {} }) => {
  if (!messaging || !tokens || tokens.length === 0) return;

  const donnees = Object.fromEntries(
    Object.entries(data).map(([cle, valeur]) => [cle, String(valeur)])
  );

  const uniques = [...new Set(tokens)];
  for (let i = 0; i < uniques.length; i += TAILLE_PAQUET) {
    const paquet = uniques.slice(i, i + TAILLE_PAQUET);
    try {
      const resultat = await messaging.sendEachForMulticast({
        tokens: paquet,
        notification: { title, body },
        data: donnees,
        webpush: {
          notification: { icon: `${URL_PWA}/icons/Icon-192.png`, badge: `${URL_PWA}/icons/Icon-192.png` },
          fcmOptions: { link: lienPwa(donnees) },
        },
        android: { priority: 'high' },
      });
      const morts = resultat.responses
        .map((r, index) => (!r.success && ERREURS_JETON_MORT.includes(r.error?.code) ? paquet[index] : null))
        .filter(Boolean);
      await oublierJetons(morts);
    } catch (error) {
      console.error('Erreur envoi notification FCM:', error.message);
    }
  }
};

// Filtre Mongo : fidèles qui n'ont pas coupé cette catégorie de notifications
// (publications, directs, groupes, rappels). Absent = accepté.
const accepte = (categorie) =>
  categorie ? { [`preferencesNotifications.${categorie}`]: { $ne: false } } : {};

// Notifie tous les habitants qui suivent le village de cet article publié
const notifierAbonnesDuVillage = async (article) => {
  try {
    const abonnes = await Utilisateur.find({
      villagesSuivis: article.village,
      tokenNotification: { $exists: true, $ne: null },
      ...accepte('publications'),
    }).select('tokenNotification');

    const tokens = abonnes.map((u) => u.tokenNotification).filter(Boolean);

    await envoyerNotificationsMulticast(tokens, {
      title: 'EPUICI',
      body: article.titre,
      data: {
        type: 'nouvel_article',
        articleId: article._id.toString(),
        villageId: article.village.toString(),
      },
    });
  } catch (error) {
    console.error('Erreur notification abonnés du village:', error.message);
  }
};

// Notifie tous les fidèles qui suivent l'église (ex : nouvel événement),
// sauf ceux qui ont coupé la catégorie donnée
const notifierFidelesDuVillage = async (villageId, message, categorie) => {
  try {
    const fideles = await Utilisateur.find({
      villagesSuivis: villageId,
      tokenNotification: { $exists: true, $ne: null },
      ...accepte(categorie),
    }).select('tokenNotification');
    await envoyerNotificationsMulticast(
      fideles.map((u) => u.tokenNotification).filter(Boolean),
      message
    );
  } catch (error) {
    console.error('Erreur notification fidèles du village:', error.message);
  }
};

const notificationsActives = () => Boolean(messaging);

module.exports = { notificationsActives, lienPwa, envoyerNotificationsMulticast, notifierAbonnesDuVillage, notifierFidelesDuVillage, accepte };
