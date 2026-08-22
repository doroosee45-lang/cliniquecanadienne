// AUDIT-ECHOGRAPHIE-PATIENT — la modale "Nouvelle demande d'échographie"
// capturait le patient en texte libre, sans jamais renseigner patient_ref
// (ObjectId → Patient) pourtant présent sur le schéma. Résultat : les liens
// "cliquer le nom → ouvrir le dossier" déjà présents côté frontend
// (conditionnés sur d.patient_ref?._id) étaient morts pour toute demande
// créée via ce formulaire. Corrigé par un sélecteur patient réel (même
// pattern que Pédiatrie/Maternité) envoyant un vrai patient_ref à la
// création — ce test vérifie que create() persiste bien la référence et
// que getAll() la peuple correctement, base réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('echographieController.create — patient_ref réel persisté et peuplé (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Echographie = require('../models/Echographie');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const agent = await User.create({ email: `_echo-agent-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'Echo', role: 'radiologue', statut: 'actif' });
  const patient = await Patient.create({ nom: `EchoDeriv${stamp}`, prenom: 'Test', date_naissance: '1990-06-15', sexe: 'F', telephone: '+242060000002' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [
    () => User.findByIdAndDelete(agent._id),
    () => Patient.findByIdAndDelete(patient._id),
  ];

  try {
    let demandeId;

    await t.test('create — patient_ref envoyé par le sélecteur est réellement persisté', async () => {
      const { status, body } = await call(echoC.create, {
        user: agent, ip: '127.0.0.1',
        body: {
          patient: `${patient.prenom} ${patient.nom}`,
          patient_ref: patient._id.toString(),
          dossier: 'DOS-TEST-0001',
          age: 35, sexe: 'F',
          source: 'Maternité', medecin_presc: 'Dr. Test',
          date_prescription: new Date().toISOString().split('T')[0],
          type: 'Abdominale', sous_type: 'Foie',
          motif: 'Contrôle', priorite: 'normale',
          statut: 'en_attente',
        },
      });
      assert.equal(status, 201);
      demandeId = body.demande._id;
      cleanup.push(() => Echographie.findByIdAndDelete(demandeId));

      const relu = await Echographie.findById(demandeId).lean();
      assert.equal(relu.patient_ref?.toString(), patient._id.toString(), 'patient_ref doit être réellement persisté en base');
    });

    await t.test('getAll — patient_ref est peuplé (nom/prenom/numero_dossier), rendant fonctionnel le lien vers le dossier', async () => {
      const { status, body } = await call(echoC.getAll, { query: {} });
      assert.equal(status, 200);
      const found = body.demandes.find(d => d._id.toString() === demandeId.toString());
      assert.ok(found, 'la demande créée doit apparaître dans getAll');
      assert.ok(found.patient_ref, 'patient_ref doit être peuplé, pas null');
      assert.equal(found.patient_ref.nom, patient.nom);
      assert.equal(found.patient_ref.numero_dossier, patient.numero_dossier);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
