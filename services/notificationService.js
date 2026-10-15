const { getMessaging } = require('firebase-admin/messaging');
const appFirebase = require('../config/firebase');
const Utilisateur = require('../models/Utilisateur');

const messaging = appFirebase ? getMessaging(appFirebase) : null;

// FCM limite les envois multicast à 500 tokens par appel
const TAILLE_PAQUET = 500;

const envoyerNotificationsMulticast = async (tokens, { title, body, data = {} }) => {
  if (!messaging || !tokens || tokens.length === 0) return;

  const donnees = Object.fromEntries(
    Object.entries(data).map(([cle, valeur]) => [cle, String(valeur)])
  );

  for (let i = 0; i < tokens.length; i += TAILLE_PAQUET) {
    const paquet = tokens.slice(i, i + TAILLE_PAQUET);
    try {
      await messaging.sendEachForMulticast({
        tokens: paquet,
        notification: { title, body },
        data: donnees,
      });
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

module.exports = { envoyerNotificationsMulticast, notifierAbonnesDuVillage, notifierFidelesDuVillage, accepte };
