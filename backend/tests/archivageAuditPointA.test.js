// AUDIT-ARCHIVAGE-A — motif systémique identifié lors de l'audit de
// couverture : chaque garde métier logue le succès mais jamais le refus.
// Ce fichier vérifie sur base réelle que les 8 points de refus identifiés
// (6 prévus au plan + 2 trouvés en marge dans appointments.controller.js::
// update — même garde de conflit que create(), pas auditée non plus)
// produisent désormais une vraie entrée AuditLog avec statut:'echec',
// jamais un simple 4xx silencieux. Réutilise logAction() tel quel — aucun
// nouveau mécanisme, le champ statut existait déjà et est déjà exploité par
// audit.controller.js::computeRisque (echec => risque eleve/critique
// automatique, vérifié dans le code avant d'écrire ce test).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Archivage/Audit — Point A : tentatives bloquées désormais tracées (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Prescription = require('../models/Prescription');
  const Medication = require('../models/Medication');
  const Conversation = require('../models/Conversation');
  const Appointment = require('../models/Appointment');
  const AuditLog = require('../models/AuditLog');
  const patientsC = require('../controllers/patients.controller');
  const pharmacyC = require('../controllers/pharmacy.controller');
  const messagesC = require('../controllers/messages.controller');
  const appointmentsC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], prescriptions: [], meds: [], conversations: [], appointments: [], messages: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  const lastEchec = async (action, module) => AuditLog.findOne({ action, module, statut: 'echec' }).sort('-createdAt').lean();

  try {
    await t.test('1. patients.controller.js::remove — suppression refusée (compte portail actif) désormais tracée en échec', async () => {
      const patient = await Patient.create({ nom: `T-ARCHA1-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const portalUser = await User.create({ email: `t-archa1-${stamp}@test.local`, nom: 'X', prenom: 'Y', role: 'patient', statut: 'actif', patient_id: patient._id });
      created.users.push(portalUser);
      const admin = await User.create({ email: `t-archa1-admin-${stamp}@test.local`, nom: 'Admin', prenom: 'A', role: 'superadmin', statut: 'actif' });
      created.users.push(admin);

      const { status } = await call(patientsC.remove, { params: { id: patient._id.toString() }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 409, 'la garde schéma doit toujours refuser la suppression (comportement inchangé)');

      const log = await lastEchec('DELETE', 'patients');
      assert.ok(log, 'un vrai refus de suppression doit désormais produire une entrée AuditLog statut:echec');
      assert.match(log.message, new RegExp(`T-ARCHA1-${stamp}`));

      // Nettoyage : détache le compte portail pour permettre la suppression réelle en fin de test.
      await User.findByIdAndDelete(portalUser._id);
      created.users = created.users.filter(u => u._id.toString() !== portalUser._id.toString());
    });

    await t.test('2. pharmacy.controller.js::dispenser — ordonnance non dispensable (statut) désormais tracée en échec', async () => {
      const patient = await Patient.create({ nom: `T-ARCHA2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const medecin = await User.create({ email: `t-archa2-${stamp}@test.local`, nom: 'M', prenom: 'D', role: 'medecin', statut: 'actif' });
      created.users.push(medecin);
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'brouillon' });
      created.prescriptions.push(rx);

      const { status } = await call(pharmacyC.dispenser, { params: { id: rx._id.toString() }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 400);

      const log = await lastEchec('DISPENSE', 'pharmacy');
      assert.ok(log, 'un refus de dispensation (statut invalide) doit produire une entrée AuditLog statut:echec');
      assert.match(log.message, /brouillon/);
    });

    await t.test('3. pharmacy.controller.js::dispenser — stock insuffisant désormais tracé en échec', async () => {
      const patient = await Patient.create({ nom: `T-ARCHA3-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const medecin = await User.create({ email: `t-archa3-${stamp}@test.local`, nom: 'M', prenom: 'D', role: 'medecin', statut: 'actif' });
      created.users.push(medecin);
      const med = await Medication.create({ nom_commercial: `T-ARCHA3-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 1, stock_minimum: 10, prix_vente: 100, statut: 'disponible' });
      created.meds.push(med);
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: 5 }] });
      created.prescriptions.push(rx);

      const { status } = await call(pharmacyC.dispenser, { params: { id: rx._id.toString() }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 400);

      const log = await lastEchec('DISPENSE', 'pharmacy');
      assert.ok(log, 'un refus de dispensation (stock insuffisant) doit produire une entrée AuditLog statut:echec');
      assert.match(log.message, /stock insuffisant/i);
    });

    await t.test('4-5. messages.controller.js::deleteMessage — refus non-membre et non-auteur désormais tracés en échec', async () => {
      const u1 = await User.create({ email: `t-archa4-1-${stamp}@test.local`, nom: 'U1', prenom: 'A', role: 'medecin', statut: 'actif' });
      const u2 = await User.create({ email: `t-archa4-2-${stamp}@test.local`, nom: 'U2', prenom: 'B', role: 'medecin', statut: 'actif' });
      const u3 = await User.create({ email: `t-archa4-3-${stamp}@test.local`, nom: 'U3', prenom: 'C', role: 'medecin', statut: 'actif' });
      created.users.push(u1, u2, u3);
      // AUDIT-ELEVE-5 — message créé dans la collection Message dédiée
      // (plus Conversation.messages, migré).
      const conv = await Conversation.create({ type: 'direct', membres: [u1._id, u2._id] });
      created.conversations.push(conv);
      const Message = require('../models/Message');
      const msg = await Message.create({ conversation_id: conv._id, expediteur: u1._id, contenu: `T-ARCHA4-${stamp}` });
      created.messages.push(msg);
      const msgId = msg._id.toString();

      const { status: statusNonMembre } = await call(messagesC.deleteMessage, { params: { msgId }, user: u3, ip: '127.0.0.1' });
      assert.equal(statusNonMembre, 403);
      const logNonMembre = await lastEchec('DELETE', 'messages');
      assert.ok(logNonMembre, 'un refus "non membre" doit produire une entrée AuditLog statut:echec');
      assert.match(logNonMembre.message, /non membre/);

      const { status: statusNonAuteur } = await call(messagesC.deleteMessage, { params: { msgId }, user: u2, ip: '127.0.0.1' });
      assert.equal(statusNonAuteur, 403);
      const logNonAuteur = await lastEchec('DELETE', 'messages');
      assert.ok(logNonAuteur, 'un refus "non auteur" doit produire une entrée AuditLog statut:echec');
      assert.match(logNonAuteur.message, /non auteur/);
    });

    await t.test('6. appointments.controller.js::create — conflit de créneau désormais tracé en échec', async () => {
      const patient = await Patient.create({ nom: `T-ARCHA6-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const medecin = await User.create({ email: `t-archa6-${stamp}@test.local`, nom: 'M', prenom: 'D', role: 'medecin', statut: 'actif' });
      created.users.push(medecin);
      const dateHeure = new Date('2033-05-10T10:00:00Z');
      const appt1 = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: dateHeure, motif: 'Test', created_by: medecin._id });
      created.appointments.push(appt1);

      const { status } = await call(appointmentsC.create, { body: { patient: patient._id.toString(), medecin: medecin._id.toString(), date_heure: dateHeure.toISOString(), motif: 'Conflit' }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 400);

      const log = await lastEchec('CREATE', 'appointments');
      assert.ok(log, 'un refus de création (conflit de créneau) doit produire une entrée AuditLog statut:echec');
      assert.match(log.message, /conflit/i);
    });

    await t.test('(trouvé en marge) appointments.controller.js::update — même garde de conflit, désormais tracée en échec', async () => {
      const patient = await Patient.create({ nom: `T-ARCHA6B-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const medecin = await User.create({ email: `t-archa6b-${stamp}@test.local`, nom: 'M', prenom: 'D', role: 'medecin', statut: 'actif' });
      created.users.push(medecin);
      const dateA = new Date('2033-05-11T10:00:00Z');
      const dateB = new Date('2033-05-11T14:00:00Z');
      const apptA = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: dateA, motif: 'A', created_by: medecin._id });
      const apptB = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: dateB, motif: 'B', created_by: medecin._id });
      created.appointments.push(apptA, apptB);

      const { status } = await call(appointmentsC.update, { params: { id: apptB._id.toString() }, body: { date_heure: dateA.toISOString() }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 400);

      const log = await lastEchec('UPDATE', 'appointments');
      assert.ok(log, 'un refus de modification (conflit de créneau) doit produire une entrée AuditLog statut:echec');
      assert.match(log.message, /conflit/i);
    });

    await t.test('sanity — les chemins de succès continuent de fonctionner normalement après ces changements', async () => {
      const patient = await Patient.create({ nom: `T-ARCHA-OK-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const admin = await User.create({ email: `t-archa-ok-${stamp}@test.local`, nom: 'Admin', prenom: 'A', role: 'superadmin', statut: 'actif' });
      created.users.push(admin);

      const { status, body } = await call(patientsC.remove, { params: { id: patient._id.toString() }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.success, true, 'un patient sans historique doit toujours pouvoir être réellement supprimé');
      const log = await AuditLog.findOne({ action: 'DELETE', module: 'patients', statut: 'succes' }).sort('-createdAt').lean();
      assert.ok(log, 'le succès doit toujours être tracé normalement (statut:succes)');
    });
  } finally {
    for (const m of created.messages) await m.deleteOne();
    for (const c of created.conversations) await Conversation.findByIdAndDelete(c._id);
    for (const a of created.appointments) await Appointment.findByIdAndDelete(a._id);
    for (const r of created.prescriptions) await Prescription.findByIdAndDelete(r._id);
    for (const m of created.meds) await Medication.findByIdAndDelete(m._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
