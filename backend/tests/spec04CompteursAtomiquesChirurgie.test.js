// SPEC-04 (correction du 12 sept. 2026, audit indépendant) —
// chirurgieController.js::addSuivi/addComplication lisaient
// dossier.nb_suivis/nb_complications puis réécrivaient séparément
// (dossier.nb_x += 1; await dossier.save()) : deux ajouts concurrents sur
// le même dossier pouvaient tous deux lire la même valeur avant que l'un
// ou l'autre n'écrive, perdant un incrément. Ce test prouve, sur une
// vraie course (Promise.all, pas séquentiel), que N ajouts concurrents
// produisent bien un compteur final = N, jamais moins.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 8;

test('SPEC-04 — nb_suivis/nb_complications restent exacts sous ajouts concurrents réels', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const SuiviPostop = require('../models/SuiviPostop');
  const Complication = require('../models/Complication');
  const chirC = require('../controllers/chirurgieController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Spec04-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1980-01-01' });
  const dossier = await DossierChirurgical.create({ numero: `SPEC04-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'preoperatoire' });
  const user = { _id: new mongoose.Types.ObjectId() };

  try {
    await t.test(`${N} addSuivi() concurrents réels → nb_suivis = ${N} exactement, jamais moins`, async () => {
      await Promise.all(Array.from({ length: N }, () =>
        call(chirC.addSuivi, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { observations: 'Suivi test' } })
      ));
      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.nb_suivis, N, `nb_suivis doit être exactement ${N} après ${N} ajouts concurrents réels, jamais moins (incrément perdu)`);
      const reelSuivis = await SuiviPostop.countDocuments({ dossier_chirurgical_id: dossier._id });
      assert.equal(reelSuivis, N, 'le compteur doit refléter le vrai nombre de sous-documents créés');
    });

    await t.test(`${N} addComplication() concurrents réels → nb_complications = ${N} exactement, ia_risque_score/niveau cohérents`, async () => {
      await Promise.all(Array.from({ length: N }, () =>
        call(chirC.addComplication, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { type_complication: 'autre' } })
      ));
      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.nb_complications, N, `nb_complications doit être exactement ${N} après ${N} ajouts concurrents réels, jamais moins`);
      // score : +15 par complication, plafonné à 100 → min(N*15, 100)
      assert.equal(fresh.ia_risque_score, Math.min(N * 15, 100));
      assert.equal(fresh.ia_risque_niveau, fresh.ia_risque_score >= 70 ? 'critique' : fresh.ia_risque_score >= 50 ? 'eleve' : fresh.ia_risque_score >= 30 ? 'modere' : 'faible');
    });
  } finally {
    await SuiviPostop.deleteMany({ dossier_chirurgical_id: dossier._id });
    await Complication.deleteMany({ dossier_chirurgical_id: dossier._id });
    await DossierChirurgical.findByIdAndDelete(dossier._id);
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
