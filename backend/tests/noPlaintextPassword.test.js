// T3.3, réécrit — R-08b (Phase 7) a supprimé mot_de_passe_temp de la
// réponse de création de patient dans tous les cas : le patient définit
// désormais lui-même son mot de passe via le lien d'activation, il n'y a
// plus de mot de passe généré côté serveur à transmettre, ni par email ni
// dans la réponse JSON. L'ancienne version de ce test vérifiait le
// comportement inverse (mot_de_passe_temp attendu quand l'email échoue) —
// obsolète depuis R-08b, remplacé ici pour vérifier explicitement
// l'absence de tout mot de passe en clair, dans les deux cas (email envoyé
// ou non), plutôt que de compter sur l'absence de régression future.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('aucun mot de passe en clair dans la réponse de création de patient (T3.3)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patientsController = require('../controllers/patients.controller');

  const stamp = Date.now();
  // Domaine _test.local : échoue systématiquement l'envoi SMTP réel (voir
  // le reste de la suite) — exerce naturellement la branche email_envoye:false,
  // celle où un mot de passe temporaire aurait historiquement été exposé.
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
    assert.equal(response.email_envoye, false, 'ce domaine de test doit faire échouer l\'envoi SMTP — sinon ce test ne couvre pas la branche visée');

    // Aucun champ contenant un mot de passe en clair, sous quelque nom que
    // ce soit — pas seulement l'ancien mot_de_passe_temp.
    assert.equal(response.mot_de_passe_temp, undefined, 'mot_de_passe_temp ne doit plus jamais apparaître (R-08b)');
    const suspectKeys = Object.keys(response).filter(k => /pass|mdp|motdepasse/i.test(k));
    assert.deepEqual(suspectKeys, [], `aucune clé liée à un mot de passe ne doit apparaître dans la réponse : ${suspectKeys.join(', ')}`);

    // Le compte créé ne doit avoir aucun mot de passe défini non plus — le
    // patient le définit lui-même via le lien d'activation.
    const user = await User.findOne({ email }).select('+password');
    assert.ok(user, 'le compte User lié doit exister');
    assert.equal(user.password, undefined, 'aucun mot de passe ne doit être défini à la création (R-08b)');
  } finally {
    await Patient.findByIdAndDelete(response?.patient?._id);
    await User.deleteOne({ email });
    await mongoose.disconnect();
  }
});
