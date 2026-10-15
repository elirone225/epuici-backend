const path = require('path');
const PDFDocument = require('pdfkit');
const TransactionDon = require('../models/TransactionDon');
const { formaterMontant } = require('./recuService');

// Exports CSV et PDF de l'espace "Dons & Dîmes" du trésorier

const LIBELLES_STATUT = {
  en_attente: 'En attente',
  reussi: 'Réussi',
  echoue: 'Échoué',
  annule: 'Annulé',
};
const BLEU = '#0B5CA8';
const GRIS = '#555555';
const CHEMIN_LOGO = path.join(__dirname, '..', 'assets', 'logo.png');

const dateHeure = (date) =>
  new Date(date).toLocaleString('fr-FR', {
    timeZone: 'Africa/Abidjan',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const libellePeriode = ({ debut, fin }) => {
  const jour = (d) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' });
  if (debut && fin) return `du ${jour(debut)} au ${jour(fin)}`;
  if (debut) return `depuis le ${jour(debut)}`;
  if (fin) return `jusqu'au ${jour(fin)}`;
  return 'toutes les dates';
};

const nomFichier = (contexte, extension) => {
  const eglise = contexte.eglise
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
  return `dons-dimes-${eglise}-${new Date().toISOString().slice(0, 10)}.${extension}`;
};

const ligne = (t) => ({
  date: dateHeure(t.createdAt),
  membre: t.utilisateur?.nom || 'Fidèle',
  telephone: t.utilisateur?.telephone || '',
  type: t.type === 'dime' ? 'Dîme' : 'Don',
  categorie: TransactionDon.libelleCategorie(t.type, t.categorie),
  montant: t.montant,
  statut: LIBELLES_STATUT[t.statut] || t.statut,
  recu: t.numeroRecu || '',
  reference: t.transactionWave || t.referenceWave || '',
});

// CSV pour Excel : séparateur ";" et BOM UTF-8 (accents corrects)
const envoyerCsv = (transactions, contexte, res) => {
  const cellule = (valeur) => {
    const texte = String(valeur ?? '');
    // Neutralise les formules (=, +, -, @) qu'Excel exécuterait
    const sur = /^[=+\-@]/.test(texte) ? `'${texte}` : texte;
    return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
  };
  const entetes = ['Date', 'Membre', 'Téléphone', 'Type', 'Catégorie', 'Montant (FCFA)', 'Statut', 'N° reçu', 'Référence Wave'];
  const lignes = transactions.map((t) => {
    const l = ligne(t);
    return [l.date, l.membre, l.telephone, l.type, l.categorie, l.montant, l.statut, l.recu, l.reference];
  });

  const contenu = [entetes, ...lignes].map((l) => l.map(cellule).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier(contexte, 'csv')}"`);
  res.send('﻿' + contenu);
};

// Rapport PDF : totaux (paiements réussis) puis tableau des transactions
const envoyerRapportPdf = (transactions, contexte, res) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier(contexte, 'pdf')}"`);
  doc.pipe(res);

  const gauche = 36;
  const largeur = doc.page.width - 72;
  const { resume } = contexte;

  try {
    doc.image(CHEMIN_LOGO, gauche, 30, { width: 40 });
  } catch {
    // logo absent
  }
  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(16).text('Dons & Dîmes', gauche + 52, 32);
  doc
    .fillColor(GRIS)
    .font('Helvetica')
    .fontSize(10)
    .text(`${contexte.eglise} — ${libellePeriode(contexte)} — édité le ${dateHeure(new Date())}`, gauche + 52, 52);

  // Cartes de totaux
  const cartes = [
    ['Total général', resume.totalGeneral, resume.nombreReussis],
    ['Total dons', resume.totalDons, resume.nombreDons],
    ['Total dîmes', resume.totalDimes, resume.nombreDimes],
  ];
  const largeurCarte = (largeur - 20) / 3;
  cartes.forEach(([titre, montant, nombre], i) => {
    const x = gauche + i * (largeurCarte + 10);
    doc.roundedRect(x, 84, largeurCarte, 54, 6).fill('#EAF2FB');
    doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(titre, x + 10, 92);
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(15).text(formaterMontant(montant), x + 10, 106);
    doc.fillColor(GRIS).font('Helvetica').fontSize(8).text(`${nombre} paiement(s) réussi(s)`, x + 10, 125);
  });
  doc
    .fillColor(GRIS)
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text('Seuls les paiements réussis sont comptés dans les totaux.', gauche, 144);

  // Tableau
  const colonnes = [
    ['Date', 82],
    ['Membre', 115],
    ['Téléphone', 72],
    ['Type', 34],
    ['Catégorie', 112],
    ['Montant', 74],
    ['Statut', 56],
    ['N° reçu', 118],
  ];
  colonnes.push(['Réf. Wave', largeur - colonnes.reduce((s, [, l]) => s + l, 0)]);

  const enTete = (y) => {
    doc.rect(gauche, y, largeur, 18).fill(BLEU);
    let x = gauche;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    for (const [titre, l] of colonnes) {
      doc.text(titre, x + 4, y + 5, { width: l - 8, lineBreak: false });
      x += l;
    }
    return y + 18;
  };

  let y = enTete(160);
  if (transactions.length === 0) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(10).text('Aucune transaction sur cette période.', gauche, y + 12);
  }

  transactions.forEach((t, i) => {
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = enTete(36);
    }
    const l = ligne(t);
    if (i % 2 === 1) doc.rect(gauche, y, largeur, 16).fill('#F5F8FB');
    const valeurs = [l.date, l.membre, l.telephone, l.type, l.categorie, formaterMontant(l.montant), l.statut, l.recu, l.reference];
    let x = gauche;
    valeurs.forEach((valeur, c) => {
      const [, l2] = colonnes[c];
      doc
        .fillColor(c === 6 && t.statut !== 'reussi' ? '#9E9E9E' : '#222222')
        .font(c === 5 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .text(String(valeur), x + 4, y + 4, { width: l2 - 8, height: 10, ellipsis: true, lineBreak: false });
      x += l2;
    });
    y += 16;
  });

  if (transactions.length >= 10000) {
    doc.fillColor('#C62828').fontSize(8).text('Export limité aux 10 000 transactions les plus récentes.', gauche, y + 8);
  }

  doc.end();
};

module.exports = { envoyerCsv, envoyerRapportPdf };
