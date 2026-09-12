// T9.3 (R-17) — extension de donnees_avant/donnees_apres, groupe 1 : modules
// cliniques spécialisés Phase 6 (chirurgie, bloc opératoire, laboratoire,
// imagerie). Même vérification que auditBeforeAfterExtended.test.js
// (hospitalisation/prescriptions/finance, Phase 7) : chaque route de
// modification doit désormais journaliser un instantané avant/après réel,
// pas juste un log d'action sans contenu.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('donnees_avant/donnees_apres — chirurgie, bloc opératoire, laboratoire, imagerie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const chirC = require('../controllers/chirurgieController');
  const blocC = require('../controllers/blocoperatoireController');
  const labC  = require('../controllers/laboratory.controller');
  const radC  = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T93', nom: 'Test', role: 'medecin' };
  const patient = await Patient.create({ nom: `T93${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });

  const cleanup = [];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('chirurgieController.updateDossier journalise avant/apres', async () => {
      const dossier = await DossierChirurgical.create({ numero: `CHIR-T93-${stamp}`, patient: patient._id, patient_nom: 'T93 P', diagnostic_chirurgical: 'Initial' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      await call(chirC.updateDossier, { params: { id: dossier._id }, body: { diagnostic_chirurgical: 'Révisé après bilan' }, user });
      const log = await AuditLog.findOne({ module: 'chirurgie', action: 'UPDATE', entite_id: dossier._id.toString() }).sort('-createdAt');
      assert.ok(log.donnees_avant, 'avant doit être renseigné');
      assert.ok(log.donnees_apres, 'apres doit être renseigné');
      assert.equal(log.donnees_avant.diagnostic_chirurgical, 'Initial');
      assert.equal(log.donnees_apres.diagnostic_chirurgical, 'Révisé après bilan');
    });

    await t.test('blocoperatoireController.saveCR et .saveReveil journalisent avant/apres', async () => {
      const dossier = await DossierChirurgical.create({ numero: `BLOC-T93-${stamp}`, patient: patient._id, patient_nom: 'T93 P', statut: 'opere' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      // Payload calqué sur EMPTY_CR (Blocoperatoire.jsx) — saignement_ml,
      // materiel_implante et transfusion_ml étaient saisis mais jamais
      // persistés (silencieusement perdus) avant ce correctif.
      await call(blocC.saveCR, { params: { id: dossier._id }, body: {
        diagnostic_postop: 'Appendicite confirmée',
        saignement_ml: 150, materiel_implante: 'Drain de Penrose', transfusion_ml: 0,
      }, user });
      let log = await AuditLog.findOne({ module: 'blocoperatoire', action: 'UPDATE', entite_id: dossier._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.diagnostic_final, undefined);
      assert.equal(log.donnees_apres.diagnostic_final, 'Appendicite confirmée');
      assert.equal(log.donnees_avant.statut, 'opere');
      assert.equal(log.donnees_apres.statut, 'suivi_postop', 'saveCR fait aussi transitionner le statut');
      assert.equal(log.donnees_apres.saignement_ml, 150);
      assert.equal(log.donnees_apres.materiel_implante, 'Drain de Penrose');
      const savedDossier = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(savedDossier.saignement_ml, 150);
      assert.equal(savedDossier.materiel_implante, 'Drain de Penrose');
      assert.equal(savedDossier.transfusion_ml, 0);

      await call(blocC.saveReveil, { params: { id: dossier._id }, body: { etat_patient: 'stable', temperature: '37.2' }, user });
      log = await AuditLog.findOne({ module: 'blocoperatoire', action: 'UPDATE', entite_id: dossier._id.toString() }).sort('-createdAt');
      assert.match(log.donnees_apres.evolution_immediate, /stable/);
    });

    await t.test('laboratory.controller.validate et .acquit journalisent avant/apres', async () => {
      const lab = await LabResult.create({ patient: patient._id, patient_nom: 'T93 P', statut: 'en_attente', type_analyse: 'NFS' });
      cleanup.push(() => LabResult.findByIdAndDelete(lab._id));

      // SPEC-07 (correction du 12 sept. 2026) — validate() exige désormais
      // réellement statut:'termine' (résultats saisis) avant de valider.
      await call(labC.saisirResultats, { params: { id: lab._id }, body: { resultats: 'Normal' }, user });

      await call(labC.validate, { params: { id: lab._id }, body: { resultats: 'Normal', est_critique: false }, user });
      let log = await AuditLog.findOne({ module: 'laboratory', action: 'VALIDATE', entite_id: lab._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'termine');
      assert.equal(log.donnees_apres.statut, 'valide');

      await call(labC.acquit, { params: { id: lab._id }, user });
      log = await AuditLog.findOne({ module: 'laboratory', action: 'ACQUIT', entite_id: lab._id.toString() }).sort('-createdAt');
      assert.ok(log.donnees_avant, 'avant doit être renseigné pour acquit aussi');
      assert.ok(log.donnees_apres.acquitte_at, 'apres doit refléter acquitte_at');
    });

    await t.test('radiology.controller.saveCR et .validation journalisent avant/apres', async () => {
      const examen = await ImagingResult.create({ patient: patient._id, patient_nom: 'T93 P', statut: 'programme', type_examen: 'radio' });
      cleanup.push(() => ImagingResult.findByIdAndDelete(examen._id));

      await call(radC.saveCR, { params: { id: examen._id }, body: { conclusion: 'RAS' }, user });
      let log = await AuditLog.findOne({ module: 'radiology', action: 'CR', entite_id: examen._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'programme');
      assert.equal(log.donnees_apres.statut, 'realise');
      assert.equal(log.donnees_apres.conclusion, 'RAS');

      // AUDIT-02 — payload calqué sur formValid (Radiology.jsx) : le code de
      // signature saisi par le radiologue à la validation était silencieusement
      // perdu (champ absent du schéma) avant ce correctif.
      const { body: validationBody } = await call(radC.validation, { params: { id: examen._id }, body: { radiologue: 'Dr Test', signature: 'DR-TEST-2026' }, user });
      log = await AuditLog.findOne({ module: 'radiology', action: 'VALIDATE', entite_id: examen._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'realise');
      assert.equal(log.donnees_apres.statut, 'valide');
      assert.equal(validationBody.examen.signature, 'DR-TEST-2026', 'la réponse immédiate doit refléter la signature envoyée');

      // Relecture depuis une requête fraîche (pas juste la réponse en mémoire
      // du même appel) — preuve que la signature est réellement persistée.
      const relu = await ImagingResult.findById(examen._id).lean();
      assert.equal(relu.signature, 'DR-TEST-2026', 'la signature doit être récupérable après relecture en base, pas seulement présente dans la réponse immédiate');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
