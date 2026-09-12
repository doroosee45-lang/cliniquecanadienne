// SPEC-09 (correction du 12 sept. 2026, audit indépendant) —
// echographieController.js::annuler ne touchait jamais une facture réelle
// déjà générée pour la demande (saveRapport, rapport_statut:'valide') :
// annuler une demande après facturation laissait une facture active pour
// un acte qui n'aura jamais lieu. Ce test prouve que la facture réelle est
// désormais contrepassée (statut→'annulee') si elle n'a rien encaissé, et
// que ce mécanisme ne touche jamais une facture déjà réglée (remboursement
// réel, hors périmètre technique — signalé explicitement, jamais annulé
// silencieusement).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-09 — annuler une échographie facturée contrepasse réellement la facture non réglée, jamais une facture déjà payée', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Echographie = require('../models/Echographie');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Invoice = require('../models/Invoice');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'User' };
  const patient = await Patient.create({ nom: `Spec09-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const exam = await ExamCatalogue.create({ code: `ECH-S9-${stamp}`, nom: `Écho Test Spec09 ${stamp}`, type: 'imagerie', prix: 18000, statut: 'actif' });
  const created = { echos: [], invoices: [] };

  try {
    await t.test('facture réelle non réglée (emise) → contrepassée automatiquement à l\'annulation', async () => {
      const demande = await Echographie.create({ patient: patient._id, patient_nom: patient.nom, examen: exam._id, statut: 'planifiee' });
      created.echos.push(demande._id);
      const { body: bRapport } = await call(echoC.saveRapport, { params: { id: demande._id }, body: { rapport_texte: 'RAS', conclusion: 'Normal', rapport_statut: 'valide' }, user, ip: '127.0.0.1' });
      assert.ok(bRapport.invoice, 'une vraie facture doit avoir été générée');
      created.invoices.push(bRapport.invoice._id);

      const { status, body } = await call(echoC.annuler, { params: { id: demande._id }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.ok(body.facture_annulee, 'la réponse doit refléter la contrepassation réelle');

      const freshInvoice = await Invoice.findById(bRapport.invoice._id).lean();
      assert.equal(freshInvoice.statut, 'annulee', 'la facture réelle doit être réellement contrepassée en base, pas seulement dans la réponse');
    });

    await t.test('facture déjà réglée (payee) → jamais annulée automatiquement, signalé explicitement', async () => {
      const demande = await Echographie.create({ patient: patient._id, patient_nom: patient.nom, examen: exam._id, statut: 'planifiee' });
      created.echos.push(demande._id);
      const { body: bRapport } = await call(echoC.saveRapport, { params: { id: demande._id }, body: { rapport_texte: 'RAS', conclusion: 'Normal', rapport_statut: 'valide' }, user, ip: '127.0.0.1' });
      created.invoices.push(bRapport.invoice._id);
      await Invoice.findByIdAndUpdate(bRapport.invoice._id, { statut: 'payee' });

      const { status, body } = await call(echoC.annuler, { params: { id: demande._id }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.facture_annulee, null, 'une facture déjà réglée ne doit jamais être annulée automatiquement — remboursement réel hors périmètre technique');
      assert.equal(body.facture_non_annulee_deja_reglee, true, 'le cas doit être signalé explicitement, jamais ignoré silencieusement');

      const freshInvoice = await Invoice.findById(bRapport.invoice._id).lean();
      assert.equal(freshInvoice.statut, 'payee', 'une facture réellement réglée ne doit jamais être silencieusement modifiée');
    });

    await t.test('aucune facture liée → annulation fonctionne toujours normalement (non-régression)', async () => {
      const demande = await Echographie.create({ patient: patient._id, patient_nom: patient.nom, statut: 'en_attente' });
      created.echos.push(demande._id);
      const { status, body } = await call(echoC.annuler, { params: { id: demande._id }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.facture_annulee, null);
      assert.equal(body.facture_non_annulee_deja_reglee, false);
    });
  } finally {
    await Echographie.deleteMany({ _id: { $in: created.echos } });
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await ExamCatalogue.findByIdAndDelete(exam._id);
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
