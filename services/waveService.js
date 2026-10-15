const axios = require('axios');

// NOTE : ce service est prêt à être branché dès que tu as tes identifiants
// Wave Business. En attendant, si WAVE_API_KEY n'est pas configuré,
// on simule un lien de paiement pour ne pas bloquer le développement.

const initierPaiementWave = async ({ montant, referenceCommande, description }) => {
  if (!process.env.WAVE_API_KEY) {
    console.warn('WAVE_API_KEY non configuré — mode simulation activé.');
    return {
      lienPaiement: `https://paiement-simule.epuici.local/${referenceCommande}`,
      idTransaction: `SIMULATION-${referenceCommande}`,
      simulation: true,
    };
  }

  try {
    // Structure indicative de l'appel à l'API Wave Checkout.
    // À ajuster selon la documentation exacte fournie par Wave Business
    // une fois ton compte marchand activé.
    const response = await axios.post(
      'https://api.wave.com/v1/checkout/sessions',
      {
        amount: montant,
        currency: 'XOF',
        client_reference: referenceCommande,
        success_url: `${process.env.ADMIN_URL}/paiement/succes`,
        error_url: `${process.env.ADMIN_URL}/paiement/echec`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      lienPaiement: response.data.wave_launch_url,
      idTransaction: response.data.id,
      simulation: false,
    };
  } catch (error) {
    console.error('Erreur Wave :', error.response?.data || error.message);
    throw new Error("Impossible d'initier le paiement Wave.");
  }
};

// ---------------------------------------------------------------------------
// Dons & dîmes des fidèles : API Wave Checkout
// https://docs.wave.com/checkout
//
// Variables d'environnement :
//   WAVE_API_KEY          clé API Wave Business (obligatoire en production)
//   WAVE_WEBHOOK_SECRET   secret du webhook configuré dans le portail Wave
//   WAVE_SIGNING_SECRET   facultatif : secret de signature des requêtes, si
//                         la clé API a été créée avec la signature activée
//   WAVE_SIMULATION=true  facultatif : sans clé Wave, simule les paiements
//                         (tests uniquement, jamais en production réelle)
// ---------------------------------------------------------------------------

const crypto = require('crypto');

const WAVE_API = 'https://api.wave.com/v1';

const waveConfigure = () => Boolean(process.env.WAVE_API_KEY);
const simulationActive = () => !waveConfigure() && process.env.WAVE_SIMULATION === 'true';

// En-têtes d'un appel à l'API Wave (avec signature si WAVE_SIGNING_SECRET)
const enTetesWave = (corps = '') => {
  const enTetes = {
    Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (process.env.WAVE_SIGNING_SECRET) {
    const horodatage = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', process.env.WAVE_SIGNING_SECRET)
      .update(`${horodatage}${corps}`)
      .digest('hex');
    enTetes['Wave-Signature'] = `t=${horodatage},v1=${signature}`;
  }
  return enTetes;
};

const messageErreurWave = (error) => {
  const details = error.response?.data;
  console.error('Erreur Wave :', details || error.message);
  return details?.message || error.message;
};

// Crée une session de paiement. Renvoie { id, wave_launch_url, ... }.
// cleIdempotence : évite de créer deux sessions si l'appel est rejoué.
const creerSessionCheckout = async ({ montant, referenceClient, urlSucces, urlErreur, cleIdempotence }) => {
  const corps = JSON.stringify({
    amount: String(Math.round(montant)), // XOF : montant entier, envoyé en texte
    currency: 'XOF',
    client_reference: referenceClient,
    success_url: urlSucces,
    error_url: urlErreur,
  });

  try {
    const { data } = await axios.post(`${WAVE_API}/checkout/sessions`, corps, {
      headers: { ...enTetesWave(corps), 'Idempotency-Key': cleIdempotence },
      timeout: 20000,
    });
    return data;
  } catch (error) {
    const message = messageErreurWave(error);
    throw new Error(`Impossible de créer le paiement Wave (${message}).`);
  }
};

// Relit une session auprès de Wave (réconciliation côté serveur)
const obtenirSessionCheckout = async (idSession) => {
  try {
    const { data } = await axios.get(`${WAVE_API}/checkout/sessions/${idSession}`, {
      headers: enTetesWave(),
      timeout: 15000,
    });
    return data;
  } catch (error) {
    messageErreurWave(error);
    return null;
  }
};

// Ferme une session encore ouverte (paiement annulé par le fidèle)
const expirerSessionCheckout = async (idSession) => {
  try {
    await axios.post(`${WAVE_API}/checkout/sessions/${idSession}/expire`, '', {
      headers: enTetesWave(),
      timeout: 15000,
    });
    return true;
  } catch (error) {
    messageErreurWave(error);
    return false;
  }
};

const egaliteSure = (a, b) => {
  const tamponA = Buffer.from(a, 'utf8');
  const tamponB = Buffer.from(b, 'utf8');
  return tamponA.length === tamponB.length && crypto.timingSafeEqual(tamponA, tamponB);
};

// Vérifie qu'un webhook vient bien de Wave. Deux stratégies possibles selon
// la configuration du webhook dans le portail Wave :
// - "Signing secret" : en-tête Wave-Signature: t=<horodatage>,v1=<hmac>
//   où hmac = HMAC-SHA256(secret, horodatage + corps brut)
// - "Shared secret"  : en-tête Authorization: Bearer <secret>
const TOLERANCE_HORODATAGE = 5 * 60; // secondes

const verifierSignatureWebhook = (req) => {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) return false;

  const enTeteSignature = req.headers['wave-signature'];
  if (enTeteSignature) {
    const parties = enTeteSignature.split(',').map((p) => p.trim().split('='));
    const horodatage = parties.find(([cle]) => cle === 't')?.[1];
    const signatures = parties.filter(([cle]) => cle === 'v1').map(([, valeur]) => valeur);
    if (!horodatage || signatures.length === 0 || !req.rawBody) return false;

    const ecart = Math.abs(Math.floor(Date.now() / 1000) - Number(horodatage));
    if (!Number.isFinite(ecart) || ecart > TOLERANCE_HORODATAGE) return false;

    const attendue = crypto
      .createHmac('sha256', secret)
      .update(horodatage + req.rawBody.toString('utf8'))
      .digest('hex');
    return signatures.some((s) => egaliteSure(s, attendue));
  }

  const autorisation = req.headers.authorization || '';
  return autorisation.startsWith('Bearer ') && egaliteSure(autorisation.slice(7), secret);
};

module.exports = {
  initierPaiementWave,
  waveConfigure,
  simulationActive,
  creerSessionCheckout,
  obtenirSessionCheckout,
  expirerSessionCheckout,
  verifierSignatureWebhook,
};
