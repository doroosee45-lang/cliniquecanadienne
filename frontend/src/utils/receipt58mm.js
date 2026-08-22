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
// Pharmacy.jsx — un seul moteur de rendu (pas de jsPDF pour ce document :
// "Enregistrer en PDF" reste possible via la boîte de dialogue d'impression
// du navigateur).
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
`;

/**
 * @typedef {{ label:string, value:string }} MetaLine
 * @typedef {{ label:string, sub?:string, qty?:number, unitPrice?:number, amount:number }} ReceiptLine
 * @typedef {{ label:string, value:number, emphasis?:boolean }} TotalLine
 * @typedef {{
 *   docType:string, docNumber:string, date:string,
 *   billedTo?:{ label:string, name:string, sub?:string },
 *   meta?:MetaLine[], lines:ReceiptLine[], totals:TotalLine[],
 *   note?:string, footer?:string, clinicAddressLines?:string[],
 * }} Receipt
 * @param {Receipt} receipt
 */
export const buildReceipt58mmHtml = (receipt) => {
  const {
    docType, docNumber, date, billedTo, meta = [], lines = [], totals = [],
    note, footer, clinicAddressLines = [],
  } = receipt;

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
export const printReceipt58mm = (receipt) => {
  const html = buildReceipt58mmHtml(receipt);
  const win = window.open('', '_blank', 'width=380,height=640');
  if (!win) { window.print(); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
};
