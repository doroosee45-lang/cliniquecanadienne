// Correction 1 (relecture du 6 sept. 2026, FE-BUG-003) — le <select> "Mode
// de paiement" de Consultations.jsx n'avait ni value ni onChange : la
// sélection de l'utilisateur n'était jamais transmise au serveur, et le
// champ mode_paiement n'existait même pas dans le schéma Consultation
// (seule sa lecture, jamais son écriture, existait déjà dans le composant).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 1 — mode_paiement choisi dans le formulaire est réellement persisté', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
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
    const medecin = await User.create({ email: `_correction1-mp-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction1', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const patient = await Patient.create({ nom: `T-CORRECTION1-MP-${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });
    created.patients.push(patient._id);

    await t.test('mode_paiement="mobile" choisi → réellement persisté en base', async () => {
      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id.toString(), type_consultation: 'generale', motif: 'Test', statut: 'terminee', statut_paiement: 'paye', mode_paiement: 'mobile' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.consultations.push(body.consultation._id);

      const fresh = await Consultation.findById(body.consultation._id).lean();
      assert.equal(fresh.mode_paiement, 'mobile', 'le mode de paiement choisi par l\'utilisateur doit être exactement celui persisté en base');
    });

    await t.test('LIMITE — mode_paiement absent du payload → champ non défini, jamais une valeur inventée', async () => {
      const { status, body } = await call(consultC.create, {
        body: { patient: patient._id.toString(), type_consultation: 'generale', motif: 'Test 2', statut: 'terminee', statut_paiement: 'non_paye' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.consultations.push(body.consultation._id);
      const fresh = await Consultation.findById(body.consultation._id).lean();
      assert.equal(fresh.mode_paiement, undefined);
    });
  } finally {
    await Consultation.deleteMany({ _id: { $in: created.consultations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
