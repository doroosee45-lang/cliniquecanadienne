// Ticket 0002 (D2) — un dossier Patient créé via Google OAuth (T3.1) porte
// profil_a_completer:true et n'a ni date_naissance ni sexe. Le backend
// exposait déjà ce champ mais rien ne permettait au patient de le renseigner
// (portal.controller.js::updateProfile n'acceptait ni date_naissance ni
// sexe) ni de faire repasser le flag à false une fois complété. Corrigé :
// ces deux champs ne sont acceptés QUE tant que profil_a_completer est vrai
// (jamais en usage général, pour ne pas ouvrir un canal de modification
// libre de l'identité administrative d'un patient déjà admis normalement) ;
// une fois les deux renseignés, le flag repasse à false.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Ticket 0002 (D2) — complétion de profil via le portail (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const created = { users: [], patients: [] };

  const call = async (user, body) => {
    let status = 200, resBody = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { resBody = d; } };
    await portalC.updateProfile({ user, body, ip: '127.0.0.1' }, res, (err) => { if (err) throw err; });
    return { status, body: resBody };
  };

  try {
    await t.test('profil_a_completer:true — renseigner date_naissance+sexe fait repasser le flag à false', async () => {
      const patient = await Patient.create({
        nom: `T-D2-${stamp}`, prenom: 'P', profil_a_completer: true,
        email: `t-d2-${stamp}@medisync.test`,
      });
      created.patients.push(patient._id);
      const user = await User.create({
        email: `t-d2-${stamp}@medisync.test`, password: 'Xx1aaaaa',
        nom: 'T-D2', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id,
      });
      created.users.push(user._id);

      // Un seul des deux renseigné — le flag doit rester vrai.
      const partial = await call(user, { date_naissance: '1990-05-12' });
      assert.equal(partial.status, 200);
      assert.equal(partial.body.patient.profil_a_completer, true, 'toujours à compléter tant que sexe manque');

      // Le second renseigné — le flag doit repasser à false.
      const complet = await call(user, { sexe: 'F' });
      assert.equal(complet.status, 200);
      assert.equal(complet.body.patient.profil_a_completer, false);
      assert.equal(complet.body.patient.sexe, 'F');
      assert.equal(new Date(complet.body.patient.date_naissance).getFullYear(), 1990, 'date_naissance du premier appel doit être conservée');
    });

    await t.test('profil_a_completer:false — date_naissance/sexe ignorés même si envoyés (pas de canal de modification libre)', async () => {
      const patient = await Patient.create({
        nom: `T-D2B-${stamp}`, prenom: 'P', date_naissance: '1985-01-01', sexe: 'M',
        profil_a_completer: false, email: `t-d2b-${stamp}@medisync.test`,
      });
      created.patients.push(patient._id);
      const user = await User.create({
        email: `t-d2b-${stamp}@medisync.test`, password: 'Xx1aaaaa',
        nom: 'T-D2B', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id,
      });
      created.users.push(user._id);

      const { status, body } = await call(user, { date_naissance: '2000-01-01', sexe: 'F' });
      assert.equal(status, 200);
      assert.equal(new Date(body.patient.date_naissance).getFullYear(), 1985, 'date_naissance ne doit pas être modifiable en usage normal');
      assert.equal(body.patient.sexe, 'M', 'sexe ne doit pas être modifiable en usage normal');
    });
  } finally {
    for (const id of created.users) await User.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
