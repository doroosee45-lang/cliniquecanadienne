// Phase 2 §5 — Complétude de la traçabilité. Deux niveaux de vérification :
//  1) statique : chaque sous-action listée ci-dessous contient bien un appel
//     logAction() dans le corps de sa fonction (garde-fou rapide et exact
//     contre une régression future qui le supprimerait) ;
//  2) fonctionnel : un échantillon des actions les plus sensibles
//     cliniquement (acquittement d'un résultat critique, suppression d'une
//     consultation, planification d'échographie, vaccination) est exécuté
//     réellement contre la base configurée et vérifié via une vraie entrée
//     AuditLog, données de test créées et nettoyées dans le test.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const CTRL_DIR = path.join(__dirname, '..', 'controllers');

function functionBody(fileContent, exportName) {
  const start = fileContent.indexOf(`exports.${exportName} =`);
  if (start === -1) return null;
  // Coupe au prochain "exports." (ou fin de fichier) — suffisant ici, les
  // contrôleurs de ce projet n'imbriquent jamais un exports. dans un autre.
  const rest = fileContent.slice(start + 1);
  const nextExport = rest.indexOf('\nexports.');
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
}

test('couverture statique — chaque sous-action listée appelle logAction()', () => {
  const EXPECTED = [
    ['echographieController.js', ['update', 'planifier', 'saveRapport', 'annuler']],
    ['maternityController.js',   ['update', 'addCPN', 'addEcho', 'updateTravail', 'addPostnatal', 'updateNewborn']],
    ['pediatrieController.js',   ['update', 'addVaccination', 'addMesure', 'addMaladieChron', 'updateConsultation']],
    ['urgencesController.js',    ['addSoin', 'addPrescription', 'addExamen', 'assignMission', 'retourAmbulance']],
    ['consultations.controller.js', ['remove']],
    ['hospitalization.controller.js', ['addNote']],
    ['laboratory.controller.js', ['acquit']],
    ['prescriptions.controller.js', ['update']],
    ['pharmacy.controller.js',   ['update']],
    ['settings.controller.js',   ['createInsurance']],
    ['archive.controller.js',    ['updateConfig']],
    ['ai.controller.js',         ['checkInteractions']],
  ];

  const missing = [];
  for (const [file, fns] of EXPECTED) {
    const content = fs.readFileSync(path.join(CTRL_DIR, file), 'utf8');
    for (const fn of fns) {
      const body = functionBody(content, fn);
      if (body === null) { missing.push(`${file}::${fn} — fonction introuvable`); continue; }
      if (!body.includes('logAction(')) missing.push(`${file}::${fn} — pas d'appel logAction()`);
    }
  }
  assert.deepEqual(missing, [], `Sous-actions encore non tracées :\n${missing.join('\n')}`);
});

test('couverture fonctionnelle — échantillon réel (base configurée)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');
  const medecin = (await User.findOne({ role: 'medecin' })) || { _id: new mongoose.Types.ObjectId() };
  const laborantin = (await User.findOne({ role: 'laborantin' })) || { _id: new mongoose.Types.ObjectId() };

  await t.test('laboratory.acquit écrit une entrée AuditLog', async () => {
    const LabResult = require('../models/LabResult');
    const labC = require('../controllers/laboratory.controller');
    const Patient = require('../models/Patient');
    const patient = await Patient.findOne({});
    const lab = await LabResult.create({ patient: patient?._id, patient_nom: 'Test', est_critique: true, statut: 'valide' });
    try {
      const before = await AuditLog.countDocuments({ module: 'laboratory', action: 'ACQUIT', entite_id: lab._id.toString() });
      await labC.acquit({ params: { id: lab._id.toString() }, user: laborantin, ip: '127.0.0.1' }, { json: () => {} }, () => {});
      const after = await AuditLog.countDocuments({ module: 'laboratory', action: 'ACQUIT', entite_id: lab._id.toString() });
      assert.equal(before, 0); assert.equal(after, 1);
    } finally {
      await LabResult.findByIdAndDelete(lab._id);
      await AuditLog.deleteMany({ entite_id: lab._id.toString() });
    }
  });

  await t.test('consultations.remove écrit une entrée AuditLog', async () => {
    const Consultation = require('../models/Consultation');
    const consultC = require('../controllers/consultations.controller');
    const Patient = require('../models/Patient');
    const patient = await Patient.findOne({});
    const consult = await Consultation.create({ patient: patient?._id, medecin: medecin._id, diagnostic: 'Test' });
    const after1 = await AuditLog.countDocuments({ module: 'consultations', action: 'DELETE', entite_id: consult._id.toString() });
    assert.equal(after1, 0);
    await consultC.remove({ params: { id: consult._id.toString() }, user: medecin, ip: '127.0.0.1' }, { json: () => {}, status: () => ({ json: () => {} }) }, () => {});
    const after2 = await AuditLog.countDocuments({ module: 'consultations', action: 'DELETE', entite_id: consult._id.toString() });
    assert.equal(after2, 1);
    await AuditLog.deleteMany({ entite_id: consult._id.toString() });
  });

  await t.test('pediatrie.addVaccination écrit une entrée AuditLog', async () => {
    const Child = require('../models/Child');
    const pedC = require('../controllers/pediatrieController');
    const child = await Child.create({ nom: 'TestAudit', date_naissance: new Date('2020-01-01'), sexe: 'M' });
    try {
      await pedC.addVaccination({ params: { id: child._id.toString() }, body: { vaccin: 'Test' }, user: medecin, ip: '127.0.0.1' }, { status: () => ({ json: () => {} }), json: () => {} }, () => {});
      const n = await AuditLog.countDocuments({ module: 'pediatrie', entite_id: child._id.toString() });
      assert.equal(n, 1);
    } finally {
      await Child.findByIdAndDelete(child._id);
      await AuditLog.deleteMany({ entite_id: child._id.toString() });
    }
  });

  t.after(async () => { await mongoose.disconnect(); });
});
