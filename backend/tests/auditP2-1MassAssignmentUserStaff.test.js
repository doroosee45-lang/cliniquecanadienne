// AUDIT-P2-1 (groupe 1/2) — settings.controller.js::updateUser et
// hr.controller.js::update transmettaient req.body quasi tel quel à
// findByIdAndUpdate, sans liste blanche ni runValidators. Ce test prouve :
// (a) les champs légitimes du formulaire réel continuent de fonctionner,
// (b) un champ hors liste blanche (sensible : role/statut de compte pour
// User, salaire pour Staff) envoyé dans le même appel n'est jamais persisté,
// (c) runValidators rejette désormais une valeur enum invalide qui aurait
// été silencieusement acceptée auparavant.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P2-1 — mass-assignment bloqué sur User.updateUser et Staff.update (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const settingsC = require('../controllers/settings.controller');
  const hrC = require('../controllers/hr.controller');
  const User = require('../models/User');
  const Staff = require('../models/Staff');
  const Service = require('../models/Service');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  // AUDIT-M-A1 — User.service est désormais une vraie référence ObjectId.
  const svcChirurgie = await Service.create({ nom: `Chirurgie ${stamp}` });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];

  try {
    // ── User ──────────────────────────────────────────────────
    let userId;
    await t.test('updateUser — champs légitimes (prenom/nom/email/telephone/role/service/statut) persistent toujours', async () => {
      const user = await User.create({ email: `_p21-user-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Avant', prenom: 'Avant', role: 'infirmier', statut: 'actif' });
      userId = user._id;
      cleanup.push(() => User.findByIdAndDelete(userId));

      const { status, body } = await call(settingsC.updateUser, {
        params: { id: userId },
        body: { prenom: 'Après', nom: 'Modifié', email: user.email, telephone: '+242060000000', role: 'medecin', service: svcChirurgie._id.toString(), statut: 'inactif' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.user.role, 'medecin', 'un changement de rôle légitime doit toujours fonctionner');

      const fresh = await User.findById(userId).lean();
      assert.equal(fresh.prenom, 'Après');
      assert.equal(fresh.role, 'medecin');
      assert.equal(fresh.statut, 'inactif');
      assert.equal(fresh.service.toString(), svcChirurgie._id.toString());
    });

    await t.test('updateUser — un champ hors liste blanche envoyé dans le même appel n\'est jamais persisté', async () => {
      const avant = await User.findById(userId).lean();
      assert.equal(avant.must_change_password, false);
      assert.equal(avant.tentatives_echouees, 0);
      assert.equal(avant.patient_id, null);

      const { status } = await call(settingsC.updateUser, {
        params: { id: userId },
        body: {
          prenom: 'Après', nom: 'Modifié', email: avant.email, telephone: '+242060000000', role: 'medecin', service: svcChirurgie._id.toString(), statut: 'inactif',
          // must_change_password (AUDIT-P2-3, ticket 0003 piste 2) est
          // volontairement dans la liste blanche depuis ce correctif — testé
          // séparément dans auditP2-3MustChangePasswordRH.test.js. Les
          // autres restent hors liste blanche et ne doivent avoir aucun effet.
          must_change_password: true,
          tentatives_echouees: 999,
          patient_id: new mongoose.Types.ObjectId(),
          verrouille_jusqu_a: new Date(Date.now() + 86400000),
          reset_password_token: 'devrait-etre-ignore',
        },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await User.findById(userId).lean();
      assert.equal(fresh.must_change_password, true, 'must_change_password est désormais un champ légitime de cet endpoint (AUDIT-P2-3)');
      assert.equal(fresh.tentatives_echouees, 0, 'tentatives_echouees ne doit pas être modifiable via cet endpoint');
      assert.equal(fresh.patient_id, null, 'patient_id ne doit pas être modifiable via cet endpoint');
      assert.equal(fresh.verrouille_jusqu_a, null, 'verrouille_jusqu_a ne doit pas être modifiable via cet endpoint');
      assert.equal(fresh.reset_password_token, undefined, 'reset_password_token ne doit pas être modifiable via cet endpoint');
    });

    await t.test('updateUser — runValidators rejette désormais un rôle invalide (silencieusement accepté avant ce correctif)', async () => {
      let caught = null;
      try {
        await call(settingsC.updateUser, {
          params: { id: userId },
          body: { prenom: 'X', nom: 'Y', email: `_p21-invalid-${stamp}@_test.local`, telephone: '', role: 'role-qui-n-existe-pas', service: '', statut: 'actif' },
          user: superadmin, ip: '127.0.0.1',
        });
      } catch (err) { caught = err; }
      assert.ok(caught, 'un rôle hors enum doit être rejeté');
      assert.equal(caught.name, 'ValidationError');

      const fresh = await User.findById(userId).lean();
      assert.equal(fresh.role, 'medecin', 'le rôle précédent doit rester inchangé après un rejet de validation');
    });

    // ── Staff ─────────────────────────────────────────────────
    let staffId, serviceId;
    await t.test('hr.update — champs légitimes (statut/poste/service, seul usage réel actuel) persistent toujours', async () => {
      const Service = require('../models/Service');
      const svc = await Service.create({ nom: `_p21-service-${stamp}` });
      serviceId = svc._id;
      cleanup.push(() => Service.findByIdAndDelete(serviceId));

      const staff = await Staff.create({ prenom: 'Avant', nom: 'Staff', poste: 'infirmier', statut: 'actif', salaire_base: 250000 });
      staffId = staff._id;
      cleanup.push(() => Staff.findByIdAndDelete(staffId));

      const { status } = await call(hrC.update, {
        params: { id: staffId },
        body: { statut: 'conge', poste: 'infirmier_chef', service: serviceId.toString() },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await Staff.findById(staffId).lean();
      assert.equal(fresh.statut, 'conge');
      assert.equal(fresh.poste, 'infirmier_chef');
      assert.equal(fresh.service.toString(), serviceId.toString());
    });

    await t.test('hr.update — salaire_base et matricule ne sont jamais modifiables via cet endpoint générique', async () => {
      const avant = await Staff.findById(staffId).lean();
      assert.equal(avant.salaire_base, 250000);
      const matriculeAvant = avant.matricule;

      const { status } = await call(hrC.update, {
        params: { id: staffId },
        body: { statut: 'actif', salaire_base: 9999999, matricule: 'STAF-HACK' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await Staff.findById(staffId).lean();
      assert.equal(fresh.salaire_base, 250000, 'salaire_base ne doit pas être modifiable via cet endpoint générique');
      assert.equal(fresh.matricule, matriculeAvant, 'matricule ne doit pas être modifiable via cet endpoint générique');
    });

    await t.test('hr.update — runValidators rejette désormais un type_contrat invalide', async () => {
      let caught = null;
      try {
        await call(hrC.update, {
          params: { id: staffId },
          body: { type_contrat: 'contrat-qui-n-existe-pas' },
          user: superadmin, ip: '127.0.0.1',
        });
      } catch (err) { caught = err; }
      assert.ok(caught, 'un type_contrat hors enum doit être rejeté');
      assert.equal(caught.name, 'ValidationError');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Service.findByIdAndDelete(svcChirurgie._id);
    await mongoose.disconnect();
  }
});
