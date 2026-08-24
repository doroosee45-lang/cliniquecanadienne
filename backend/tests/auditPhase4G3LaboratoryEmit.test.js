// AUDIT-PHASE4-G3 — laboratory.controller.js::validate ne déclenchait ni
// emitActivity ni emitDashboardUpdate, malgré les deux disponibles dans ce
// fichier (déjà utilisés par create()) : un résultat critique validé ne se
// propageait à aucune vue temps réel côté personnel (seule une notification
// ciblée au médecin prescripteur existait, sur est_critique). Corrigé en
// réutilisant emitActivity/emitDashboardUpdate, avec icône/libellé
// distincts si est_critique. prelever/saisirResultats/acquit restent
// volontairement hors périmètre — non classées "gap important" par l'audit
// Phase 4 (seule validate() y figurait).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-PHASE4-G3 — laboratory.controller.js::validate émet activity:new/dashboard:refresh (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const LabResult = require('../models/LabResult');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Notification = require('../models/Notification');
  const { setIO } = require('../utils/socket');
  const labC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], labs: [] };
  const emitted = [];
  const fakeIo = {
    emit: (event, payload) => emitted.push({ event, payload }),
    to: (room) => ({ emit: (event, payload) => emitted.push({ event, payload, room }) }),
  };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const eventsOf = (name) => emitted.filter(e => e.event === name);

  try {
    setIO(fakeIo);

    const patient = await Patient.create({ nom: `G3${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient);
    const prescripteur = await User.create({ email: `_g3-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'G3', prenom: 'Med', role: 'medecin', statut: 'actif' });
    created.users.push(prescripteur);
    const laborantin = { _id: new mongoose.Types.ObjectId(), prenom: 'G3', nom: 'Labo', role: 'laborantin' };

    await t.test('validate() — résultat NON critique → activity:new (icône neutre) + dashboard:refresh, pas de notification', async () => {
      const lab = await LabResult.create({ patient: patient._id, medecin_prescripteur: prescripteur._id, numero: `LAB-G3-${stamp}-1`, statut: 'termine' });
      created.labs.push(lab);
      emitted.length = 0;

      const { status } = await call(labC.validate, { params: { id: lab._id.toString() }, body: { resultats: 'RAS', est_critique: false }, user: laborantin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(eventsOf('activity:new').length, 1);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
      const payload = eventsOf('activity:new')[0].payload;
      assert.equal(payload.action, 'Résultat de laboratoire validé');
      assert.equal(payload.icon, '✅');

      const notif = await Notification.findOne({ destinataire: prescripteur._id, titre: { $regex: /Résultat critique/ } });
      assert.equal(notif, null, 'pas de notification patient/médecin pour un résultat non critique');
    });

    await t.test('validate() — résultat CRITIQUE → activity:new (icône 🚨) + dashboard:refresh + notification médecin conservée', async () => {
      const lab = await LabResult.create({ patient: patient._id, medecin_prescripteur: prescripteur._id, numero: `LAB-G3-${stamp}-2`, statut: 'termine' });
      created.labs.push(lab);
      emitted.length = 0;

      const { status } = await call(labC.validate, { params: { id: lab._id.toString() }, body: { resultats: 'Anomalie', est_critique: true, valeurs_critiques: 'Potassium 7.2' }, user: laborantin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(eventsOf('activity:new').length, 1);
      assert.equal(eventsOf('dashboard:refresh').length, 1);
      const payload = eventsOf('activity:new')[0].payload;
      assert.equal(payload.action, 'Résultat critique validé');
      assert.equal(payload.icon, '🚨');

      const notif = await Notification.findOne({ destinataire: prescripteur._id, titre: { $regex: /Résultat critique/ } });
      assert.ok(notif, 'la notification ciblée au médecin prescripteur (préexistante) doit rester fonctionnelle, non-régression');
      await Notification.deleteMany({ destinataire: prescripteur._id });
    });

    await t.test('non-régression — prelever()/saisirResultats()/acquit() restent sans émission (hors périmètre de ce point)', async () => {
      const lab = await LabResult.create({ patient: patient._id, medecin_prescripteur: prescripteur._id, numero: `LAB-G3-${stamp}-3`, statut: 'prescrit' });
      created.labs.push(lab);
      emitted.length = 0;

      await call(labC.prelever, { params: { id: lab._id.toString() }, body: { type_echantillon: 'Sang', preleveur: 'G3 Labo' }, user: laborantin, ip: '127.0.0.1' });
      await call(labC.saisirResultats, { params: { id: lab._id.toString() }, body: { resultats: 'RAS' }, user: laborantin, ip: '127.0.0.1' });
      await call(labC.acquit, { params: { id: lab._id.toString() }, user: prescripteur, ip: '127.0.0.1' });

      assert.equal(emitted.length, 0, 'prelever/saisirResultats/acquit ne doivent toujours rien émettre (non modifiés par ce point)');
    });
  } finally {
    setIO(null);
    for (const l of created.labs) await LabResult.findByIdAndDelete(l._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
