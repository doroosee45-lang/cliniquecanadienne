// DASHBOARD-VIDE-001 (13 sept. 2026) — le compte réel meyaosee@gmail.com
// (rôle patient) avait patient_id absent depuis sa création, bien que le
// repli par email (portal.controller.js::findPatient) le sauvait à chaque
// appel — jamais corrigé durablement, dépendant indéfiniment d'une
// correspondance d'email fragile (un email différent, un espace parasite ou
// une casse différente entre User et Patient suffit à la casser). Racine la
// plus plausible : patients.controller.js::create() ignorait silencieusement
// la liaison patient_id quand un User existait déjà pour cet email (ex.
// auto-inscription antérieure jamais liée) — corrigé ici : un tel compte est
// désormais lié au nouveau dossier plutôt que laissé sans lien. Ce fichier
// prouve cette correction ; l'auto-guérison complémentaire (findPatient()
// persiste patient_id dès qu'il le résout par email) est couverte par
// portalPatientIdResolution.test.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('DASHBOARD-VIDE-001 — patients.controller.js::create() lie un compte User existant sans patient_id (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const patientsC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const cleanup = [];
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'DV1', nom: 'Staff', role: 'receptionniste' };

  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await patientsC.create(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('un User déjà existant (sans patient_id) pour cet email est lié au nouveau dossier, pas laissé orphelin', async () => {
      const email = `_dv1-preexist-${stamp}@_test.local`;
      // Simule un compte déjà présent AVANT la création du dossier "officiel"
      // par le personnel — ex. une auto-inscription antérieure jamais liée —
      // sans jamais renseigner patient_id, exactement l'état découvert sur
      // le compte réel meyaosee@gmail.com.
      const preexistingUser = await User.create({
        email, password: 'Xx1aaaaa', nom: 'DV1', prenom: 'Preexist', role: 'patient', statut: 'actif',
      });
      cleanup.push(() => User.findByIdAndDelete(preexistingUser._id));

      const { status, body } = await call({
        body: { nom: `DV1${stamp}`, prenom: 'Patient', email, date_naissance: '1990-01-01', sexe: 'M', telephone: '+242000000' },
        user: staff, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      cleanup.push(() => Patient.findByIdAndDelete(body.patient._id));

      const userAfter = await User.findById(preexistingUser._id).lean();
      assert.equal(String(userAfter.patient_id), String(body.patient._id), 'le compte préexistant doit être lié au nouveau dossier, jamais laissé sans patient_id');

      const linkLog = await AuditLog.findOne({ action: 'LINK_PATIENT_DOSSIER', module: 'patients', entite_id: body.patient._id }).lean();
      assert.ok(linkLog, 'la liaison doit être journalisée, pas silencieuse');
    });

    await t.test('un User déjà existant AVEC patient_id (pointant ailleurs) n\'est jamais réécrit', async () => {
      const email = `_dv1-alreadylinked-${stamp}@_test.local`;
      // L'email doit être posé sur le Patient lui-même (pas seulement sur le
      // User) : create() détecte un doublon via Patient.email (①), jamais via
      // User.email — sans quoi ce test ne prouverait rien (aucune collision
      // possible à la création, quel que soit le comportement réel du code).
      const otherPatient = await Patient.create({ nom: `DV1Other${stamp}`, prenom: 'P', date_naissance: '1985-01-01', sexe: 'F', email });
      const linkedUser = await User.create({
        email, password: 'Xx1aaaaa', nom: 'DV1', prenom: 'Linked', role: 'patient', statut: 'actif', patient_id: otherPatient._id,
      });
      // Ordre important (ticket 0008, models/Patient.js) : le User actif
      // référence otherPatient._id, donc il doit être supprimé avant lui.
      cleanup.push(() => User.findByIdAndDelete(linkedUser._id));
      cleanup.push(() => Patient.findByIdAndDelete(otherPatient._id));

      const { status, body } = await call({
        body: { nom: `DV1B${stamp}`, prenom: 'Patient', email, date_naissance: '1990-01-01', sexe: 'M', telephone: '+242000000' },
        user: staff, ip: '127.0.0.1', headers: {},
      });
      // Un Patient existe déjà pour cet email (otherPatient) — create() doit
      // refuser la création (409, comportement préexistant, non modifié ici).
      assert.equal(status, 409);

      const userAfter = await User.findById(linkedUser._id).lean();
      assert.equal(String(userAfter.patient_id), String(otherPatient._id), 'un patient_id déjà correct ne doit jamais être modifié');
    });

    await t.test('aucun User existant — création classique inchangée (non-régression)', async () => {
      const email = `_dv1-brandnew-${stamp}@_test.local`;
      const { status, body } = await call({
        body: { nom: `DV1C${stamp}`, prenom: 'Patient', email, date_naissance: '1990-01-01', sexe: 'M', telephone: '+242000000' },
        user: staff, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      cleanup.push(() => Patient.findByIdAndDelete(body.patient._id));

      const newUser = await User.findOne({ email }).lean();
      cleanup.unshift(() => User.findByIdAndDelete(newUser._id));
      assert.equal(String(newUser.patient_id), String(body.patient._id));
    });
  } finally {
    for (const fn of cleanup) await fn();
    await AuditLog.deleteMany({ action: 'LINK_PATIENT_DOSSIER', module: 'patients', message: { $regex: '_dv1-' } });
    await mongoose.disconnect();
  }
});
