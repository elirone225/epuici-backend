const path = require('path');
const PDFDocument = require('pdfkit');
const TransactionDon = require('../models/TransactionDon');

const BLEU = '#0B5CA8';
const GRIS = '#555555';
const CHEMIN_LOGO = path.join(__dirname, '..', 'assets', 'logo.png');

// 15000 -> "15 000 FCFA". Espace simple : les polices standard du PDF ne
// connaissent pas l'espace fine insécable produite par Intl.
const formaterMontant = (montant) =>
  `${String(Math.round(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

const formaterDate = (date) =>
  new Date(date).toLocaleString('fr-FR', {
    timeZone: 'Africa/Abidjan',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Reçu d'un don ou d'une dîme réussi, envoyé directement dans la réponse HTTP.
// La transaction doit être peuplée : village (nom) et utilisateur (nom, telephone).
const envoyerRecuPdf = (transaction, res) => {
  const doc = new PDFDocument({ size: 'A5', margin: 40 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="recu-${transaction.numeroRecu}.pdf"`);
  doc.pipe(res);

  const largeur = doc.page.width - 80;

  try {
    doc.image(CHEMIN_LOGO, 40, 36, { width: 46 });
  } catch {
    // logo absent : le reçu reste valable sans
  }
  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(16).text('EPUICI', 96, 42);
  doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(transaction.village?.nom || '', 96, 62);

  doc.moveDown(3);
  doc
    .fillColor('#000000')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(transaction.type === 'dime' ? 'Reçu de dîme' : 'Reçu de don', 40, 110, {
      width: largeur,
      align: 'center',
    });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(GRIS)
    .text(`N° ${transaction.numeroRecu}`, { width: largeur, align: 'center' });

  // Encadré du montant
  const yMontant = doc.y + 14;
  doc.roundedRect(40, yMontant, largeur, 50, 8).fill('#EAF2FB');
  doc
    .fillColor(BLEU)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(formaterMontant(transaction.montant), 40, yMontant + 15, { width: largeur, align: 'center' });

  const lignes = [
    ['Fidèle', transaction.utilisateur?.nom || 'Fidèle'],
    ['Téléphone', transaction.utilisateur?.telephone || '-'],
    ['Église', transaction.village?.nom || '-'],
    ['Type', transaction.type === 'dime' ? 'Dîme' : 'Don'],
    ['Catégorie', TransactionDon.libelleCategorie(transaction.type, transaction.categorie)],
    ['Moyen de paiement', 'Wave'],
    ['Référence Wave', transaction.transactionWave || transaction.referenceWave || '-'],
    ['Date du paiement', formaterDate(transaction.dateConfirmation || transaction.createdAt)],
  ];

  let y = yMontant + 70;
  for (const [libelle, valeur] of lignes) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(libelle, 40, y, { width: 120 });
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9).text(String(valeur), 160, y, {
      width: largeur - 120,
    });
    y = Math.max(doc.y, y + 12) + 6;
  }

  if (transaction.simulation) {
    doc
      .fillColor('#C62828')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('PAIEMENT DE TEST - SANS VALEUR', 40, y + 6, { width: largeur, align: 'center' });
    y += 20;
  }

  doc
    .fillColor(GRIS)
    .font('Helvetica-Oblique')
    .fontSize(9)
    .text(
      '« Que chacun donne comme il l\'a résolu en son cœur, car Dieu aime celui qui donne avec joie. » 2 Corinthiens 9:7',
      40,
      y + 16,
      { width: largeur, align: 'center' }
    );
  doc
    .font('Helvetica')
    .fontSize(8)
    .text('Merci pour votre générosité. Reçu généré par EPUICI.', { width: largeur, align: 'center' });

  doc.end();
};

module.exports = { envoyerRecuPdf, formaterMontant, formaterDate };
