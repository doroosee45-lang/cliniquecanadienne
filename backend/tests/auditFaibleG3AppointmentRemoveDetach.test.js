// AUDIT-FAIBLE-G3 — appointments.controller.js::remove supprimait le
// rendez-vous sans détacher Consultation.appointment, laissant une
// référence orpheline pour toute consultation créée depuis ce RDV. Même
// pattern que consultations.controller.js::remove (AUDIT-3.4) déjà en
// place pour Prescription.consultation : $unset ciblé, jamais de
// suppression du document référençant. Consultation est le seul modèle du
// projet référençant Appointment (vérifié exhaustivement, grep sur tout
// backend/models/).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-FAIBLE-G3 — appointments.controller.js::remove détache Consultation.appointment (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Appointment = require('../models/Appointment');
  const Consultation = require('../models/Consultation');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const apptC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const created = { appts: [], consults: [], patients: [], users: [] };
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `G3${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient);
    const medecin = await User.create({ email: `_g3-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'G3', prenom: 'Med', role: 'medecin', statut: 'actif' });
    created.users.push(medecin);
    const staff = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

    await t.test('suppression d\'un RDV référencé par une consultation → Consultation.appointment détaché ($unset), consultation jamais supprimée', async () => {
      const appt = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(), motif: 'G3 Suivi', type: 'consultation' });
      created.appts.push(appt);
      const consult = await Consultation.create({ patient: patient._id, medecin: medecin._id, appointment: appt._id, date_consultation: new Date(), type_consultation: 'nouvelle_visite', service: 'Médecine Générale' });
      created.consults.push(consult);

      const { status } = await call(apptC.remove, { params: { id: appt._id.toString() }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);

      const fresh = await Consultation.findById(consult._id).lean();
      assert.ok(fresh, 'la consultation ne doit jamais être supprimée, seul le lien est détaché');
      assert.equal(fresh.appointment, undefined, 'appointment doit être détaché (undefined après $unset)');
      assert.equal(await Appointment.findById(appt._id), null, 'le rendez-vous doit toujours être réellement supprimé');
    });

    await t.test('non-régression — suppression d\'un RDV sans consultation liée fonctionne toujours (0 détachement, pas d\'erreur)', async () => {
      const appt = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 3600000), motif: 'G3 Sans lien', type: 'consultation' });
      created.appts.push(appt);

      const { status, body } = await call(apptC.remove, { params: { id: appt._id.toString() }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.message, 'Rendez-vous supprimé.');
    });
  } finally {
    for (const c of created.consults) await Consultation.findByIdAndDelete(c._id).catch(() => {});
    for (const a of created.appts) await Appointment.findByIdAndDelete(a._id).catch(() => {});
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
