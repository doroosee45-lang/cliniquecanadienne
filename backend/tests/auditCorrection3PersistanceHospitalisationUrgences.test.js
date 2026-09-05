// Correction 3 (relecture du 6 sept. 2026, FE-BUG-005) — "Valider
// traitement"/"Saisir résultat examen" (Hospitalization.jsx) et "Saisir
// résultat" (Urgences.jsx) ne mettaient à jour que l'état local
// (React/Redux) : perdu au rechargement, et côté Urgences systématiquement
// écrasé par le polling temps réel (30s) qui recharge depuis le serveur.
// Aucune route ne recevait jamais ces mises à jour ; elles ont été créées.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 3 — validations/résultats sont réellement persistés en base (Hospitalization + Urgences)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const Urgence = require('../models/Urgence');
  const hospC = require('../controllers/hospitalization.controller');
  const urgC = require('../controllers/urgencesController');

  const stamp = Date.now();
  const created = { patients: [], users: [], hosps: [], urgs: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction3-persist-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction3', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const patient = await Patient.create({ nom: `T-CORRECTION3-PERSIST-${stamp}`, prenom: 'P', date_naissance: '1975-01-01', sexe: 'M' });
    created.patients.push(patient._id);

    await t.test('Hospitalization — updateTraitement persiste réellement le statut "administre"', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test Correction3', traitements: [{ medicament: 'Test Med', dose: '1cp', statut: 'planifie' }] });
      created.hosps.push(hosp._id);
      const traitementId = hosp.traitements[0]._id.toString();

      const { status, body } = await call(hospC.updateTraitement, {
        params: { id: hosp._id.toString(), sid: traitementId }, body: { statut: 'administre' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.traitement.statut, 'administre');

      // Relecture indépendante — simule "après rechargement de la page".
      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.traitements[0].statut, 'administre', 'la validation doit survivre à une relecture fraîche depuis la base');
    });

    await t.test('Hospitalization — updateExamen persiste réellement le résultat saisi', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test Correction3', examens: [{ type: 'labo', designation: 'NFS', statut: 'attente' }] });
      created.hosps.push(hosp._id);
      const examenId = hosp.examens[0]._id.toString();

      const { status, body } = await call(hospC.updateExamen, {
        params: { id: hosp._id.toString(), sid: examenId }, body: { resultat: 'Hb 13.2 g/dL — normal', statut: 'resultat' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.examens[0].resultat, 'Hb 13.2 g/dL — normal', 'le résultat saisi doit survivre à une relecture fraîche depuis la base');
      assert.equal(fresh.examens[0].statut, 'resultat');
    });

    await t.test('Urgences — updateExamen persiste réellement le résultat, résiste à un rechargement simulé (getOne)', async () => {
      const { body: bCreate } = await call(urgC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Test Correction3 Urg', motif: 'Test', niveau_triage: 'orange' },
        user: medecin, ip: '127.0.0.1',
      });
      const urgenceId = bCreate.urgence._id;
      created.urgs.push(urgenceId);

      const { body: bExamen } = await call(urgC.addExamen, {
        params: { id: urgenceId }, body: { type: 'labo', designation: 'Glycémie' }, user: medecin, ip: '127.0.0.1',
      });
      const examenId = bExamen.examen._id.toString();

      const { status, body } = await call(urgC.updateExamen, {
        params: { id: urgenceId, sid: examenId }, body: { resultat: '5.2 mmol/L', statut: 'resultat' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));

      // Simule ce que ferait le polling temps réel (30s) : recharge complète
      // du dossier depuis le serveur — le résultat ne doit jamais disparaître.
      const { body: bReload } = await call(urgC.getOne, { params: { id: urgenceId } });
      const examenRelu = bReload.urgence.examens.find(e => String(e._id) === examenId);
      assert.equal(examenRelu.resultat, '5.2 mmol/L', 'le résultat doit survivre à un rechargement simulant le polling temps réel');
      assert.equal(examenRelu.statut, 'resultat');
    });
  } finally {
    await Hospitalization.deleteMany({ _id: { $in: created.hosps } });
    await Urgence.deleteMany({ _id: { $in: created.urgs } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
