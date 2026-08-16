// Corrections demandées — gestion des rendez-vous : confirmation et
// modification (report) déclenchent chacune une notification email au
// patient, distinctes de l'email envoyé à la création. Vérifie la logique de
// détection (quelle transition déclenche quoi) via le champ
// notification_envoyee retourné par update() — sendEmail() lui-même n'est
// pas mocké (convention du projet, cf. T9.6), donc on vérifie la décision
// de déclenchement plutôt que la remise réelle du mail.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('appointments.controller.update — notifications de confirmation et de report', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const apptC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Staff', role: 'medecin' };
  const patient = await Patient.create({
    nom: `RDV${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M',
    email: `_rdv-notif-${stamp}@_test.local`,
  });
  const medecin = await User.create({ email: `_rdv-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'RDV', role: 'medecin', statut: 'actif' });

  const cleanup = [() => Patient.findByIdAndDelete(patient._id), () => User.findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('confirmation (statut → confirme) déclenche notification_envoyee=confirme', async () => {
      const appt = await Appointment.create({
        patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 86400000),
        motif: 'Suivi', type: 'consultation', statut: 'planifie',
      });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));

      const { status, body } = await call(apptC.update, { params: { id: appt._id }, body: { statut: 'confirme' }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.notification_envoyee, 'confirme');
    });

    await t.test('confirmation répétée (déjà confirmé) ne redéclenche pas de notification', async () => {
      const appt = await Appointment.create({
        patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 86400000),
        motif: 'Suivi', type: 'consultation', statut: 'confirme',
      });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));

      const { body } = await call(apptC.update, { params: { id: appt._id }, body: { statut: 'confirme' }, user: staff, ip: '127.0.0.1' });
      assert.equal(body.notification_envoyee, null, 'déjà confirmé avant — pas de nouvelle notification');
    });

    await t.test('changement de date_heure (report) déclenche notification_envoyee=reporte', async () => {
      const dateInitiale = new Date(Date.now() + 86400000);
      const appt = await Appointment.create({
        patient: patient._id, medecin: medecin._id, date_heure: dateInitiale,
        motif: 'Suivi', type: 'consultation', statut: 'confirme',
      });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));

      const nouvelleDate = new Date(Date.now() + 2 * 86400000);
      const { status, body } = await call(apptC.update, { params: { id: appt._id }, body: { date_heure: nouvelleDate, statut: 'reporte', motif_report: 'Indisponibilité du médecin' }, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.notification_envoyee, 'reporte');
      assert.equal(new Date(body.appointment.date_heure).getTime(), nouvelleDate.getTime(), 'la nouvelle date doit remplacer l\'ancienne dans le document');
      assert.equal(body.appointment.motif_report, 'Indisponibilité du médecin', 'motif_report (formulaire Reporter) ne doit plus être silencieusement supprimé');
    });

    await t.test('mise à jour sans changement de date ni de statut vers confirme — aucune notification', async () => {
      const appt = await Appointment.create({
        patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 86400000),
        motif: 'Suivi', type: 'consultation', statut: 'planifie',
      });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));

      const { body } = await call(apptC.update, { params: { id: appt._id }, body: { motif: 'Motif révisé' }, user: staff, ip: '127.0.0.1' });
      assert.equal(body.notification_envoyee, null);
      assert.equal(body.appointment.motif, 'Motif révisé');
    });

    await t.test('report + confirmation simultanés — le report prend priorité (une seule notification)', async () => {
      const appt = await Appointment.create({
        patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 86400000),
        motif: 'Suivi', type: 'consultation', statut: 'planifie',
      });
      cleanup.push(() => Appointment.findByIdAndDelete(appt._id));

      const nouvelleDate = new Date(Date.now() + 3 * 86400000);
      const { body } = await call(apptC.update, { params: { id: appt._id }, body: { date_heure: nouvelleDate, statut: 'confirme' }, user: staff, ip: '127.0.0.1' });
      assert.equal(body.notification_envoyee, 'reporte');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
