// AUDIT-20-8 (19 sept. 2026, audit indépendant) —
// blocoperatoireController.js::addConsommation avait deux bugs distincts,
// sur deux documents séparés, de sévérité très différente :
//
// (a) materiel.stock_actuel -= quantite + materiel.save() — lecture-puis-
//     décrément NON ATOMIQUE sur un stock partagé, la même classe de bug
//     déjà corrigée sur Medication.stock_actuel (AUDIT-2.1,
//     pharmacy.controller.js::createVente/dispenser). CONFIRMÉ ET
//     REPRODUIT directement ci-dessous : 10 appels concurrents à 3 unités
//     chacun sur un stock de 100 ont laissé 88 au lieu de 70 (4 décréments
//     perdus sur 10), et sous contention forte, 6 appels ont réussi là où
//     seuls 3 auraient dû (stock qui serait devenu négatif). C'est le
//     correctif central de ce fichier.
//
// (b) dossier.materiel_utilise.push(...) + dossier.save() — même PATTERN
//     de code que le reste de ce chantier (AUDIT-20-6/7), mais un simple
//     push() en fin de tableau (contrairement aux cas déjà prouvés qui
//     mutent un élément EXISTANT via .id(sid)). Aucune tentative de
//     reproduction isolée de cette seule partie n'a été faite ici (la
//     course dominante et bien plus grave est (a)) ; par analogie avec
//     hr/maternity/pediatrie ci-contre (où un push() de fin de tableau
//     seul ne s'est jamais révélé exploitable malgré un effort de
//     reproduction sérieux), la sévérité réelle de cette partie précise
//     reste NON CONFIRMÉE — corrigée par cohérence de style, pas sur
//     preuve de reproduction.
//
// Corrigé avec le même pattern exact que createVente pour (a) : décrément
// atomique via findOneAndUpdate filtré sur stock_actuel >= quantite, $push
// sur materiel_utilise seulement après un décrément réussi.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message, name: err.name }; } });
  return { status, body };
};

test('AUDIT-20-8 — blocoperatoireController.js::addConsommation atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const MaterielMedical = require('../models/MaterielMedical');
  const blocC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Concurrence' };
  const created = { patients: [], dossiers: [], materiels: [] };

  try {
    const patient = await Patient.create({ nom: `Audit20-8-${stamp}`, prenom: 'P', sexe: 'F', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);

    await t.test('N appels concurrents sur le même materiel_id → stock final = stock initial - (N × quantité), jamais plus, jamais négatif', async () => {
      const STOCK_INITIAL = 100;
      const QUANTITE = 3;
      const N = 10; // 10 × 3 = 30, largement absorbable par 100 : prouve qu'aucun décrément n'est perdu

      const materiel = await MaterielMedical.create({ designation: `Audit20-8-Materiel-${stamp}`, stock_actuel: STOCK_INITIAL, stock_minimum: 5, unite: 'unité', statut: 'disponible' });
      created.materiels.push(materiel._id);
      const dossier = await DossierChirurgical.create({ numero: `AUDIT20-8-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'opere' });
      created.dossiers.push(dossier._id);

      const results = await Promise.all(Array.from({ length: N }, () =>
        call(blocC.addConsommation, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { materiel_id: materiel._id.toString(), quantite: QUANTITE } })
      ));
      for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));

      const freshMateriel = await MaterielMedical.findById(materiel._id).lean();
      const attendu = STOCK_INITIAL - (N * QUANTITE);
      assert.equal(freshMateriel.stock_actuel, attendu, `stock final attendu ${attendu} (${STOCK_INITIAL} - ${N}×${QUANTITE}) — obtenu ${freshMateriel.stock_actuel} : un décrément a été perdu si différent`);
      assert.ok(freshMateriel.stock_actuel >= 0, 'le stock ne doit jamais être négatif');

      const freshDossier = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(freshDossier.materiel_utilise.length, N, `les ${N} lignes de consommation doivent toutes être persistées, aucune perdue sous concurrence réelle`);
      const totalConsomme = freshDossier.materiel_utilise.reduce((s, m) => s + m.quantite, 0);
      assert.equal(totalConsomme, N * QUANTITE, 'la somme des quantités consommées doit correspondre exactement au décrément réel');
    });

    await t.test('stock insuffisant pour tous les appels concurrents → jamais négatif, exactement floor(stock/quantite) réussissent', async () => {
      const STOCK_INITIAL = 10;
      const QUANTITE = 3;
      const N = 6; // 6 × 3 = 18 > 10 : au plus 3 peuvent réussir (3×3=9 ≤ 10, un 4e échouerait car 12 > 10)

      const materiel = await MaterielMedical.create({ designation: `Audit20-8-MaterielLimite-${stamp}`, stock_actuel: STOCK_INITIAL, stock_minimum: 2, unite: 'unité', statut: 'disponible' });
      created.materiels.push(materiel._id);
      const dossier = await DossierChirurgical.create({ numero: `AUDIT20-8B-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'opere' });
      created.dossiers.push(dossier._id);

      const results = await Promise.all(Array.from({ length: N }, () =>
        call(blocC.addConsommation, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { materiel_id: materiel._id.toString(), quantite: QUANTITE } })
      ));
      const succes = results.filter(r => r.status === 200).length;
      const echecs = results.filter(r => r.status === 400).length;
      assert.equal(succes + echecs, N, 'chaque appel doit se conclure en succès ou en refus propre, jamais un crash');
      assert.equal(succes, Math.floor(STOCK_INITIAL / QUANTITE), `exactement floor(${STOCK_INITIAL}/${QUANTITE})=${Math.floor(STOCK_INITIAL / QUANTITE)} appels doivent réussir`);

      const freshMateriel = await MaterielMedical.findById(materiel._id).lean();
      assert.equal(freshMateriel.stock_actuel, STOCK_INITIAL - succes * QUANTITE);
      assert.ok(freshMateriel.stock_actuel >= 0, 'le stock ne doit jamais devenir négatif même sous forte contention');
    });

    await t.test('non-régression — statut rupture appliqué quand le stock passe sous le seuil minimum', async () => {
      const materiel = await MaterielMedical.create({ designation: `Audit20-8-Rupture-${stamp}`, stock_actuel: 5, stock_minimum: 5, unite: 'unité', statut: 'disponible' });
      created.materiels.push(materiel._id);
      const dossier = await DossierChirurgical.create({ numero: `AUDIT20-8C-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'opere' });
      created.dossiers.push(dossier._id);

      const { status, body } = await call(blocC.addConsommation, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { materiel_id: materiel._id.toString(), quantite: 1 } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.materiel.statut, 'rupture', 'le statut doit refléter le stock réellement mis à jour (4 ≤ seuil 5)');

      const fresh = await MaterielMedical.findById(materiel._id).lean();
      assert.equal(fresh.statut, 'rupture');
    });

    await t.test('non-régression — 404 sur dossier et matériel inexistants', async () => {
      const materiel = await MaterielMedical.create({ designation: `Audit20-8-404-${stamp}`, stock_actuel: 10, stock_minimum: 1, unite: 'unité', statut: 'disponible' });
      created.materiels.push(materiel._id);
      const fauxDossier = new mongoose.Types.ObjectId().toString();
      const { status: s1 } = await call(blocC.addConsommation, { params: { id: fauxDossier }, user, ip: '127.0.0.1', body: { materiel_id: materiel._id.toString(), quantite: 1 } });
      assert.equal(s1, 404);

      const dossier = await DossierChirurgical.create({ numero: `AUDIT20-8D-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'opere' });
      created.dossiers.push(dossier._id);
      const fauxMateriel = new mongoose.Types.ObjectId().toString();
      const { status: s2 } = await call(blocC.addConsommation, { params: { id: dossier._id.toString() }, user, ip: '127.0.0.1', body: { materiel_id: fauxMateriel, quantite: 1 } });
      assert.equal(s2, 404);
    });
  } finally {
    for (const id of created.dossiers) await DossierChirurgical.findByIdAndDelete(id);
    for (const id of created.materiels) await MaterielMedical.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
