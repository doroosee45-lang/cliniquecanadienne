// R-07 — portal.controller.js résolvait le dossier Patient exclusivement par
// email, malgré l'existence de User.patient_id (T2.2) jamais utilisé côté
// lecture. Migré vers patient_id en priorité, repli sur l'email pour les
// comptes non encore liés (vérifié avant migration : 4 comptes sur 7 dans
// les données réelles — pas un cas rare), avec journalisation d'anomalie si
// patient_id est renseigné mais ne résout plus rien.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('résolution patient_id/email dans portal.controller.js (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const AuditLog = require('../models/AuditLog');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const cleanup = [];
  const call = async (user) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await portalC.getMe({ user }, res, () => {});
    return { status, body };
  };

  try {
    await t.test('patient_id prioritaire — résout même si l\'email ne matcherait aucun dossier', async () => {
      const patient = await Patient.create({ nom: `T07A${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_t07-real-${stamp}@_test.local` });
      // Email du compte volontairement différent de celui du dossier —
      // seule la résolution par patient_id peut réussir ici.
      const user = await User.create({ email: `_t07-userA-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T07A', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id });
      // Ordre important depuis la contrainte structurelle du ticket 0008 :
      // le User actif référence patient._id, donc il doit être supprimé
      // avant le Patient (cleanup s'exécute dans l'ordre de push).
      cleanup.push(() => User.findByIdAndDelete(user._id));
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status, body } = await call(user);
      assert.equal(status, 200);
      assert.equal(String(body.patient._id), String(patient._id));
    });

    await t.test('repli sur l\'email quand patient_id n\'est pas peuplé — et auto-guérison persistée (DASHBOARD-VIDE-001)', async () => {
      const email = `_t07-fallback-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `T07B${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email });
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'T07B', prenom: 'U', role: 'patient', statut: 'actif' });
      // DASHBOARD-VIDE-001 — ce repli persiste désormais patient_id (voir
      // plus bas) : comme le test T07A, le User (qui référencera bientôt le
      // Patient) doit être nettoyé avant lui, sans quoi la contrainte
      // structurelle du ticket 0008 (models/Patient.js) refuse la
      // suppression d'un dossier encore référencé par un compte actif.
      cleanup.push(() => User.findByIdAndDelete(user._id));
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status, body } = await call(user);
      assert.equal(status, 200);
      assert.equal(String(body.patient._id), String(patient._id));

      // DASHBOARD-VIDE-001 — le compte réel meyaosee@gmail.com (audit du
      // 13 sept. 2026) avait patient_id absent depuis sa création, jamais
      // corrigé par aucun appel ultérieur : ce repli réussissait à chaque
      // fois mais ne guérissait jamais le compte, le laissant dépendant
      // indéfiniment d'une correspondance d'email fragile. findPatient()
      // doit désormais persister patient_id dès qu'il est résolu ainsi.
      const userAfter = await User.findById(user._id).lean();
      assert.equal(String(userAfter.patient_id), String(patient._id), 'patient_id doit être persisté après une résolution réussie par email');

      const healLog = await AuditLog.findOne({ action: 'LINK_PATIENT_DOSSIER', utilisateur: user._id }).lean();
      assert.ok(healLog, 'la liaison automatique doit être journalisée, pas silencieuse');
      assert.equal(String(healLog.entite_id), String(patient._id));
    });

    await t.test('patient_id déjà présent — jamais réécrit par le repli (le repli ne s\'exécute même pas dans ce cas)', async () => {
      const patient = await Patient.create({ nom: `T07E${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_t07-noheal-real-${stamp}@_test.local` });
      const user = await User.create({ email: `_t07-noheal-user-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T07E', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      await call(user);
      const userAfter = await User.findById(user._id).lean();
      assert.equal(String(userAfter.patient_id), String(patient._id), 'patient_id déjà correct ne doit jamais être modifié');
      const healLog = await AuditLog.findOne({ action: 'LINK_PATIENT_DOSSIER', utilisateur: user._id }).lean();
      assert.equal(healLog, null, 'aucune guérison ne doit se déclencher quand patient_id est déjà renseigné et valide');
    });

    await t.test('patient_id cassé (dossier supprimé) → anomalie journalisée avant le repli', async () => {
      const email = `_t07-broken-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `T07C${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email });
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'T07C', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));
      // Dossier supprimé APRÈS avoir été lié — simule le cas réel découvert
      // (ticket 0008) : le repli email échoue aussi, puisque le seul
      // Patient à cette adresse vient d'être supprimé. L'important ici
      // n'est pas que le repli "sauve" la requête (il ne le peut pas dans
      // ce cas précis) mais que l'anomalie soit bien journalisée avant
      // l'échec final, pour distinguer ce cas d'un compte jamais lié.
      // Passe par le driver Mongo brut plutôt que Patient.findByIdAndDelete :
      // la contrainte structurelle ajoutée pour le ticket 0008 bloque
      // désormais ce chemin normal tant qu'un User actif référence le
      // patient — ce test simule justement un état déjà cassé (donnée
      // historique antérieure à la contrainte, ou intervention DB directe
      // hors application), pas un nouveau cas que l'app laisserait se
      // produire elle-même.
      await mongoose.connection.collection('patients').deleteOne({ _id: patient._id });

      const before = await AuditLog.countDocuments({ action: 'DATA_ANOMALY', utilisateur: user._id });
      const { status } = await call(user);
      assert.equal(status, 404, 'aucun dossier ne reste à cette adresse — le repli ne peut pas réussir');
      const after = await AuditLog.countDocuments({ action: 'DATA_ANOMALY', utilisateur: user._id });
      assert.equal(after, before + 1, 'anomalie doit être journalisée avant l\'échec du repli');
    });

    await t.test('ni patient_id ni email ne résolvent → 404 (comptes orphelins, ticket 0008)', async () => {
      const user = await User.create({ email: `_t07-orphan-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T07D', prenom: 'U', role: 'patient', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(user);
      assert.equal(status, 404);
      assert.match(body.message, /introuvable/);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await AuditLog.deleteMany({ action: { $in: ['DATA_ANOMALY', 'LINK_PATIENT_DOSSIER'] }, module: 'portal', message: { $regex: `_t07-` } });
    await mongoose.disconnect();
  }
});
