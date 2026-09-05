// Correction 6 (relecture du 6 sept. 2026, FE-BUG-008) — le sélecteur
// "Médecin consultant" (Consultations.jsx) était peuplé par 5 noms
// fictifs codés en dur, jamais liés à un vrai User ; create() attribuait
// de toute façon systématiquement la consultation à req.user._id, ce qui
// est faux dès qu'un infirmier (autorisé à créer une consultation, cf.
// routes) la crée pour le compte d'un vrai médecin.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 6 — une consultation créée référence un vrai User médecin, jamais un nom fictif ni l\'auteur par défaut quand un vrai médecin est choisi', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const consultC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], consultations: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecinReel = await User.create({ email: `_correction6-medecin-reel-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Diallo', prenom: 'Fatou', role: 'medecin', statut: 'actif', specialite: 'Cardiologie' });
    created.users.push(medecinReel._id);
    const infirmier = await User.create({ email: `_correction6-infirmier-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Infirmier', prenom: 'Correction6', role: 'infirmier', statut: 'actif' });
    created.users.push(infirmier._id);
    const patient = await Patient.create({ nom: `T-CORRECTION6-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient._id);

    await t.test('getMedecins() expose le vrai catalogue User (role medecin, actif), jamais une liste fictive', async () => {
      const { status, body } = await call(consultC.getMedecins, {});
      assert.equal(status, 200);
      const trouve = body.medecins.find(m => String(m._id) === String(medecinReel._id));
      assert.ok(trouve, 'le médecin réel créé pour ce test doit apparaître dans le catalogue');
      assert.equal(trouve.nom, 'Diallo');
      assert.equal(trouve.specialite, 'Cardiologie');
    });

    await t.test('un infirmier créant la consultation avec un médecin réel choisi → attribuée à ce médecin, jamais à l\'infirmier', async () => {
      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id.toString(), medecin: medecinReel._id.toString(), type_consultation: 'generale', motif: 'Test Correction6', statut: 'terminee' },
        user: infirmier, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.consultations.push(body.consultation._id);

      const fresh = await Consultation.findById(body.consultation._id).lean();
      assert.equal(String(fresh.medecin), String(medecinReel._id), 'la consultation doit référencer le vrai médecin choisi, jamais l\'infirmier qui l\'a créée');
      assert.notEqual(String(fresh.medecin), String(infirmier._id));
    });

    await t.test('LIMITE — sans médecin choisi (ou valeur invalide), repli honnête sur req.user._id (comportement préexistant préservé)', async () => {
      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id.toString(), type_consultation: 'generale', motif: 'Test Correction6 sans médecin', statut: 'terminee' },
        user: medecinReel, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.consultations.push(body.consultation._id);
      const fresh = await Consultation.findById(body.consultation._id).lean();
      assert.equal(String(fresh.medecin), String(medecinReel._id), 'sans sélection, la consultation reste attribuée à l\'auteur connecté — jamais une valeur inventée');
    });
  } finally {
    await Consultation.deleteMany({ _id: { $in: created.consultations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
