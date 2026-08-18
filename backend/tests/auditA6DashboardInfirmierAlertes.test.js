// AUDIT-A-6 — dashboard.controller.js::infirmierStats codait alertes:[] en
// dur alors que laborantinStats (même fichier) calcule déjà les mêmes
// résultats labo critiques non acquittés pour son propre tableau de bord :
// les données existaient, seule la requête manquait. Restreint aux patients
// actuellement hospitalisés (statut:'en_cours') — portée volontairement plus
// étroite que laborantinStats, qui voit tous les résultats critiques du
// système. Ce test prouve : un résultat critique d'un patient hospitalisé
// apparaît dans alertes, un résultat critique d'un patient NON hospitalisé
// n'y apparaît pas, et un résultat critique déjà acquitté n'y apparaît plus.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('A-6 — alertes du tableau de bord infirmier calculées depuis les résultats labo critiques des patients hospitalisés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const dashC = require('../controllers/dashboard.controller');
  const { statsCache } = require('../utils/dashboardCache');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const LabResult = require('../models/LabResult');
  require('../models/ExamCatalogue'); // populate('examen') exige le modèle enregistré

  const stamp = Date.now();
  const infirmier = { _id: new mongoose.Types.ObjectId(), role: 'infirmier' };
  const cleanup = [];

  const call = async () => {
    statsCache.flushAll();
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; } };
    await dashC.infirmierStats({ user: infirmier }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('résultat critique d\'un patient hospitalisé apparaît dans alertes', async () => {
      const patient = await Patient.create({ nom: `A6-Hosp-${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const hosp = await Hospitalization.create({ patient: patient._id, medecin_responsable: infirmier._id, service_nom: 'Médecine', motif_entree: 'Test A-6', statut: 'en_cours' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));
      const rx = await LabResult.create({ patient: patient._id, statut: 'valide', est_critique: true, valeurs_critiques: 'Kaliémie 6.8 mmol/L' });
      cleanup.push(() => LabResult.findByIdAndDelete(rx._id));

      const { status, body } = await call();
      assert.equal(status, 200);
      assert.equal(body.stats.kpis.patients_surveilles, await Hospitalization.countDocuments({ statut: 'en_cours' }));
      assert.ok(body.stats.alertes.some(a => a.msg.includes('CRITIQUE')), 'le résultat critique du patient hospitalisé doit apparaître dans alertes');
    });

    await t.test('résultat critique d\'un patient NON hospitalisé n\'apparaît pas', async () => {
      const patientNonHosp = await Patient.create({ nom: `A6-NonHosp-${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'F' });
      cleanup.push(() => Patient.findByIdAndDelete(patientNonHosp._id));
      const rx = await LabResult.create({ patient: patientNonHosp._id, statut: 'valide', est_critique: true, valeurs_critiques: 'Ne doit jamais apparaître A-6' });
      cleanup.push(() => LabResult.findByIdAndDelete(rx._id));

      const { body } = await call();
      const msgs = body.stats.alertes.map(a => a.msg);
      assert.ok(!msgs.some(m => m.includes(patientNonHosp.nom)), 'un patient non hospitalisé ne doit jamais apparaître dans les alertes infirmières');
    });

    await t.test('résultat critique déjà acquitté n\'apparaît plus', async () => {
      const patient = await Patient.create({ nom: `A6-Acquitte-${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const hosp = await Hospitalization.create({ patient: patient._id, medecin_responsable: infirmier._id, service_nom: 'Médecine', motif_entree: 'Test A-6b', statut: 'en_cours' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));
      const rx = await LabResult.create({ patient: patient._id, statut: 'valide', est_critique: true, valeurs_critiques: 'Déjà traité A-6', acquitte_par: infirmier._id, acquitte_at: new Date() });
      cleanup.push(() => LabResult.findByIdAndDelete(rx._id));

      const { body } = await call();
      const msgs = body.stats.alertes.map(a => a.msg);
      assert.ok(!msgs.some(m => m.includes(patient.nom)), 'un résultat critique déjà acquitté ne doit plus apparaître');
    });
  } finally {
    for (const fn of cleanup) await fn();
    statsCache.flushAll();
    await mongoose.disconnect();
  }
});
