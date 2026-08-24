// AUDIT-FAIBLE-H5 — patients.controller.js::create étalait req.body avant
// ses surcharges de sécurité, laissant passer tout champ non prévu du
// schéma (ex. statut:'decede' sur un patient fraîchement créé) —
// incohérent avec update() (même fichier), qui filtre déjà req.body via
// PATIENT_BLOCKED_FIELDS. Aligné : create() réutilise désormais le même
// filtre. medecin_referent/anonymise* restent volontairement non filtrés
// (cohérent avec update(), qui ne les bloque pas non plus).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-FAIBLE-H5 — patients.controller.js::create ignore les champs bloqués, persiste les champs légitimes (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patientsC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [] };
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'H5', nom: 'Staff', role: 'receptionniste' };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('injection statut/actif/cree_par/token_activation/numero_dossier via le body → tous ignorés, valeurs système imposées', async () => {
      const fauxCreePar = new mongoose.Types.ObjectId();
      const { status, body } = await call(patientsC.create, {
        body: {
          nom: `H5${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'F',
          telephone: '060000000',
          // Tentative d'injection de champs bloqués :
          statut: 'decede',
          actif: true,
          cree_par: fauxCreePar,
          token_activation: 'faux-token',
          token_activation_expire: new Date('2099-01-01'),
          numero_dossier: 'FAUX-0001',
          ip_creation: '1.2.3.4',
        },
        user: staff, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      created.patients.push({ _id: body.patient._id });
      if (body.patient.email) created.users.push({ email: body.patient.email });

      const fresh = await Patient.findById(body.patient._id).lean();
      assert.equal(fresh.statut, 'actif', 'statut doit rester au défaut du schéma, jamais "decede" envoyé par le body');
      assert.equal(fresh.actif, false, 'actif doit rester false (inactif jusqu\'à activation), pas la valeur injectée');
      assert.equal(String(fresh.cree_par), String(staff._id), 'cree_par doit venir de req.user, pas du body');
      assert.notEqual(fresh.token_activation, 'faux-token', 'token_activation doit être le vrai token généré, pas celui du body');
      assert.notEqual(fresh.numero_dossier, 'FAUX-0001', 'numero_dossier doit être généré par le hook pre(save), jamais accepté du body');
      assert.equal(fresh.ip_creation, '127.0.0.1', 'ip_creation doit venir de req.ip, pas du body');
    });

    await t.test('non-régression — les champs légitimes du formulaire sont toujours persistés', async () => {
      const { status, body } = await call(patientsC.create, {
        body: {
          nom: `H5Legit${stamp}`, prenom: 'Legit', date_naissance: '1985-06-15', sexe: 'M',
          telephone: '061111111', email: `_h5-legit-${stamp}@_test.local`,
          nationalite: 'Congolaise', situation_mat: 'Marié(e)',
          adresse: { rue: 'Rue Test', ville: 'Souanké', pays: 'Congo', code_postal: '00000' },
          groupe_sanguin: 'O+', allergies: ['Pénicilline'], antecedents_medicaux: ['Hypertension'],
          antecedents_familiaux: ['Diabète'], maladies_chroniques: ['Asthme'],
          contact_urgence: { nom: 'Contact H5', relation: 'Conjoint', telephone: '062222222' },
          notes: 'Note de test H5',
        },
        user: staff, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      created.patients.push({ _id: body.patient._id });
      created.users.push({ email: body.patient.email });

      const fresh = await Patient.findById(body.patient._id).lean();
      assert.equal(fresh.nom, `H5Legit${stamp}`);
      assert.equal(fresh.telephone, '061111111');
      assert.equal(fresh.nationalite, 'Congolaise');
      assert.equal(fresh.situation_mat, 'Marié(e)');
      assert.equal(fresh.adresse.ville, 'Souanké');
      assert.equal(fresh.groupe_sanguin, 'O+');
      assert.deepEqual(fresh.allergies, ['Pénicilline']);
      assert.deepEqual(fresh.antecedents_medicaux, ['Hypertension']);
      assert.deepEqual(fresh.antecedents_familiaux, ['Diabète']);
      assert.deepEqual(fresh.maladies_chroniques, ['Asthme']);
      assert.equal(fresh.contact_urgence.nom, 'Contact H5');
      assert.equal(fresh.notes, 'Note de test H5');
    });
  } finally {
    for (const u of created.users) await User.deleteMany({ email: u.email });
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id).catch(() => {});
    await mongoose.disconnect();
  }
});
