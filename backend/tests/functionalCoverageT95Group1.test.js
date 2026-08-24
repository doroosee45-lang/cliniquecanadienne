// T9.5 (Finding B, groupe 1) — couverture fonctionnelle des fonctions
// create/add jamais testées : chirurgie, bloc opératoire, laboratoire,
// imagerie. Priorité aux fonctions à logique métier réelle (génération de
// numéro, copie/transformation de données patient, liens entre documents)
// plutôt qu'aux get*/liste, par décision explicite avant de démarrer ce
// groupe.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('couverture fonctionnelle — chirurgie, bloc opératoire, laboratoire, imagerie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Bilan = require('../models/Bilan');
  const SuiviPostop = require('../models/SuiviPostop');
  const Complication = require('../models/Complication');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const chirC = require('../controllers/chirurgieController');
  const blocC = require('../controllers/blocoperatoireController');
  const labC  = require('../controllers/laboratory.controller');
  const radC  = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const patient = await Patient.create({
    nom: `T95G1${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F',
    groupe_sanguin: 'O+', allergies: ['Pénicilline'], telephone: '060000000',
  });
  const medecin = await User.create({ email: `_t95g1-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chirurgien', prenom: 'T95G1', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

  const cleanup = [() => Patient.findByIdAndDelete(patient._id), () => User.findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('chirurgieController.createDossier copie et transforme les données patient', async () => {
      const { status, body } = await call(chirC.createDossier, { body: { patient: patient._id, chirurgien_id: medecin._id, motif_consultation: 'Douleur abdominale' }, user });
      assert.equal(status, 201);
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(body.dossier._id));

      assert.ok(body.dossier.numero?.length, 'un numéro doit être généré');
      assert.equal(body.dossier.patient_nom, `${patient.prenom} ${patient.nom}`);
      assert.equal(body.dossier.sexe, 'femme', 'sexe F doit être transformé en "femme"');
      assert.equal(body.dossier.groupe_sanguin, 'O+');
      assert.equal(body.dossier.allergies, 'Pénicilline', 'tableau d\'allergies doit être joint en chaîne');
      assert.equal(body.dossier.chirurgien_nom, `Dr. ${medecin.prenom} ${medecin.nom}`);
      assert.equal(body.dossier.statut, 'consultation');
    });

    await t.test('chirurgieController.addBilan, addSuivi, addComplication créent les sous-documents attendus', async () => {
      const dossier = await DossierChirurgical.create({ numero: `CHIR-T95G1b-${stamp}`, patient: patient._id, patient_nom: 'T95G1 P' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      const { status: sB, body: bB } = await call(chirC.addBilan, { params: { id: dossier._id }, body: { type: 'biologie', examen: 'NFS', resultat: 'Normal' }, user });
      assert.equal(sB, 201);
      cleanup.push(() => Bilan.findByIdAndDelete(bB.bilan._id));
      assert.equal(bB.bilan.examen, 'NFS');

      const { status: sS, body: bS } = await call(chirC.addSuivi, { params: { id: dossier._id }, body: { temperature: 37.2, etat_plaie: 'bonne_evolution' }, user });
      assert.equal(sS, 201);
      cleanup.push(() => SuiviPostop.findByIdAndDelete(bS.suivi._id));
      assert.equal(bS.suivi.etat_plaie, 'bonne_evolution');
      const freshDossier = await DossierChirurgical.findById(dossier._id);
      assert.equal(freshDossier.nb_suivis, 1, 'addSuivi doit incrémenter le compteur sur le dossier');

      const { status: sC, body: bC } = await call(chirC.addComplication, { params: { id: dossier._id }, body: { type_complication: 'infection', description: 'Infection superficielle' }, user });
      assert.equal(sC, 201);
      cleanup.push(() => Complication.findByIdAndDelete(bC.complication._id));
      assert.equal(bC.complication.type_complication, 'infection');
    });

    await t.test('blocoperatoireController.createIntervention — branche nouveau dossier ET branche dossier existant', async () => {
      // Payload calqué sur EMPTY_INTERV (Blocoperatoire.jsx) — l'équipe est
      // saisie dès la création, pas seulement en édition ultérieure.
      const { status: s1, body: b1 } = await call(blocC.createIntervention, { body: {
        patient: patient._id, chirurgien_id: medecin._id, type_intervention: 'Appendicectomie', salle: 'Bloc 1',
        assistant: 'Dr. Assistant Test', anesthesiste: 'Dr. Anesth Test',
        infirmier_instru: 'Inf. Instru Test', infirmier_circu: 'Inf. Circu Test',
      }, user });
      assert.equal(s1, 201);
      const dossierId1 = b1.intervention?._id || b1._id;
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossierId1));
      assert.ok(dossierId1, 'un nouveau dossier chirurgical doit être créé depuis le bloc');
      const saved1 = await DossierChirurgical.findById(dossierId1).lean();
      assert.equal(saved1.assistant, 'Dr. Assistant Test');
      assert.equal(saved1.anesthesiste, 'Dr. Anesth Test');
      assert.equal(saved1.infirmier_instru, 'Inf. Instru Test');
      assert.equal(saved1.infirmier_circu, 'Inf. Circu Test');

      const dossierExistant = await DossierChirurgical.create({ numero: `CHIR-T95G1c-${stamp}`, patient: patient._id, patient_nom: 'T95G1 P' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossierExistant._id));
      const { status: s2 } = await call(blocC.createIntervention, { body: { dossier_id: dossierExistant._id, salle: 'Bloc 2' }, user });
      assert.equal(s2, 201);
    });

    await t.test('laboratory.controller.create génère un numéro et applique la priorité selon niveau_urgence', async () => {
      const { status, body } = await call(labC.create, { body: { patient: patient._id, patient_nom: 'T95G1 P', examens_demandes: ['NFS'], niveau_urgence: 'urgent' }, user });
      assert.equal(status, 201);
      cleanup.push(() => LabResult.findByIdAndDelete(body.result._id));
      assert.match(body.result.numero, /^LAB-\d{4}-\d{4}$/);
      assert.equal(body.result.priorite, 'urgente', 'niveau_urgence=urgent doit forcer priorite=urgente');
      assert.equal(body.result.statut, 'en_attente');
    });

    await t.test('radiology.controller.create génère un numéro et un statut par défaut', async () => {
      const { status, body } = await call(radC.create, { body: { patient: patient._id, patient_nom: 'T95G1 P', type_examen: 'Scanner abdominal' }, user });
      assert.equal(status, 201);
      cleanup.push(() => ImagingResult.findByIdAndDelete(body.examen._id));
      assert.match(body.examen.numero, /^IMG-\d{4}-\d{4}$/);
      assert.equal(body.examen.statut, 'programme');
      assert.equal(body.examen.medecin_prescripteur.toString(), medecin._id.toString(), 'repli sur le médecin connecté quand aucun prescripteur explicite n\'est fourni');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
