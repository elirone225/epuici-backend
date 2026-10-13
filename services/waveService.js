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

module.exports = { initierPaiementWave };
