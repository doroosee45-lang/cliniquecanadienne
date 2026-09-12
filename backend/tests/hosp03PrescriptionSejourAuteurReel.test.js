// HOSP-03 (correction du 12 sept. 2026, audit indépendant) — une
// prescription ajoutée en cours de séjour (POST /:id/prescriptions)
// n'enregistrait le médecin que sous forme de texte libre (`medecin`),
// fabriquable par le client, sans aucune référence vérifiable vers un
// compte réel — contrairement à ConstanteSchema.auteur, déjà capturé pour
// la sous-ressource voisine. Ce test prouve que `auteur` (ObjectId réel de
// l'utilisateur authentifié) est désormais réellement persisté, jamais
// déductible du seul texte libre envoyé par le client.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('HOSP-03 — prescriptions_sejour capture réellement auteur (compte authentifié), jamais seulement un texte libre fabriqué', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Hosp03-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1980-01-01' });
  const infirmier = await User.create({ email: `_hosp03-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Infirmier', prenom: 'Test', role: 'infirmier', statut: 'actif' });
  const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test HOSP-03' });

  try {
    const { status, body } = await call(hospC.addPrescriptionSejour, {
      params: { id: hosp._id.toString() },
      user: infirmier, ip: '127.0.0.1',
      body: { type: 'medicament', designation: 'Paracetamol', posologie: '1g x3/j', medecin: 'Dr Fabrique Par Le Client' },
    });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(String(body.prescription.auteur), String(infirmier._id), 'auteur doit être réellement le compte authentifié qui saisit, jamais fabriqué');

    const fresh = await Hospitalization.findById(hosp._id).lean();
    const prescriptionFraiche = fresh.prescriptions_sejour[fresh.prescriptions_sejour.length - 1];
    assert.equal(String(prescriptionFraiche.auteur), String(infirmier._id), 'persisté en base, pas seulement dans la réponse');
    // Le libellé texte libre (nom du médecin non connecté qui prescrit,
    // possiblement par téléphone) reste utilisable comme avant — non
    // supprimé, seulement complété par une identité réellement vérifiable.
    assert.equal(prescriptionFraiche.medecin, 'Dr Fabrique Par Le Client');
  } finally {
    await Hospitalization.findByIdAndDelete(hosp._id);
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(infirmier._id);
    await mongoose.disconnect();
  }
});
