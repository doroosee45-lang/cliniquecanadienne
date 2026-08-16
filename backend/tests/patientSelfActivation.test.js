// R-08b — le patient définit lui-même son mot de passe via le lien
// d'activation, au lieu de recevoir un mot de passe temporaire en clair.
// Vérifie : create() ne génère plus de mot de passe, activate (GET) ne
// consomme plus le lien, setPasswordAndActivate applique la politique de
// complexité (R-16) et active réellement, et activateAdmin renvoie un
// nouveau lien plutôt qu'un mot de passe quand le compte n'en a aucun.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('activation patient avec mot de passe auto-défini (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patC = require('../controllers/patients.controller');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'receptionniste', prenom: 'Admin', nom: 'Test' };
  const cleanup = [];
  const originalSendActivationEmail = mailModule.sendActivationEmail;
  mailModule.sendActivationEmail = async () => ({ simulated: true });
  cleanup.push(() => { mailModule.sendActivationEmail = originalSendActivationEmail; });

  try {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('create() ne génère plus de mot de passe temporaire', async () => {
      const email = `_t08b-create-${stamp}@_test.local`;
      await patC.create({
        user: admin, ip: '127.0.0.1', headers: {},
        body: { nom: 'T08b', prenom: 'Create', date_naissance: '1990-01-01', sexe: 'M', email },
      }, res, () => {});
      assert.equal(status, 201);
      assert.equal(body.mot_de_passe_temp, undefined, 'mot_de_passe_temp ne doit plus exister dans la réponse');
      cleanup.push(() => Patient.findByIdAndDelete(body.patient._id));

      const user = await User.findOne({ email }).select('+password');
      cleanup.push(() => User.findByIdAndDelete(user._id));
      assert.equal(user.password, undefined, 'aucun mot de passe défini à la création');
    });

    await t.test('activate (GET) valide le lien sans le consommer', async () => {
      const email = `_t08b-getlink-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: 'T08b', prenom: 'GetLink', date_naissance: '1990-01-01', sexe: 'M', email, token_activation: 'tok-getlink-' + stamp, token_activation_expire: new Date(Date.now() + 3600000) });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      status = 200; body = null;
      await patC.activate({ params: { token: 'tok-getlink-' + stamp } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.prenom, 'GetLink');

      const fresh = await Patient.findById(patient._id);
      assert.equal(fresh.actif, false, 'ne doit pas activer sur un simple GET');
      assert.equal(fresh.token_activation, 'tok-getlink-' + stamp, 'le token ne doit pas être consommé par le GET');
    });

    await t.test('setPasswordAndActivate refuse un mot de passe sans majuscule/chiffre (R-16)', async () => {
      const email = `_t08b-weak-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: 'T08b', prenom: 'Weak', date_naissance: '1990-01-01', sexe: 'M', email, token_activation: 'tok-weak-' + stamp, token_activation_expire: new Date(Date.now() + 3600000) });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const user = await User.create({ email, nom: 'T08b', prenom: 'Weak', role: 'patient', statut: 'inactif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      status = 200; body = null;
      await patC.setPasswordAndActivate({ params: { token: 'tok-weak-' + stamp }, body: { password: 'toutminuscule' }, ip: '127.0.0.1' }, res, () => {});
      assert.equal(status, 400);

      const fresh = await Patient.findById(patient._id);
      assert.equal(fresh.actif, false, 'ne doit pas activer si le mot de passe est rejeté');
    });

    await t.test('setPasswordAndActivate active réellement avec un mot de passe conforme', async () => {
      const email = `_t08b-strong-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: 'T08b', prenom: 'Strong', date_naissance: '1990-01-01', sexe: 'M', email, token_activation: 'tok-strong-' + stamp, token_activation_expire: new Date(Date.now() + 3600000) });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const user = await User.create({ email, nom: 'T08b', prenom: 'Strong', role: 'patient', statut: 'inactif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      status = 200; body = null;
      await patC.setPasswordAndActivate({ params: { token: 'tok-strong-' + stamp }, body: { password: 'Abcdef12' }, ip: '127.0.0.1' }, res, () => {});
      assert.equal(status, 200);

      const freshPatient = await Patient.findById(patient._id);
      assert.equal(freshPatient.actif, true);
      assert.equal(freshPatient.token_activation, undefined, 'le token doit être consommé après activation réussie');

      const freshUser = await User.findById(user._id).select('+password');
      assert.equal(freshUser.statut, 'actif');
      assert.ok(await freshUser.matchPassword('Abcdef12'), 'le mot de passe choisi doit être utilisable pour se connecter');
    });

    await t.test('activateAdmin renvoie un nouveau lien si le compte n\'a pas de mot de passe', async () => {
      const email = `_t08b-adminnopw-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: 'T08b', prenom: 'AdminNoPw', date_naissance: '1990-01-01', sexe: 'M', email });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const user = await User.create({ email, nom: 'T08b', prenom: 'AdminNoPw', role: 'patient', statut: 'inactif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      status = 200; body = null;
      await patC.activateAdmin({ params: { id: patient._id }, user: admin, ip: '127.0.0.1' }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.lien_renvoye, true);

      const freshPatient = await Patient.findById(patient._id);
      assert.equal(freshPatient.actif, true, 'le dossier est actif immédiatement');
      assert.ok(freshPatient.token_activation, 'un nouveau token doit avoir été généré');

      const freshUser = await User.findById(user._id);
      assert.equal(freshUser.statut, 'actif');
    });

    await t.test('activateAdmin ne renvoie pas de lien si le compte a déjà un mot de passe', async () => {
      const email = `_t08b-adminhaspw-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: 'T08b', prenom: 'AdminHasPw', date_naissance: '1990-01-01', sexe: 'M', email });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const user = await User.create({ email, password: 'Abcdef12', nom: 'T08b', prenom: 'AdminHasPw', role: 'patient', statut: 'inactif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      status = 200; body = null;
      await patC.activateAdmin({ params: { id: patient._id }, user: admin, ip: '127.0.0.1' }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.lien_renvoye, false);

      const freshPatient = await Patient.findById(patient._id);
      assert.equal(freshPatient.actif, true);
      assert.equal(freshPatient.token_activation, undefined, 'pas de nouveau token quand un mot de passe existe déjà');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
