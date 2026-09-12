// CLIN-05 (correction du 12 sept. 2026, audit indépendant) —
// appointments.controller.js::create persistait `{ ...req.body,
// created_by: req.user._id }` : un client pouvait fabriquer rappels_envoyes
// (compteur de rappels réels utilisé ailleurs pour décider d'un rappel) ou
// tout autre champ du schéma, sans aucune liste blanche. Corrigé via une
// liste blanche stricte (APPT_CREATE_ALLOWED_FIELDS), même principe que
// CLIN-01/CLIN-02 pour Prescription/Urgence.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('CLIN-05 — la création de rendez-vous ignore tout champ fabriqué hors liste blanche', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const apptC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Clin05-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const medecin = await User.create({ email: `_clin05-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test5', role: 'medecin', statut: 'actif' });
  const autreUser = await User.create({ email: `_clin05-autre-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Autre', prenom: 'Utilisateur', role: 'medecin', statut: 'actif' });
  const created = [];

  try {
    await t.test('rappels_envoyes/created_by/statut terminal fabriqués par le client sont ignorés à la création', async () => {
      const { status, body } = await call(apptC.create, {
        user: { _id: medecin._id, prenom: 'Requester', nom: 'Test' },
        ip: '127.0.0.1',
        body: {
          patient: patient._id, medecin: medecin._id,
          date_heure: new Date(Date.now() + 3600_000).toISOString(),
          duree_minutes: 30, motif: 'Consultation', type: 'consultation',
          rappels_envoyes: 99,
          created_by: autreUser._id.toString(),
          statut: 'termine',
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.push(body.appointment._id);

      const fresh = await Appointment.findById(body.appointment._id).lean();
      assert.equal(fresh.rappels_envoyes, 0, 'rappels_envoyes fabriqué par le client doit être ignoré, jamais persisté');
      assert.equal(String(fresh.created_by), String(medecin._id), 'created_by doit toujours être le vrai utilisateur authentifié, jamais un ObjectId fabriqué');
      assert.equal(fresh.statut, 'planifie', 'un statut terminal fabriqué à la création doit être ignoré — jamais de RDV créé déjà "terminé"');
    });

    await t.test('statut légitime (en_attente, réellement envoyé par Appointments.jsx) est accepté', async () => {
      const { status, body } = await call(apptC.create, {
        user: { _id: medecin._id, prenom: 'Requester', nom: 'Test' },
        ip: '127.0.0.1',
        body: {
          patient: patient._id, medecin: medecin._id,
          date_heure: new Date(Date.now() + 7200_000).toISOString(),
          duree_minutes: 30, motif: 'Consultation', type: 'consultation',
          statut: 'en_attente',
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.push(body.appointment._id);
      const fresh = await Appointment.findById(body.appointment._id).lean();
      assert.equal(fresh.statut, 'en_attente');
    });

    await t.test('salle/notes réellement envoyés par les formulaires restent acceptés (non-régression)', async () => {
      const { status, body } = await call(apptC.create, {
        user: { _id: medecin._id, prenom: 'Requester', nom: 'Test' },
        ip: '127.0.0.1',
        body: {
          patient: patient._id, medecin: medecin._id,
          date_heure: new Date(Date.now() + 10800_000).toISOString(),
          duree_minutes: 30, motif: 'Consultation', type: 'consultation',
          salle: 'Salle 3', notes: 'Note réelle du personnel',
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.push(body.appointment._id);
      const fresh = await Appointment.findById(body.appointment._id).lean();
      assert.equal(fresh.salle, 'Salle 3');
      assert.equal(fresh.notes, 'Note réelle du personnel');
    });
  } finally {
    await Appointment.deleteMany({ _id: { $in: created } });
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await User.findByIdAndDelete(autreUser._id);
    await mongoose.disconnect();
  }
});
