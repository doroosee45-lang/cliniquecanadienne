// ANL-03 (correction du 12 sept. 2026, audit indépendant) —
// analytics.controller.js::getStats calculait chirurgie_annulees via une
// formule arbitraire (Math.max(0, total - realisees - Math.round(total *
// 0.15))), jamais une vraie donnée : DossierChirurgical n'a pas de statut
// 'annulee' distinct (toModelStatut fait revenir une annulation à
// 'consultation', identique à un dossier jamais programmé). Corrigé via un
// horodatage réel (date_annulation, posé par updateIntervention à
// l'annulation). Ce test prouve que le compteur reflète désormais de
// vraies annulations, jamais un pourcentage inventé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ANL-03 — chirurgie_annulees reflète de vraies annulations (date_annulation), jamais une estimation à 15%', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const analyticsC = require('../controllers/analytics.controller');
  const blocC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Anl03-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01' });
  const dossier = await DossierChirurgical.create({ numero: `ANL03-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'preoperatoire' });
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'User' };

  try {
    await t.test('avant annulation : date_annulation absente, dossier non compté', async () => {
      const { body: avant } = await call(analyticsC.getStats, { query: {} });
      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.date_annulation, undefined);
      // Sanity : le KPI est un nombre réel, jamais NaN/undefined.
      assert.equal(typeof avant.kpi.chirurgie_annulees, 'number');
    });

    await t.test('annuler() pose réellement date_annulation, et le KPI l\'inclut désormais', async () => {
      const { body: avant } = await call(analyticsC.getStats, { query: {} });

      const { status } = await call(blocC.updateIntervention, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { statut: 'annulee' } });
      assert.equal(status, 200);

      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.ok(fresh.date_annulation, 'date_annulation doit être réellement posée en base à l\'annulation');
      assert.equal(fresh.statut, 'consultation');

      const { body: apres } = await call(analyticsC.getStats, { query: {} });
      assert.equal(apres.kpi.chirurgie_annulees, avant.kpi.chirurgie_annulees + 1, 'le compteur réel doit augmenter exactement de 1 après cette vraie annulation');
    });
  } finally {
    await DossierChirurgical.findByIdAndDelete(dossier._id);
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
