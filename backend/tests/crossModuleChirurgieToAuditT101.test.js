// Phase 10.1 — test de non-régression croisé Chirurgie↔Journal d'audit.
// functionalCoverageT95Group1.test.js exerce déjà createDossier/addBilan/
// addSuivi/addComplication fonctionnellement (il importe même AuditLog),
// mais n'interroge jamais AuditLog — la traçabilité de ces 4 actions vers le
// module 'chirurgie' du Journal d'audit n'est donc couverte par aucun test
// existant. Une régression ici (logAction() cassé/retiré) passerait
// inaperçue de tous les tests actuels. Les 4 logs partagent le même
// entite_id (celui du dossier, pas du sous-document) — distingués ici par
// ordre chronologique (sort('-createdAt') + comparaison de messages).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Chirurgie→Journal d\'audit — createDossier/addBilan/addSuivi/addComplication journalisent tous en module=chirurgie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Bilan = require('../models/Bilan');
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
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `T101CHIR${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecin = await User.create({ email: `_t101-chir-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chirurgien', prenom: 'T101', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));
    const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

    await t.test('createDossier écrit une entrée AuditLog module=chirurgie, action=CREATE', async () => {
      const { status, body } = await call(chirC.createDossier, { body: { patient: patient._id, chirurgien_id: medecin._id, motif_consultation: 'T101 douleur' }, user, ip: '127.0.0.1' });
      assert.equal(status, 201);
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(body._id));

      const log = await AuditLog.findOne({ module: 'chirurgie', action: 'CREATE', entite_id: body._id.toString(), message: { $regex: 'Nouveau dossier chirurgical' } });
      assert.ok(log, 'createDossier doit journaliser la création du dossier');
      assert.equal(String(log.utilisateur), String(medecin._id));
    });

    await t.test('addBilan / addSuivi / addComplication écrivent chacun une entrée AuditLog module=chirurgie, action=CREATE', async () => {
      const dossier = await DossierChirurgical.create({ numero: `CHIR-T101-${stamp}`, patient: patient._id, patient_nom: 'T101 P' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      const { status: sB, body: bB } = await call(chirC.addBilan, { params: { id: dossier._id }, body: { type: 'biologie', examen: 'NFS-T101' }, user, ip: '127.0.0.1' });
      assert.equal(sB, 201);
      cleanup.push(() => Bilan.findByIdAndDelete(bB._id));
      const logBilan = await AuditLog.findOne({ module: 'chirurgie', action: 'CREATE', entite_id: dossier._id.toString(), message: { $regex: 'Bilan ajouté' } });
      assert.ok(logBilan, 'addBilan doit journaliser');

      const { status: sS, body: bS } = await call(chirC.addSuivi, { params: { id: dossier._id }, body: { temperature: 37.5, etat_plaie: 'bonne_evolution' }, user, ip: '127.0.0.1' });
      assert.equal(sS, 201);
      cleanup.push(() => SuiviPostop.findByIdAndDelete(bS._id));
      const logSuivi = await AuditLog.findOne({ module: 'chirurgie', action: 'CREATE', entite_id: dossier._id.toString(), message: { $regex: 'Suivi postopératoire ajouté' } });
      assert.ok(logSuivi, 'addSuivi doit journaliser');

      const { status: sC, body: bC } = await call(chirC.addComplication, { params: { id: dossier._id }, body: { type_complication: 'infection', description: 'T101 infection test' }, user, ip: '127.0.0.1' });
      assert.equal(sC, 201);
      cleanup.push(() => Complication.findByIdAndDelete(bC._id));
      const logComp = await AuditLog.findOne({ module: 'chirurgie', action: 'CREATE', entite_id: dossier._id.toString(), message: { $regex: 'Complication' } });
      assert.ok(logComp, 'addComplication doit journaliser');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
