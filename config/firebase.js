const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');

// En local : le fichier config/firebase-service-account.json (non versionné).
// En hébergement (Render, etc.) : le contenu JSON collé dans la variable
// d'environnement FIREBASE_SERVICE_ACCOUNT_JSON, car on ne peut pas y déposer
// de fichier secret directement.
// Sans aucune des deux, le serveur démarre quand même mais les notifications
// push sont désactivées (appFirebase vaut null).
const cheminFichier = path.join(__dirname, 'firebase-service-account.json');

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else if (fs.existsSync(cheminFichier)) {
  serviceAccount = require(cheminFichier);
} else {
  console.warn('Identifiants Firebase absents — notifications push désactivées.');
}

const appFirebase = serviceAccount
  ? getApps()[0] || initializeApp({ credential: cert(serviceAccount) })
  : null;

module.exports = appFirebase;
