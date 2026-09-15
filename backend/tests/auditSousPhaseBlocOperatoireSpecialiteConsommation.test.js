// Correction Sous-phase "Bloc Opératoire" (audit du 15 sept. 2026) —
// couvre les deux limites documentées corrigées dans Blocoperatoire.jsx :
// 1) specialite (formInterv.specialite) n'était jamais persisté par
//    createIntervention()/updateIntervention() (blocoperatoireController.js) :
//    Mongoose la supprimait silencieusement, faute de champ homonyme sur
//    DossierChirurgical — "Par spécialité" (Dashboard + Statistiques) était
//    donc désactivé honnêtement plutôt que d'afficher une répartition
//    inventée.
// 2) Aucun modèle de données ne suivait la consommation de matériel/
//    consommables du bloc opératoire — nouveau modèle MaterielMedical +
//    sous-document DossierChirurgical.materiel_utilise, endpoints
//    getMateriels/addConsommation/getConsommationStats.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase Bloc Opératoire — specialite persistée + consommation de matériel réelle', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const MaterielMedical = require('../models/MaterielMedical');
  const boC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const created = { patients: [], users: [], dossiers: [], materiels: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const chirurgien = await User.create({ email: `_bloc-spec-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chirurgien', prenom: 'Spec', role: 'medecin', statut: 'actif' });
    created.users.push(chirurgien._id);

    await t.test('createIntervention persiste réellement specialite (plus jamais supprimée silencieusement)', async () => {
      const patient = await Patient.create({ nom: `T-Bloc-Spec-Create-${stamp}`, prenom: 'P', date_naissance: '1985-01-01', sexe: 'M' });
      created.patients.push(patient._id);

      const creneauUnique = new Date(stamp + 9 * 24 * 3600000);
      const { status, body } = await call(boC.createIntervention, {
        body: {
          patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(),
          type_intervention: 'Test-Spec-Create', specialite: 'orthopédie',
          salle: 'BO-1', date_heure_op: creneauUnique.toISOString(), statut: 'programmee',
        },
        user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.dossiers.push(body.intervention._id);

      const enBase = await DossierChirurgical.findById(body.intervention._id).lean();
      assert.equal(enBase.specialite, 'orthopédie', 'AVANT la correction : specialite était toujours absente en base après création');
    });

    await t.test('updateIntervention persiste réellement specialite (formulaire de replanification/édition)', async () => {
      const patient = await Patient.create({ nom: `T-Bloc-Spec-Update-${stamp}`, prenom: 'P', date_naissance: '1988-01-01', sexe: 'F' });
      created.patients.push(patient._id);

      const creneauUnique = new Date(stamp + 10 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: {
          patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(),
          type_intervention: 'Test-Spec-Update', specialite: 'chirurgie_generale',
          salle: 'BO-2', date_heure_op: creneauUnique.toISOString(), statut: 'programmee',
        },
        user: chirurgien, ip: '127.0.0.1',
      });
      const dossierId = bCreate.intervention._id;
      created.dossiers.push(dossierId);

      const { status } = await call(boC.updateIntervention, {
        params: { id: dossierId }, body: { specialite: 'urologie' }, user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      const enBase = await DossierChirurgical.findById(dossierId).lean();
      assert.equal(enBase.specialite, 'urologie', "AVANT la correction : 'specialite' n'était pas dans la liste blanche 'allowed' de updateIntervention, silencieusement ignorée");
    });

    await t.test("getPlanning().stats.par_specialite reflète une vraie agrégation MongoDB (jamais une répartition inventée)", async () => {
      const patient = await Patient.create({ nom: `T-Bloc-Spec-Agg-${stamp}`, prenom: 'P', date_naissance: '1990-06-06', sexe: 'M' });
      created.patients.push(patient._id);

      const creneauUnique = new Date(stamp + 11 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: {
          patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(),
          type_intervention: 'Test-Spec-Agg', specialite: 'ophtalmologie',
          salle: 'BO-3', date_heure_op: creneauUnique.toISOString(), statut: 'programmee',
        },
        user: chirurgien, ip: '127.0.0.1',
      });
      created.dossiers.push(bCreate.intervention._id);

      const { status, body } = await call(boC.getPlanning, { query: {} });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(Array.isArray(body.stats.par_specialite), 'par_specialite doit être un tableau réellement agrégé, jamais absent');
      const ophtalmo = body.stats.par_specialite.find(x => x.specialite === 'ophtalmologie');
      assert.ok(ophtalmo && ophtalmo.nombreInterventions >= 1, `doit compter au moins notre intervention ophtalmologie créée à l'instant, obtenu ${JSON.stringify(body.stats.par_specialite)}`);
    });

    await t.test('addConsommation décrémente réellement le stock MaterielMedical et alimente materiel_utilise', async () => {
      const materiel = await MaterielMedical.create({ designation: `Gants-Test-${stamp}`, categorie: 'gants', unite: 'paires', stock_actuel: 50, stock_minimum: 10 });
      created.materiels.push(materiel._id);

      const patient = await Patient.create({ nom: `T-Bloc-Conso-${stamp}`, prenom: 'P', date_naissance: '1992-03-03', sexe: 'F' });
      created.patients.push(patient._id);
      const creneauUnique = new Date(stamp + 12 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Test-Conso', salle: 'BO-1', date_heure_op: creneauUnique.toISOString(), statut: 'programmee' },
        user: chirurgien, ip: '127.0.0.1',
      });
      const dossierId = bCreate.intervention._id;
      created.dossiers.push(dossierId);

      const { status, body } = await call(boC.addConsommation, {
        params: { id: dossierId }, body: { materiel_id: materiel._id.toString(), quantite: 12 }, user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));

      const materielApres = await MaterielMedical.findById(materiel._id).lean();
      assert.equal(materielApres.stock_actuel, 38, 'le stock réel doit être décrémenté de la quantité consommée (50 - 12 = 38)');

      const dossierApres = await DossierChirurgical.findById(dossierId).lean();
      assert.equal(dossierApres.materiel_utilise.length, 1);
      assert.equal(dossierApres.materiel_utilise[0].quantite, 12);
      assert.equal(dossierApres.materiel_utilise[0].designation, materiel.designation, 'snapshot de designation, indépendant d\'un renommage ultérieur du catalogue');
    });

    await t.test('addConsommation refuse un stock insuffisant (jamais de stock négatif)', async () => {
      const materiel = await MaterielMedical.create({ designation: `Compresses-Test-${stamp}`, categorie: 'compresses', unite: 'unités', stock_actuel: 5, stock_minimum: 10 });
      created.materiels.push(materiel._id);

      const patient = await Patient.create({ nom: `T-Bloc-ConsoInsuf-${stamp}`, prenom: 'P', date_naissance: '1993-04-04', sexe: 'M' });
      created.patients.push(patient._id);
      const creneauUnique = new Date(stamp + 13 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Test-ConsoInsuf', salle: 'BO-2', date_heure_op: creneauUnique.toISOString(), statut: 'programmee' },
        user: chirurgien, ip: '127.0.0.1',
      });
      created.dossiers.push(bCreate.intervention._id);

      const { status, body } = await call(boC.addConsommation, {
        params: { id: bCreate.intervention._id }, body: { materiel_id: materiel._id.toString(), quantite: 999 }, user: chirurgien, ip: '127.0.0.1',
      });
      assert.equal(status, 400, JSON.stringify(body));
      const materielApres = await MaterielMedical.findById(materiel._id).lean();
      assert.equal(materielApres.stock_actuel, 5, 'le stock ne doit jamais devenir négatif ni bouger sur un refus');
    });

    await t.test('getConsommationStats agrège réellement la consommation par désignation', async () => {
      const materiel = await MaterielMedical.create({ designation: `Seringues-Test-${stamp}`, categorie: 'seringues', unite: 'unités', stock_actuel: 100, stock_minimum: 10 });
      created.materiels.push(materiel._id);

      const patient = await Patient.create({ nom: `T-Bloc-ConsoStats-${stamp}`, prenom: 'P', date_naissance: '1994-05-05', sexe: 'F' });
      created.patients.push(patient._id);
      const creneauUnique = new Date(stamp + 14 * 24 * 3600000);
      const { body: bCreate } = await call(boC.createIntervention, {
        body: { patient: patient._id.toString(), chirurgien_id: chirurgien._id.toString(), type_intervention: 'Test-ConsoStats', salle: 'BO-3', date_heure_op: creneauUnique.toISOString(), statut: 'programmee' },
        user: chirurgien, ip: '127.0.0.1',
      });
      const dossierId = bCreate.intervention._id;
      created.dossiers.push(dossierId);

      await call(boC.addConsommation, { params: { id: dossierId }, body: { materiel_id: materiel._id.toString(), quantite: 7 }, user: chirurgien, ip: '127.0.0.1' });

      const { status, body } = await call(boC.getConsommationStats, { query: {} });
      assert.equal(status, 200, JSON.stringify(body));
      const ligne = body.data.find(x => x.materiel === materiel.designation);
      assert.ok(ligne && ligne.quantite >= 7, `doit refléter au moins notre consommation de 7, obtenu ${JSON.stringify(body.data)}`);
      assert.ok(body.total_consomme >= 7);
    });
  } finally {
    await DossierChirurgical.deleteMany({ _id: { $in: created.dossiers } });
    await MaterielMedical.deleteMany({ _id: { $in: created.materiels } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
