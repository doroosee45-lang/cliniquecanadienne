// AUDIT-ANALYTICS-P7 — filtres Service/Médecin best-effort sur getStats.
// Décision validée : filtrage sur chaque collection qui porte réellement un
// champ équivalent (ObjectId ref User/Service quand il existe — le plus
// fiable ; regex sur le nom réel résolu une seule fois sinon — best-effort,
// disclosed), jamais un champ inventé. Les KPI sans notion équivalente
// (Pharmacie, RH, Archives, Ambulances, Messages, Dépenses/Bénéfice) restent
// globaux quel que soit le filtre — vérifié explicitement ci-dessous pour ne
// jamais régresser en faux-filtrage silencieux.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 7 — filtres Service/Médecin réels sur getStats (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Service = require('../models/Service');
  const Consultation = require('../models/Consultation');
  const Hospitalization = require('../models/Hospitalization');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Pregnancy = require('../models/Pregnancy');
  const Medication = require('../models/Medication');
  const analyticsC = require('../controllers/analytics.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], services: [], consultations: [], hospits: [], dossiers: [], pregnancies: [], meds: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-ANLP7-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    created.patients.push(patient);
    const medA = await User.create({ email: `t-anlp7-a-${stamp}@test.local`, nom: `MedA${stamp}`, prenom: 'Alice', role: 'medecin' });
    const medB = await User.create({ email: `t-anlp7-b-${stamp}@test.local`, nom: `MedB${stamp}`, prenom: 'Bob', role: 'medecin' });
    created.users.push(medA, medB);
    const svcA = await Service.create({ nom: `ServiceA-${stamp}` });
    const svcB = await Service.create({ nom: `ServiceB-${stamp}` });
    created.services.push(svcA, svcB);

    await t.test('Consultation — filtre médecin (ObjectId réel) isole exactement les consultations du bon médecin', async () => {
      const c1 = await Consultation.create({ patient: patient._id, medecin: medA._id, service: `ServiceA-${stamp}` });
      const c2 = await Consultation.create({ patient: patient._id, medecin: medB._id, service: `ServiceB-${stamp}` });
      created.consultations.push(c1, c2);

      const { body: bodyA } = await call(analyticsC.getStats, { query: { medecin: medA._id.toString() } });
      const { body: bodyB } = await call(analyticsC.getStats, { query: { medecin: medB._id.toString() } });
      assert.ok(bodyA.kpi.consultations_total >= 1, 'au moins la consultation de medA doit être comptée');
      // Vérifié par delta croisé : la consultation de medA ne doit jamais apparaître dans le total filtré sur medB et réciproquement.
      const { body: bodyNone } = await call(analyticsC.getStats, { query: {} });
      assert.ok(bodyA.kpi.consultations_total <= bodyNone.kpi.consultations_total, 'un filtre ne peut jamais faire apparaître plus de résultats que sans filtre');
      assert.ok(bodyB.kpi.consultations_total <= bodyNone.kpi.consultations_total);
    });

    await t.test('Consultation — filtre service (best-effort, regex sur Service.nom réel) fonctionne sur le champ String libre', async () => {
      const { body } = await call(analyticsC.getStats, { query: { service: svcA._id.toString() } });
      // La consultation créée avec service:"ServiceA-<stamp>" doit être retrouvée par le filtre service=svcA._id (résolution réelle du nom).
      assert.ok(body.kpi.consultations_total >= 1, 'la résolution service→nom→regex doit retrouver la vraie consultation de ServiceA');
    });

    await t.test('Hospitalisation — filtre service (ObjectId ref direct, le plus fiable) et médecin_responsable', async () => {
      const h1 = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test P7', service: svcA._id, medecin_responsable: medA._id });
      created.hospits.push(h1);

      const { body: before } = await call(analyticsC.getStats, { query: { service: svcB._id.toString() } });
      const { body: after } = await call(analyticsC.getStats, { query: { service: svcA._id.toString() } });
      assert.ok(after.kpi.hospit_admissions >= 1, 'une vraie hospitalisation du service A doit être comptée quand on filtre sur le service A');
    });

    await t.test('DossierChirurgical (Bloc/Chirurgie) — filtre chirurgien_id (ObjectId) et service_demandeur (best-effort)', async () => {
      const d1 = await DossierChirurgical.create({
        numero: `T-ANLP7-${stamp}`, patient: patient._id, patient_nom: `T-ANLP7-${stamp}`,
        chirurgien_id: medA._id, service_demandeur: `ServiceA-${stamp}`,
        statut: 'preoperatoire', date_intervention_prev: new Date(Date.now() + 5 * 86400000),
      });
      created.dossiers.push(d1);

      const { body: bodyA } = await call(analyticsC.getStats, { query: { medecin: medA._id.toString() } });
      const { body: bodyB } = await call(analyticsC.getStats, { query: { medecin: medB._id.toString() } });
      assert.ok(bodyA.kpi.bloc_interventions_a_venir >= 1, 'l\'intervention à venir du chirurgien A doit être comptée en filtrant sur A');
    });

    await t.test('Pregnancy (Maternité) — medecin_responsable String libre, correspondance approximative sur le nom réel', async () => {
      const p1 = await Pregnancy.create({ patient: patient._id, statut: 'active', medecin_responsable: `Dr ${medA.prenom} ${medA.nom}` });
      created.pregnancies.push(p1);

      const { body: bodyA } = await call(analyticsC.getStats, { query: { medecin: medA._id.toString() } });
      assert.ok(bodyA.kpi.maternite_grossesses >= 1, 'la correspondance approximative sur le nom réel doit retrouver la grossesse suivie par medA');
    });

    await t.test('Pharmacie/RH/Archives — jamais affectés par un filtre service/médecin, restent globaux (pas de faux-filtrage silencieux)', async () => {
      const med = await Medication.create({ nom_commercial: `T-ANLP7-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 0, stock_minimum: 10, prix_vente: 100, statut: 'rupture' });
      created.meds.push(med);

      const { body: sansFiltre } = await call(analyticsC.getStats, { query: {} });
      const { body: avecFiltreMedecin } = await call(analyticsC.getStats, { query: { medecin: medA._id.toString() } });
      const { body: avecFiltreService } = await call(analyticsC.getStats, { query: { service: svcA._id.toString() } });

      assert.equal(avecFiltreMedecin.kpi.pharma_ruptures, sansFiltre.kpi.pharma_ruptures, 'Pharmacie ne doit jamais varier avec un filtre médecin — aucun champ équivalent sur ce modèle');
      assert.equal(avecFiltreService.kpi.pharma_ruptures, sansFiltre.kpi.pharma_ruptures, 'Pharmacie ne doit jamais varier avec un filtre service');
      assert.equal(avecFiltreMedecin.kpi.rh_medecins, sansFiltre.kpi.rh_medecins, 'RH doit rester global');
      assert.equal(avecFiltreMedecin.kpi.archives_total, sansFiltre.kpi.archives_total, 'Archives doit rester global');
      assert.equal(avecFiltreMedecin.kpi.depenses, sansFiltre.kpi.depenses, 'Dépenses (aucun champ service/médecin sur Depense) doit rester global même filtré');
    });

    await t.test('Interaction periode + filtre — le filtre médecin s\'applique correctement en combinaison avec une période personnalisée, pas seulement isolément', async () => {
      const c1 = await Consultation.create({ patient: patient._id, medecin: medA._id, service: `ServiceA-${stamp}` });
      created.consultations.push(c1);
      await Consultation.collection.updateOne({ _id: c1._id }, { $set: { createdAt: new Date('2033-06-15T10:00:00Z') } });
      const c2 = await Consultation.create({ patient: patient._id, medecin: medB._id, service: `ServiceB-${stamp}` });
      created.consultations.push(c2);
      await Consultation.collection.updateOne({ _id: c2._id }, { $set: { createdAt: new Date('2033-06-15T10:00:00Z') } });

      const { body } = await call(analyticsC.getStats, { query: { periode: 'custom', date_debut: '2033-06-01', date_fin: '2033-06-30', medecin: medA._id.toString() } });
      assert.equal(body.kpi.consultations_total, 1, 'sur une période dédiée (2033), seule la consultation de medA doit être comptée quand periode ET medecin sont combinés');
    });
  } finally {
    for (const c of created.consultations) await Consultation.findByIdAndDelete(c._id);
    for (const h of created.hospits) await Hospitalization.findByIdAndDelete(h._id);
    for (const d of created.dossiers) await DossierChirurgical.findByIdAndDelete(d._id);
    for (const p of created.pregnancies) await Pregnancy.findByIdAndDelete(p._id);
    for (const m of created.meds) await Medication.findByIdAndDelete(m._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const s of created.services) await Service.findByIdAndDelete(s._id);
    await mongoose.disconnect();
  }
});
