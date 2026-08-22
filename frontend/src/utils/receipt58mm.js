// Gabarit unique pour toute facture/reçu/ticket imprimé au format imprimante
// thermique 58mm (papier 58mm, largeur utile ~48mm ≈ 32 caractères en police
// monospace). Un seul endroit à maintenir pour la mise en forme ; chaque
// module ne fait qu'alimenter `printReceipt58mm(receipt)` avec ses propres
// données — voir la forme de `receipt` ci-dessous.
//
// Remplace : Finance.jsx (printInvoice + downloadInvoicePDF, deux formats A4
// différents pour le même document), Pharmacy.jsx (printThermal en mode
// 80mm), InvoicePrint.jsx (impression du DOM Tailwind A4 affiché à l'écran).
//
// Mécanisme : fenêtre popup + window.print(), comme le faisait déjà
// Pharmacy.jsx — un seul moteur de rendu pour l'impression (pas de jsPDF ici :
// "Enregistrer en PDF" reste possible via la boîte de dialogue d'impression
// du navigateur). Un second moteur (buildReceiptPdfBlob/downloadReceiptPdf
// plus bas) génère un vrai fichier PDF à partir de la même structure Receipt,
// réservé au partage (pièce jointe email, téléchargement pour WhatsApp) —
// jamais utilisé par le flux d'impression lui-même.
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { CLINIC_NAME, CLINIC_SUBTITLE } from '../config/clinic';

const fmtCFA = (n) => (n != null && !isNaN(Number(n)) ? Number(n).toLocaleString('fr-FR') : '0') + ' CFA';

// Une imprimante thermique est monochrome 1-bit (pas de palette de gris) :
// un pictogramme couleur (🏥, 💵...) est rastérisé par tramage à la taille
// d'impression (~10px) et devient un aplat noir illisible, jamais une icône
// reconnaissable — contrairement à un écran ou à un export PDF couleur, qui
// ne révèlent pas ce problème. Retiré de tout texte inséré dans le reçu,
// jamais seulement des cas déjà repérés (protège aussi les modules futurs).
const stripEmoji = (s) => String(s ?? '')
  .replace(/\p{Extended_Pictographic}/gu, '')
  .replace(/️/g, '')
  .replace(/‍/g, '')
  .replace(/ {2,}/g, ' ')
  .trim();

const esc = (s) => stripEmoji(s).replace(/[&<>]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));

const CSS_58MM = `
  @page { size: 58mm auto; margin: 2mm 3mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New', Courier, monospace; font-size:10px; width:50mm; color:#000; line-height:1.35; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .b  { font-weight:700; }
  .muted { font-size:9px; color:#333; }
  .sep { border-top:1px dashed #000; margin:4px 0; }
  .row { display:flex; justify-content:space-between; gap:4px; }
  .doctype { font-size:13px; font-weight:800; letter-spacing:1px; }
  .docnum  { font-size:10px; }
  .item-label { font-size:10px; word-break:break-word; }
  .item-sub   { font-size:9px; color:#333; }
  .item-row   { font-size:10px; }
  .total-row  { font-size:10px; }
  .total-row.emph { font-size:12px; font-weight:800; }
  .footer { font-size:9px; text-align:center; color:#333; }
  .qr-wrap { display:flex; justify-content:center; margin:6px 0; }
  .qr-wrap img { width:26mm; height:26mm; image-rendering:pixelated; image-rendering:crisp-edges; }
`;

// AUDIT-RECU-QR — le QR n'encode jamais que la référence (n° facture/
// dossier/ticket), jamais de données personnelles (nom, téléphone, adresse)
// : aucune route de consultation publique par référence n'existe côté
// backend (finance.routes.js est réservé staff), donc pas de lien
// cliquable non plus — un ticket perdu ou photographié n'expose rien.
// AUDIT-RECU-QR-NETTETE — `width` (utilisé initialement) fait calculer à
// qrcode un facteur d'échelle = width / (nb de modules + marge*2), presque
// jamais entier (lib/renderer/utils.js::getScale) ; qrToImageData retrouve
// ensuite le module source de chaque pixel via un floor() sur ce facteur
// fractionnaire, ce qui produit des bords de module en escalier (largeur de
// module qui varie de ±1px d'un module à l'autre) — repéré sur un vrai
// rendu, pas un flou d'anti-aliasing (putImageData copie les pixels tels
// quels, aucun lissage n'est appliqué à ce stade). `scale` (entier) donne
// des modules pixel-parfaits, toujours la même largeur. Les références
// courtes utilisées ici (n° facture/ticket/dossier, ~15 caractères) tiennent
// toutes sur un QR V1 (21x21 modules) ; scale:13 donne ~299px, une densité
// comparable à l'ancien réglage, pour une imprimante thermique typique
// (~203dpi) à la taille d'impression retenue (26mm).
const buildQrDataUrl = async (text) => {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(String(text), { margin: 1, scale: 13 });
  } catch {
    return null;
  }
};

/**
 * @typedef {{ label:string, value:string }} MetaLine
 * @typedef {{ label:string, sub?:string, qty?:number, unitPrice?:number, amount:number }} ReceiptLine
 * @typedef {{ label:string, value:number, emphasis?:boolean }} TotalLine
 * @typedef {{
 *   docType:string, docNumber:string, date:string,
 *   billedTo?:{ label:string, name:string, sub?:string },
 *   meta?:MetaLine[], lines:ReceiptLine[], totals:TotalLine[],
 *   note?:string, footer?:string, clinicAddressLines?:string[],
 *   qrData?:string,
 * }} Receipt
 * @param {Receipt} receipt
 */
export const buildReceipt58mmHtml = async (receipt) => {
  const {
    docType, docNumber, date, billedTo, meta = [], lines = [], totals = [],
    note, footer, clinicAddressLines = [], qrData,
  } = receipt;

  const qrDataUrl = await buildQrDataUrl(qrData);
  const qrHtml = qrDataUrl ? `<div class="qr-wrap"><img src="${qrDataUrl}" alt="QR ${esc(qrData)}"></div>` : '';

  const addressHtml = clinicAddressLines.length
    ? `<div class="muted">${clinicAddressLines.map(esc).join('<br>')}</div>`
    : '';

  const billedToHtml = billedTo ? `
    <div class="sep"></div>
    <div class="b">${esc(billedTo.label)}</div>
    <div>${esc(billedTo.name)}</div>
    ${billedTo.sub ? `<div class="muted">${esc(billedTo.sub)}</div>` : ''}
  ` : '';

  const metaHtml = meta.length ? `
    <div class="sep"></div>
    ${meta.map(m => `<div class="row"><span class="muted">${esc(m.label)}</span><span class="b">${esc(m.value)}</span></div>`).join('')}
  ` : '';

  const linesHtml = lines.map(l => {
    const qtyPrice = (l.qty != null && l.unitPrice != null)
      ? `${l.qty} x ${fmtCFA(l.unitPrice)}`
      : '';
    return `
      <div class="item-label">${esc(l.label)}</div>
      ${l.sub ? `<div class="item-sub">${esc(l.sub)}</div>` : ''}
      <div class="row item-row">
        <span class="muted">${qtyPrice}</span>
        <span class="b">${fmtCFA(l.amount)}</span>
      </div>
    `;
  }).join('');

  const totalsHtml = totals.map(t => `
    <div class="row total-row${t.emphasis ? ' emph' : ''}">
      <span>${esc(t.label)}</span><span>${fmtCFA(t.value)}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(docType)} ${esc(docNumber)}</title>
<style>${CSS_58MM}</style>
</head><body>
  <div class="center">
    <div class="b">${esc(CLINIC_NAME)}</div>
    <div class="b">${esc(CLINIC_SUBTITLE)}</div>
    ${addressHtml}
    <div class="sep"></div>
    <div class="doctype">${esc(docType)}</div>
    <div class="docnum">${esc(docNumber)}</div>
    <div class="muted">${esc(date)}</div>
  </div>

  ${billedToHtml}
  ${metaHtml}

  <div class="sep"></div>
  ${linesHtml}

  <div class="sep"></div>
  ${totalsHtml}

  ${note ? `<div class="sep"></div><div class="muted center">${esc(note)}</div>` : ''}

  <div class="sep"></div>
  ${qrHtml}
  <div class="footer">
    ${footer ? esc(footer) : 'Merci de votre confiance.'}<br>
    ${esc(CLINIC_NAME)} ${esc(CLINIC_SUBTITLE)}
  </div>
</body></html>`;
};

/**
 * Ouvre une fenêtre popup au format ticket et déclenche l'impression.
 * @param {Receipt} receipt
 */
export const printReceipt58mm = async (receipt) => {
  const html = await buildReceipt58mmHtml(receipt);
  const win = window.open('', '_blank', 'width=380,height=640');
  if (!win) { window.print(); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
};

// AUDIT-RECU-PDF-PARTAGE — second moteur de rendu, réservé au partage (pièce
// jointe email, téléchargement pour joindre manuellement sur WhatsApp).
// Consomme exactement la même structure Receipt que buildReceipt58mmHtml —
// aucune 3e implémentation du contenu de la facture/ticket. Rendu en
// positionnement manuel (police Courier, largeur 58mm) plutôt qu'un moteur
// HTML→PDF, pour produire un vrai PDF texte/vectoriel fidèle au ticket
// imprimé (même image QR réelle intégrée via doc.addImage), avec une hauteur
// de page calculée depuis le contenu réel plutôt qu'une valeur fixe arbitraire.
const PDF_W_MM = 58;
const PDF_MARGIN_MM = 4;
const PDF_LINE_H = 4.3;
const PDF_QR_MM = 26;

// AUDIT-RECU-PDF-PARTAGE — fmtCFA (toLocaleString('fr-FR')) sépare les
// milliers par une espace fine insécable (U+202F), absente de l'encodage
// WinAnsi des polices standard de jsPDF (Courier) : le glyphe est mal rendu
// (visuellement remplacé, ex. "15/000") ET la largeur de chaîne calculée pour
// l'alignement à droite devient fausse, ce qui fait chevaucher le texte de
// droite (montant) avec le texte de gauche sur la même ligne. Formateur
// dédié au PDF, espace ASCII normale (toujours supportée), détecté en
// exécutant réellement le rendu et en l'inspectant (pas visible dans le HTML
// imprimé, où le navigateur gère l'Unicode sans problème).
const fmtCFAPdf = (n) => {
  const num = (n != null && !isNaN(Number(n))) ? Math.round(Number(n)) : 0;
  const grouped = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} CFA`;
};

// AUDIT-RECU-PDF-PARTAGE — deux passes sur la même liste d'opérations plutôt
// qu'une estimation de hauteur devinée à l'avance : une première version de
// cette fonction estimait la hauteur de page depuis un nombre de lignes
// calculé à la main, qui oubliait l'avancement des sepLine() (lignes
// pointillées) et le décalage initial — repéré en générant un vrai PDF et en
// l'inspectant avec un extracteur de texte indépendant (pdf-parse) : le pied
// de page (voire la dernière ligne seulement, selon le contenu) disparaissait
// silencieusement, dessiné sous le bas réel de la page sans qu'aucune erreur
// ne soit levée. Ici, la première passe calcule la position y réelle de
// chaque élément (sans jsPDF), la hauteur de page est dérivée du y final
// exact, puis la seconde passe rejoue exactement la même liste d'opérations
// sur le vrai document — aucune divergence possible entre estimation et rendu
// puisque c'est littéralement la même séquence.
const buildReceiptPdfDoc = async (receipt) => {
  const {
    docType, docNumber, date, billedTo, meta = [], lines = [], totals = [],
    note, footer, clinicAddressLines = [], qrData,
  } = receipt;

  const qrDataUrl = await buildQrDataUrl(qrData);

  // AUDIT-RECU-PDF-PARTAGE — doc de mesure jetable (jamais affiché/exporté),
  // utilisé uniquement pour splitTextToSize : un vrai texte peut dépasser la
  // largeur utile (ex. une note longue, un libellé de médicament composé) et
  // sans retour à la ligne réel, center()/left() dessinaient un seul segment
  // débordant des deux côtés de la page — repéré en générant un vrai ticket
  // à plusieurs articles et en l'inspectant : la note était visuellement
  // coupée aux deux extrémités. jsPDF ne permet pas de redimensionner une
  // page après création, donc la hauteur finale n'est connue qu'après avoir
  // mesuré tout le contenu (retours à la ligne inclus) sur ce doc jetable.
  const measureDoc = new jsPDF({ unit: 'mm', format: [PDF_W_MM, 1000] });
  const wrap = (txt, size) => {
    measureDoc.setFont('courier', 'normal');
    measureDoc.setFontSize(size);
    return measureDoc.splitTextToSize(stripEmoji(String(txt)), PDF_W_MM - PDF_MARGIN_MM * 2);
  };

  const ops = [];
  let y = PDF_MARGIN_MM + 2;
  const center = (txt, size = 8, bold = false) => {
    if (!txt) return;
    wrap(txt, size).forEach((line) => {
      ops.push({ type: 'center', txt: line, size, bold, y });
      y += PDF_LINE_H;
    });
  };
  const left = (txt, size = 8, bold = false) => {
    if (!txt) return;
    wrap(txt, size).forEach((line) => {
      ops.push({ type: 'left', txt: line, size, bold, y });
      y += PDF_LINE_H;
    });
  };
  const between = (l, r, size = 8, bold = false) => {
    ops.push({ type: 'between', l, r, size, bold, y });
    y += PDF_LINE_H;
  };
  const sepLine = () => {
    ops.push({ type: 'sep', y });
    y += PDF_LINE_H * 0.75;
  };

  center(CLINIC_NAME, 9, true);
  center(CLINIC_SUBTITLE, 9, true);
  clinicAddressLines.forEach((l) => center(l, 7));
  sepLine();
  center(docType, 11, true);
  center(docNumber, 8);
  center(date, 7);

  if (billedTo) {
    sepLine();
    left(billedTo.label, 8, true);
    left(billedTo.name, 8);
    if (billedTo.sub) left(billedTo.sub, 7);
  }
  if (meta.length) {
    sepLine();
    meta.forEach((m) => between(m.label, m.value, 8, true));
  }

  sepLine();
  lines.forEach((l) => {
    left(l.label, 8);
    if (l.sub) left(l.sub, 7);
    const qtyPrice = (l.qty != null && l.unitPrice != null) ? `${l.qty} x ${fmtCFAPdf(l.unitPrice)}` : '';
    between(qtyPrice, fmtCFAPdf(l.amount), 8, true);
  });

  sepLine();
  totals.forEach((t) => between(t.label, fmtCFAPdf(t.value), t.emphasis ? 10 : 8, !!t.emphasis));

  if (note) { sepLine(); center(note, 7); }

  sepLine();
  if (qrDataUrl) {
    ops.push({ type: 'qr', dataUrl: qrDataUrl, y });
    y += PDF_QR_MM + 2;
  }
  center(footer || 'Merci de votre confiance.', 7);
  center(`${CLINIC_NAME} ${CLINIC_SUBTITLE}`, 7);

  const heightMm = Math.max(70, y + PDF_MARGIN_MM);
  const doc = new jsPDF({ unit: 'mm', format: [PDF_W_MM, heightMm] });
  const centerX = PDF_W_MM / 2;

  ops.forEach((op) => {
    if (op.type === 'sep') {
      doc.setLineDashPattern([0.6, 0.6], 0);
      doc.setDrawColor(0, 0, 0);
      doc.line(PDF_MARGIN_MM, op.y, PDF_W_MM - PDF_MARGIN_MM, op.y);
      return;
    }
    if (op.type === 'qr') {
      doc.addImage(op.dataUrl, 'PNG', centerX - PDF_QR_MM / 2, op.y, PDF_QR_MM, PDF_QR_MM);
      return;
    }
    doc.setFont('courier', op.bold ? 'bold' : 'normal');
    doc.setFontSize(op.size);
    if (op.type === 'center') { doc.text(stripEmoji(op.txt), centerX, op.y, { align: 'center' }); return; }
    if (op.type === 'left') { doc.text(stripEmoji(op.txt), PDF_MARGIN_MM, op.y); return; }
    doc.text(stripEmoji(op.l), PDF_MARGIN_MM, op.y);
    doc.text(stripEmoji(String(op.r)), PDF_W_MM - PDF_MARGIN_MM, op.y, { align: 'right' });
  });

  return doc;
};

/** @param {Receipt} receipt @returns {Promise<Blob>} */
export const buildReceiptPdfBlob = async (receipt) => (await buildReceiptPdfDoc(receipt)).output('blob');

/** @param {Receipt} receipt @returns {Promise<string>} base64 (sans préfixe data:) */
export const buildReceiptPdfBase64 = async (receipt) => {
  const doc = await buildReceiptPdfDoc(receipt);
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1] || '';
};

/**
 * Déclenche un téléchargement réel du PDF (partage manuel — WhatsApp, ou
 * repli quand aucun envoi serveur n'est possible pour l'email).
 * @param {Receipt} receipt
 * @param {string} [filename]
 */
export const downloadReceiptPdf = async (receipt, filename) => {
  const blob = await buildReceiptPdfBlob(receipt);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${receipt.docNumber || 'recu'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
