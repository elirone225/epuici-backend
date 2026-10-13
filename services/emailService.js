const nodemailer = require('nodemailer');

let transporteur;

function obtenirTransporteur() {
  if (!transporteur) {
    transporteur = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporteur;
}

async function envoyerCodeReinitialisation(email, code) {
  await obtenirTransporteur().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'EPUICI — Code de réinitialisation du mot de passe',
    text:
      `Voici votre code de réinitialisation : ${code}\n\n` +
      "Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
    html:
      `<p>Voici votre code de réinitialisation :</p>` +
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>` +
      `<p>Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
  });
}

module.exports = { envoyerCodeReinitialisation };
