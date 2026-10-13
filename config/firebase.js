const { initializeApp, cert, getApps } = require('firebase-admin/app');

// En local : le fichier config/firebase-service-account.json (non versionné).
// En hébergement (Render, etc.) : le contenu JSON collé dans la variable
// d'environnement FIREBASE_SERVICE_ACCOUNT_JSON, car on ne peut pas y déposer
// de fichier secret directement.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : require('./firebase-service-account.json');

const appFirebase = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(serviceAccount) });

module.exports = appFirebase;
