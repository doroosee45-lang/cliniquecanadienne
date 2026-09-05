// Correction 11 (relecture du 6 sept. 2026, FLOW-001) — aucune référence
// croisée n'existait entre un dossier chirurgical (DossierChirurgical) et
// une hospitalisation (Hospitalization) pour le même patient : deux
// dossiers cloisonnés alors qu'ils peuvent décrire le même épisode de soins
// (ex. patient hospitalisé qui nécessite en cours de séjour une chirurgie).
//
// Correctif : champ optionnel DossierChirurgical.hospitalisation_id (ref
// Hospitalization), renseigné uniquement quand chirurgieController.js::
// createDossier reçoit réellement un hospitalisation_id valide — vérifié
// (existe, appartient au même patient, statut 'en_cours') avant persistance,
// jamais accepté à l'aveugle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 11 (FLOW-001) — lien réel Hospitalisation <-> Chirurgie', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const chirC = require('../controllers/chirurgieController');

  const stamp = Date.now();
  const created = { patients: [], users: [], hospitalisations: [], dossiers: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction11-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction11', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    await t.test('hospitalisation en_cours réelle -> dossier chirurgical créé avec le lien réellement persisté', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION11-1-${stamp}`, prenom: 'P', date_naissance: '1975-03-03', sexe: 'M' });
      created.patients.push(patient._id);

      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test Correction11', statut: 'en_cours' });
      created.hospitalisations.push(hosp._id);

      const { status, body } = await call(chirC.createDossier, {
        body: { patient: patient._id.toString(), chirurgien_id: medecin._id.toString(), motif_consultation: 'Test', diagnostic_chirurgical: 'Test', hospitalisation_id: hosp._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.dossiers.push(body.dossier._id);

      const fresh = await DossierChirurgical.findById(body.dossier._id).lean();
      assert.ok(fresh.hospitalisation_id, 'la référence croisée doit être réellement persistée en base, pas seulement dans la réponse HTTP');
      assert.equal(String(fresh.hospitalisation_id), String(hosp._id));
    });

    await t.test('aucun hospitalisation_id fourni -> champ absent, jamais une valeur inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION11-2-${stamp}`, prenom: 'P', date_naissance: '1980-04-04', sexe: 'F' });
      created.patients.push(patient._id);

      const { status, body } = await call(chirC.createDossier, {
        body: { patient: patient._id.toString(), motif_consultation: 'Test 2', diagnostic_chirurgical: 'Test 2' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.dossiers.push(body.dossier._id);

      const fresh = await DossierChirurgical.findById(body.dossier._id).lean();
      assert.equal(fresh.hospitalisation_id, undefined);
    });

    await t.test('LIMITE — hospitalisation_id référant un AUTRE patient -> rejeté (400), jamais lié silencieusement', async () => {
      const patientA = await Patient.create({ nom: `T-CORRECTION11-3A-${stamp}`, prenom: 'P', date_naissance: '1970-05-05', sexe: 'M' });
      const patientB = await Patient.create({ nom: `T-CORRECTION11-3B-${stamp}`, prenom: 'P', date_naissance: '1970-06-06', sexe: 'F' });
      created.patients.push(patientA._id, patientB._id);

      const hospA = await Hospitalization.create({ patient: patientA._id, motif_entree: 'Test Correction11 A', statut: 'en_cours' });
      created.hospitalisations.push(hospA._id);

      const { status, body } = await call(chirC.createDossier, {
        body: { patient: patientB._id.toString(), motif_consultation: 'Test 3', diagnostic_chirurgical: 'Test 3', hospitalisation_id: hospA._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(body.success, false);
      const count = await DossierChirurgical.countDocuments({ patient: patientB._id });
      assert.equal(count, 0, 'aucun dossier ne doit être créé si le lien fourni est invalide');
    });

    await t.test('LIMITE — hospitalisation déjà terminée (sorti) -> rejetée, jamais liée à un séjour clos', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION11-4-${stamp}`, prenom: 'P', date_naissance: '1985-07-07', sexe: 'M' });
      created.patients.push(patient._id);

      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test Correction11 sorti', statut: 'sorti', date_sortie: new Date() });
      created.hospitalisations.push(hosp._id);

      const { status, body } = await call(chirC.createDossier, {
        body: { patient: patient._id.toString(), motif_consultation: 'Test 4', diagnostic_chirurgical: 'Test 4', hospitalisation_id: hosp._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 400, JSON.stringify(body));
    });
  } finally {
    await DossierChirurgical.deleteMany({ _id: { $in: created.dossiers } });
    await Hospitalization.deleteMany({ _id: { $in: created.hospitalisations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
