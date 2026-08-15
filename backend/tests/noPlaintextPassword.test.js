// T3.3 — mot_de_passe_temp ne doit apparaître dans la réponse de création
// de patient QUE si l'envoi d'email a échoué (email_envoye:false). Déjà
// corrigé dans une phase antérieure (patients.controller.js) — ce test
// n'y touche pas, il vérifie/documente le comportement réellement en place,
// pour les deux branches possibles selon que l'envoi SMTP réussit ou non.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('mot_de_passe_temp n\'est exposé que si l\'email d\'activation a échoué (T3.3)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patientsController = require('../controllers/patients.controller');

  const stamp = Date.now();
  const email = `_t33-password-${stamp}@_test.local`;
  const req = {
    body: { nom: `Test${stamp}`, prenom: 'T33', date_naissance: '1990-01-01', sexe: 'F', email },
    user: { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' },
    ip: '127.0.0.1',
    headers: {},
  };
  let response = null, thrown = null;
  const res = { status: () => res, json: (d) => { response = d; } };
  await patientsController.create(req, res, (err) => { thrown = err; });
  if (thrown) throw thrown;

  try {
    assert.ok(response?.patient, `la création doit réussir : ${JSON.stringify(response)}`);
    assert.ok('email_envoye' in response, 'la réponse doit indiquer si l\'email est parti');

    if (response.email_envoye) {
      assert.equal(response.mot_de_passe_temp, undefined,
        'email envoyé avec succès → le mot de passe ne doit PAS apparaître dans la réponse JSON');
    } else {
      assert.ok(response.mot_de_passe_temp,
        'email non envoyé → le mot de passe doit être présent (seul repli prévu, pour affichage en bannière à usage unique)');
    }
  } finally {
    await Patient.findByIdAndDelete(response?.patient?._id);
    await User.deleteOne({ email });
    await mongoose.disconnect();
  }
});
