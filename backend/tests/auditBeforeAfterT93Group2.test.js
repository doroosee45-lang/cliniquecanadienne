// T9.3 (R-17) — extension de donnees_avant/donnees_apres, groupe 2 : modules
// cliniques spécialisés Phase 6 (échographie, maternité, pédiatrie). Même
// vérification que le groupe 1 (chirurgie/bloc/labo/imagerie).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('donnees_avant/donnees_apres — échographie, maternité, pédiatrie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const Echographie = require('../models/Echographie');
  const Pregnancy = require('../models/Pregnancy');
  const Newborn = require('../models/Newborn');
  const Child = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const echoC = require('../controllers/echographieController');
  const matC  = require('../controllers/maternityController');
  const pedC  = require('../controllers/pediatrieController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T93', nom: 'Test', role: 'medecin' };
  const patient = await Patient.create({ nom: `T93G2${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });

  const cleanup = [];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('echographieController — update, planifier, saveRapport, annuler journalisent avant/apres', async () => {
      const demande = await Echographie.create({ patient: `T93G2 P ${stamp}`, motif: 'Suivi' });
      cleanup.push(() => Echographie.findByIdAndDelete(demande._id));

      await call(echoC.update, { params: { id: demande._id }, body: { motif: 'Motif révisé' }, user });
      let log = await AuditLog.findOne({ module: 'echographie', action: 'UPDATE', entite_id: demande._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.motif, 'Suivi');
      assert.equal(log.donnees_apres.motif, 'Motif révisé');

      await call(echoC.planifier, { params: { id: demande._id }, body: { echographiste: 'Dr Test', salle: 'A1' }, user });
      log = await AuditLog.findOne({ module: 'echographie', action: 'UPDATE', entite_id: demande._id.toString() }).sort('-createdAt');
      assert.notEqual(log.donnees_avant.statut, 'planifiee');
      assert.equal(log.donnees_apres.statut, 'planifiee');

      await call(echoC.annuler, { params: { id: demande._id }, user });
      log = await AuditLog.findOne({ module: 'echographie', action: 'CANCEL', entite_id: demande._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'planifiee');
      assert.equal(log.donnees_apres.statut, 'annulee');
    });

    await t.test('maternityController — update (grossesse), updateTravail, updateNewborn journalisent avant/apres', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, patient_nom: 'T93G2 P', patient_prenom: 'P' });
      cleanup.push(() => Pregnancy.findByIdAndDelete(g._id));

      await call(matC.update, { params: { id: g._id }, body: { notes: 'Grossesse à haut risque' }, user });
      let log = await AuditLog.findOne({ module: 'maternite', action: 'UPDATE', entite_id: g._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_apres.notes, 'Grossesse à haut risque');

      await call(matC.updateTravail, { params: { id: g._id }, body: { heure_debut: '10:00' }, user });
      log = await AuditLog.findOne({ module: 'maternite', action: 'UPDATE', entite_id: g._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.salle_travail?.en_travail || false, false);
      assert.equal(log.donnees_apres.salle_travail.en_travail, true);

      const nb = await Newborn.create({ mere_nom: 'T93G2 P', prenom: 'Bebe', sexe: 'M', poids: 3000, etat: 'bon' });
      cleanup.push(() => Newborn.findByIdAndDelete(nb._id));
      await call(matC.updateNewborn, { params: { id: nb._id }, body: { poids: 3200 }, user });
      log = await AuditLog.findOne({ module: 'maternite', action: 'UPDATE', entite_id: nb._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.poids, 3000);
      assert.equal(log.donnees_apres.poids, 3200);
    });

    await t.test('pediatrieController — update (enfant) et updateConsultation journalisent avant/apres', async () => {
      const child = await Child.create({ nom: `T93G2${stamp}`, prenom: 'Enfant', date_naissance: '2024-01-01', sexe: 'M' });
      cleanup.push(() => Child.findByIdAndDelete(child._id));

      await call(pedC.update, { params: { id: child._id }, body: { poids_actuel: 12 }, user });
      let log = await AuditLog.findOne({ module: 'pediatrie', action: 'UPDATE', entite_id: child._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_apres.poids_actuel, 12);

      const consult = await PediatricConsultation.create({ child_id: child._id, motif: 'Fièvre', diagnostic: 'Rhume' });
      cleanup.push(() => PediatricConsultation.findByIdAndDelete(consult._id));
      await call(pedC.updateConsultation, { params: { id: consult._id }, body: { diagnostic: 'Otite' }, user });
      log = await AuditLog.findOne({ module: 'pediatrie', action: 'UPDATE', entite_id: consult._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.diagnostic, 'Rhume');
      assert.equal(log.donnees_apres.diagnostic, 'Otite');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
