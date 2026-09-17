// Correction — Dashboard Portail Patient : le compteur "Rendez-vous à
// venir" (stats.nbRdv, portal.controller.js::getMe) ne comptait que les
// statuts ['planifie','confirme'], jamais 'en_attente' — le statut posé
// par createAppointment() à la création d'un RDV depuis le portail patient
// (voir ligne "data.statut = 'en_attente';"). Un patient créant un RDV
// voyait donc son compteur rester inchangé tant qu'un membre du staff
// n'avait pas traité la demande, alors que le RDV existait déjà réellement
// en base et apparaissait dans l'onglet "Rendez-vous" (qui utilise
// RDV_ACTIFS, déjà correct dans getDashboard). RDV_ACTIFS est désormais
// une constante unique partagée entre getMe et getDashboard.
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('Portail patient/getMe — stats.nbRdv compte réellement un RDV "en_attente" (juste créé par le patient), pas seulement planifie/confirme (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `PortalRdv-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1990-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const patientUser = await User.create({ email: `_portalrdv-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: patient.nom, prenom: patient.prenom, role: 'patient', statut: 'actif', patient_id: patient._id });
    cleanup.push(() => User.findByIdAndDelete(patientUser._id));
    const medecin = await User.create({ email: `_portalrdv-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));

    const req = { user: patientUser };

    await t.test('avant création : nbRdv = 0 pour ce patient synthétique', async () => {
      const r = await call(portalC.getMe, req);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.stats.nbRdv, 0);
    });

    // Simule exactement ce que createAppointment() persiste réellement
    // (statut initial 'en_attente', jamais modifié par le staff ici).
    const rdv = await Appointment.create({
      patient: patient._id, medecin: medecin._id, date_heure: new Date(Date.now() + 7 * 86400000),
      motif: 'Test synthétique', statut: 'en_attente',
    });
    cleanup.push(() => Appointment.findByIdAndDelete(rdv._id));

    await t.test('après création (statut en_attente, jamais traité par le staff) : nbRdv passe réellement à 1', async () => {
      const r = await call(portalC.getMe, req);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.stats.nbRdv, 1, 'un RDV en_attente doit compter dans "Rendez-vous à venir", pas seulement planifie/confirme');
    });

    await t.test('non-régression — un RDV réellement terminé/annulé ne doit jamais être compté', async () => {
      await Appointment.findByIdAndUpdate(rdv._id, { statut: 'termine' });
      const r = await call(portalC.getMe, req);
      assert.equal(r.body.stats.nbRdv, 0, 'un RDV soldé (terminé) ne doit plus être compté');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
