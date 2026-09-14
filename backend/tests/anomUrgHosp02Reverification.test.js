// ANOM-URG-HOSP-02 — RE-VÉRIFICATION INDÉPENDANTE (14 sept. 2026, Phase 5,
// sur demande explicite) du correctif déjà appliqué au commit 34a0f3d
// ("fix(hospitalization): verify patient matches the referenced urgence").
// Ce fichier ne modifie AUCUN code de production — il reconstruit,
// indépendamment de adr0005UrgencesHospitalisationWorkflow.test.js (qui
// porte déjà 3 sous-tests sur ce correctif), une couverture complète et
// délibérément exhaustive de la checklist de re-vérification demandée :
// scénario nominal, urgence inexistante, urgence d'un autre patient,
// patient différent fourni explicitement, urgence déjà hospitalisée,
// données manquantes/invalides — avec vérification systématique qu'aucune
// hospitalisation incohérente n'est créée et qu'aucune donnée existante
// (Urgence.admission_status notamment) n'est modifiée en cas de rejet.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ANOM-URG-HOSP-02 (re-vérification) — hospitalization.controller.js::create ne crée jamais d\'association patient/urgence incohérente (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Urgence = require('../models/Urgence');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const cleanup = [];
  const patientCleanup = [];

  const call = async (body) => {
    let status = 200, resBody = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { resBody = d; } };
    await hospC.create({ body, user, ip: '127.0.0.1' }, res, (err) => { if (err) throw err; });
    return { status, body: resBody };
  };

  const mkPatient = async (suffix) => {
    const p = await Patient.create({ nom: `URGHOSP02-REV-${suffix}-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    patientCleanup.push(() => Patient.findByIdAndDelete(p._id));
    return p;
  };
  const mkUrgence = async (patient, suffix) => {
    const u = await Urgence.create(patient
      ? { patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`, motif: `URGHOSP02-REV-${suffix}` }
      : { patient_nom: `Intake-non-identifie-${suffix}`, motif: `URGHOSP02-REV-${suffix}` });
    cleanup.push(() => Urgence.findByIdAndDelete(u._id));
    return u;
  };

  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Med', nom: 'Audit', role: 'medecin' };

  try {
    await t.test('SCÉNARIO NOMINAL — urgence du bon patient → hospitalisation créée, réellement liée, urgence clôturée', async () => {
      const patient = await mkPatient('nominal');
      const urg = await mkUrgence(patient, 'nominal');

      const { status, body } = await call({ patient: String(patient._id), urgence_id: String(urg._id), motif_entree: 'Suite urgences — nominal' });
      assert.equal(status, 201, JSON.stringify(body));
      cleanup.push(() => Hospitalization.findByIdAndDelete(body.hospitalization._id));

      const freshHosp = await Hospitalization.findById(body.hospitalization._id).lean();
      assert.equal(String(freshHosp.patient), String(patient._id), 'la référence patient doit être réellement persistée');
      assert.equal(String(freshHosp.urgence_id), String(urg._id), 'la référence urgence doit être réellement persistée');

      const freshUrg = await Urgence.findById(urg._id).lean();
      assert.equal(freshUrg.admission_status, 'terminee', 'l\'urgence doit être clôturée par une admission réellement aboutie');
    });

    await t.test('SCÉNARIO INCOHÉRENT 1/5 — urgence_id inexistant (ObjectId fabriqué) → 400, aucune hospitalisation créée', async () => {
      const patient = await mkPatient('urg-inexistante');
      const fauxUrgenceId = new mongoose.Types.ObjectId();

      const { status, body } = await call({ patient: String(patient._id), urgence_id: String(fauxUrgenceId), motif_entree: 'Test urgence inexistante' });
      assert.equal(status, 400);
      assert.match(body.message, /introuvable/i);

      const count = await Hospitalization.countDocuments({ patient: patient._id });
      assert.equal(count, 0, 'aucune hospitalisation ne doit être créée sur une urgence inexistante');
    });

    await t.test('SCÉNARIO INCOHÉRENT 2/5 — urgence appartenant à un AUTRE patient → 400, aucune hospitalisation créée, urgence d\'origine INCHANGÉE', async () => {
      const patientA = await mkPatient('A');
      const patientB = await mkPatient('B');
      const urgDeA = await mkUrgence(patientA, 'cross-patient');
      const avant = await Urgence.findById(urgDeA._id).lean();

      const { status, body } = await call({ patient: String(patientB._id), urgence_id: String(urgDeA._id), motif_entree: 'Test patient différent (autre urgence)' });
      assert.equal(status, 400);
      assert.match(body.message, /ne correspond pas/i);

      const countB = await Hospitalization.countDocuments({ patient: patientB._id });
      assert.equal(countB, 0, 'aucune hospitalisation incohérente (patient B, urgence de A) ne doit exister');
      const countUrg = await Hospitalization.countDocuments({ urgence_id: urgDeA._id });
      assert.equal(countUrg, 0, 'l\'urgence de A ne doit pas non plus se retrouver liée par erreur à une hospitalisation de B');

      const apres = await Urgence.findById(urgDeA._id).lean();
      assert.equal(apres.admission_status, avant.admission_status, 'l\'admission_status de l\'urgence rejetée ne doit JAMAIS changer suite à une tentative refusée');
      assert.equal(String(apres.patient), String(avant.patient), 'le patient de l\'urgence ne doit jamais être altéré par une tentative refusée');
    });

    await t.test('SCÉNARIO INCOHÉRENT 3/5 — patient différent fourni explicitement (même cas que ci-dessus, formulation du cahier des charges) → refusé, aucune donnée modifiée', async () => {
      const patientReel = await mkPatient('reel');
      const patientFourni = await mkPatient('fourni-different');
      const urg = await mkUrgence(patientReel, 'patient-explicite-different');

      const { status } = await call({ patient: String(patientFourni._id), urgence_id: String(urg._id), motif_entree: 'Patient explicitement différent' });
      assert.equal(status, 400);

      const countFourni = await Hospitalization.countDocuments({ patient: patientFourni._id });
      assert.equal(countFourni, 0);
      const freshUrg = await Urgence.findById(urg._id).lean();
      assert.equal(String(freshUrg.patient), String(patientReel._id), 'le patient réel de l\'urgence doit rester inchangé');
      assert.notEqual(freshUrg.admission_status, 'terminee', 'l\'urgence ne doit jamais être clôturée par une admission refusée');
    });

    await t.test('SCÉNARIO INCOHÉRENT 4/5 — urgence déjà hospitalisée (admission en_cours existante pour ce même urgence_id) → 409, aucune 2e hospitalisation, la 1re inchangée', async () => {
      const patient = await mkPatient('deja-hospitalise');
      const urg = await mkUrgence(patient, 'deja-hospitalise');

      const r1 = await call({ patient: String(patient._id), urgence_id: String(urg._id), motif_entree: 'Première admission' });
      assert.equal(r1.status, 201, JSON.stringify(r1.body));
      cleanup.push(() => Hospitalization.findByIdAndDelete(r1.body.hospitalization._id));

      const r2 = await call({ patient: String(patient._id), urgence_id: String(urg._id), motif_entree: 'Tentative de doublon' });
      assert.equal(r2.status, 409);
      assert.match(r2.body.message, /déjà en cours/i);

      const count = await Hospitalization.countDocuments({ urgence_id: urg._id });
      assert.equal(count, 1, 'un même passage aux urgences ne doit jamais produire deux hospitalisations actives');
      const premiere = await Hospitalization.findById(r1.body.hospitalization._id).lean();
      assert.equal(premiere.motif_entree, 'Première admission', 'la première hospitalisation ne doit pas avoir été altérée par la tentative refusée');
    });

    await t.test('SCÉNARIO INCOHÉRENT 5/5 — données manquantes/invalides : patient absent, motif absent, patient malformé, urgence_id malformé', async () => {
      const patient = await mkPatient('donnees-invalides');
      const urg = await mkUrgence(patient, 'donnees-invalides');

      const rSansPatient = await call({ urgence_id: String(urg._id), motif_entree: 'test' });
      assert.equal(rSansPatient.status, 400);
      assert.match(rSansPatient.body.message, /patient obligatoire/i);

      const rSansMotif = await call({ patient: String(patient._id), urgence_id: String(urg._id) });
      assert.equal(rSansMotif.status, 400);
      assert.match(rSansMotif.body.message, /motif/i);

      const rPatientMalforme = await call({ patient: 'pas-un-objectid', urgence_id: String(urg._id), motif_entree: 'test' });
      assert.equal(rPatientMalforme.status, 400);
      assert.match(rPatientMalforme.body.message, /référence patient invalide/i);

      // urgence_id malformé : contrairement à `patient` (validation isObjectId
      // explicite avant lecture, testée ci-dessus), aucune garde dédiée
      // n'existe ici — Urgence.findById() lève directement un CastError
      // Mongoose, relayé à next(err). Ce harnais de test léger n'a pas la
      // chaîne de middleware Express réelle (contrairement à l'application) :
      // on capture donc directement l'erreur passée à next() plutôt que de
      // réimplémenter errorHandler.js. Dans l'application réelle, ce même
      // CastError est converti en 404 "Ressource introuvable" par le
      // middleware d'erreur global (backend/middleware/errorHandler.js:41-45,
      // vérifié par lecture de code ET reproduit isolément en dehors de ce
      // harnais) — comportement sûr : aucune hospitalisation créée, aucune
      // exception non gérée, aucun crash serveur, juste un message moins
      // spécifique que pour `patient`.
      let urgenceMalformeeErr = null;
      await hospC.create(
        { body: { patient: String(patient._id), urgence_id: 'pas-un-objectid-non-plus', motif_entree: 'test' }, user, ip: '127.0.0.1' },
        { status: () => ({ json: () => {} }), json: () => {} },
        (err) => { urgenceMalformeeErr = err; }
      );
      assert.ok(urgenceMalformeeErr, 'une erreur doit être relayée à next() pour un urgence_id malformé');
      assert.equal(urgenceMalformeeErr.name, 'CastError');
      assert.equal(urgenceMalformeeErr.path, '_id');

      const count = await Hospitalization.countDocuments({ patient: patient._id });
      assert.equal(count, 0, 'aucune des 4 requêtes invalides ne doit avoir créé la moindre hospitalisation');
      const freshUrg = await Urgence.findById(urg._id).lean();
      assert.equal(freshUrg.admission_status, 'non_requise', 'l\'urgence ne doit jamais être affectée par des requêtes rejetées pour données invalides');
    });

    await t.test('NON-RÉGRESSION — urgence SANS patient identifié (intake ER) + patient fourni directement → toujours accepté (comportement volontaire, pas une incohérence)', async () => {
      const patient = await mkPatient('intake-non-identifie');
      const urgSansPatient = await mkUrgence(null, 'intake-non-identifie');
      assert.equal(urgSansPatient.patient, undefined, 'préalable : cette urgence ne doit avoir aucun patient identifié');

      const { status, body } = await call({ patient: String(patient._id), urgence_id: String(urgSansPatient._id), motif_entree: 'Identification tardive' });
      assert.equal(status, 201, JSON.stringify(body));
      cleanup.push(() => Hospitalization.findByIdAndDelete(body.hospitalization._id));
    });
  } finally {
    for (const fn of cleanup) await fn();
    for (const fn of patientCleanup) await fn();
    await mongoose.disconnect();
  }
});
