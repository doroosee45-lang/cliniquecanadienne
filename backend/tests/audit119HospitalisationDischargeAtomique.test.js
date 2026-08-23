// AUDIT-11-9 — discharge() (hospitalization.controller.js) fusionnait
// req.body sans liste blanche (contrairement à update(), qui bloque déjà la
// réassignation du champ patient via HOSP_BLOCKED_FIELDS) et ne vérifiait
// jamais le statut courant avant la transition : un second appel sur un
// dossier déjà sorti/transféré/décédé écrasait silencieusement date_sortie
// avec l'heure de ce second appel. Corrigé en réutilisant
// HOSP_BLOCKED_FIELDS et en rendant la garde (statut encore 'en_cours')
// atomique via le filtre du findOneAndUpdate lui-même (même principe que
// finance.controller.js::addPayment, Point 6) — pas juste une vérification
// séparée avant l'écriture, qui laisserait la même fenêtre de course.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-11-9 — sortie d\'hospitalisation atomique, jamais une double sortie ni une réassignation de patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Room = require('../models/Room');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_h119-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'H119', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const created = { patients: [], rooms: [], hospitalisations: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  const makeHosp = async (label) => {
    const patient = await Patient.create({ nom: `H119-${label}-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient);
    const room = await Room.create({ numero: `H119R-${label}-${stamp}`, lits: [{ numero: 'L1', statut: 'occupe', patient_actuel: patient._id }] });
    created.rooms.push(room);
    const hosp = await Hospitalization.create({
      patient: patient._id, medecin_responsable: medecin._id, chambre: room._id, service_nom: 'Médecine',
      motif_entree: `Test ${label}`, lit_numero: 'L1', statut: 'en_cours',
    });
    created.hospitalisations.push(hosp);
    return { patient, room, hosp };
  };

  try {
    await t.test('discharge — une sortie normale réussit, statut/date_sortie/lit réellement mis à jour', async () => {
      const { hosp, room } = await makeHosp('normal');
      const { status, body } = await call(hospC.discharge, {
        params: { id: hosp._id.toString() }, user, ip: '127.0.0.1',
        body: { etat_patient: 'gueri', recommandations: 'Repos' },
      });
      assert.equal(status, 200);
      assert.equal(body.hospitalization.statut, 'sorti');
      assert.ok(body.hospitalization.date_sortie);

      const reluRoom = await Room.findById(room._id).lean();
      assert.equal(reluRoom.lits[0].statut, 'libre', 'le lit doit être réellement libéré');
    });

    await t.test('discharge — une seconde tentative sur le même dossier est rejetée proprement (409), date_sortie reste celle du premier appel', async () => {
      const { hosp } = await makeHosp('double');
      const { status: s1, body: b1 } = await call(hospC.discharge, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: {} });
      assert.equal(s1, 200);
      const dateSortieOriginale = b1.hospitalization.date_sortie;

      // Une seconde de délai pour garantir que, si le bug réapparaissait,
      // date_sortie du second appel serait mesurablement différente.
      await new Promise(r => setTimeout(r, 1100));

      const { status: s2, body: b2 } = await call(hospC.discharge, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: {} });
      assert.equal(s2, 409, 'une seconde sortie sur un dossier déjà sorti doit être rejetée, pas un crash ni un faux succès');
      assert.equal(b2.success, false);
      assert.match(b2.message, /déjà été clôturé|déjà.*sortie/i);

      const relu = await Hospitalization.findById(hosp._id).lean();
      assert.equal(new Date(relu.date_sortie).getTime(), new Date(dateSortieOriginale).getTime(), 'date_sortie ne doit jamais être écrasée par une seconde tentative — elle doit rester celle du premier appel réel');
      assert.equal(relu.statut, 'sorti');
    });

    await t.test('discharge — deux appels concurrents (Promise.all, pas séquentiel) : un seul passe, l\'autre est rejeté (409)', async () => {
      const { hosp } = await makeHosp('concurrent');
      const req = () => ({ params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: {} });
      const [r1, r2] = await Promise.all([call(hospC.discharge, req()), call(hospC.discharge, req())]);
      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409], 'exactement un des deux appels concurrents doit réussir, l\'autre doit recevoir un conflit explicite, jamais les deux réussis');
    });

    await t.test('discharge — rejette avec un message distinct selon le statut déjà atteint (transfere/decede, pas seulement sorti)', async () => {
      const { hosp: hospTransfere } = await makeHosp('transfere');
      await Hospitalization.findByIdAndUpdate(hospTransfere._id, { statut: 'transfere' });
      const { status: sT, body: bT } = await call(hospC.discharge, { params: { id: hospTransfere._id.toString() }, user, ip: '127.0.0.1', body: {} });
      assert.equal(sT, 409);
      assert.match(bT.message, /transféré/i);

      const { hosp: hospDecede } = await makeHosp('decede');
      await Hospitalization.findByIdAndUpdate(hospDecede._id, { statut: 'decede' });
      const { status: sD, body: bD } = await call(hospC.discharge, { params: { id: hospDecede._id.toString() }, user, ip: '127.0.0.1', body: {} });
      assert.equal(sD, 409);
      assert.match(bD.message, /décédé/i);
    });

    await t.test('discharge — une tentative de réassignation du champ patient est bloquée (HOSP_BLOCKED_FIELDS réutilisé)', async () => {
      const { hosp, patient } = await makeHosp('reassign');
      const autrePatient = await Patient.create({ nom: `H119-autre-${stamp}`, prenom: 'Q', date_naissance: '1985-05-05', sexe: 'M' });
      created.patients.push(autrePatient);

      const { status, body } = await call(hospC.discharge, {
        params: { id: hosp._id.toString() }, user, ip: '127.0.0.1',
        body: { patient: autrePatient._id.toString(), etat_patient: 'gueri' },
      });
      assert.equal(status, 200, 'la sortie elle-même doit réussir — seul le champ patient doit être ignoré, pas toute la requête');
      assert.equal(body.hospitalization.patient?.toString?.() ?? body.hospitalization.patient, patient._id.toString(), 'le séjour ne doit jamais être réassigné à un autre patient via discharge()');

      const relu = await Hospitalization.findById(hosp._id).lean();
      assert.equal(relu.patient.toString(), patient._id.toString(), 'patient inchangé en base — HOSP_BLOCKED_FIELDS bloque bien ce champ ici aussi');
    });

    await t.test('discharge — dossier inexistant renvoie 404, pas un crash', async () => {
      const { status } = await call(hospC.discharge, { params: { id: new mongoose.Types.ObjectId().toString() }, user, ip: '127.0.0.1', body: {} });
      assert.equal(status, 404);
    });
  } finally {
    for (const h of created.hospitalisations) await Hospitalization.findByIdAndDelete(h._id);
    for (const r of created.rooms) await Room.findByIdAndDelete(r._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
