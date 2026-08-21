// AUDIT-2.1 — pharmacy.controller.js::dispenser/createVente/mouvement
// vérifiaient le stock disponible puis l'écrivaient en deux passes séparées
// (parfois même sans revérifier au moment de l'écriture pour createVente),
// laissant une fenêtre de course : plusieurs opérations concurrentes sur le
// MÊME médicament pouvaient toutes lire un stock suffisant avant que l'une
// n'ait écrit, faisant passer le stock en négatif ou perdant des mouvements
// (mouvement() faisait un findById → save() complet, écrasant les écritures
// concurrentes). Chaque décrément est maintenant une opération atomique
// conditionnelle (findOneAndUpdate filtré sur stock_actuel >= quantité). Ce
// test prouve, sur une vraie course (Promise.all, pas séquentiel) et pour
// les 3 fonctions : avec un stock ne permettant que la moitié des demandes
// concurrentes de réussir, exactement la moitié réussit, l'autre moitié
// échoue explicitement en 400, et le stock final n'est jamais négatif ni
// incohérent avec le nombre réel de succès.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 10;
const QTE = 10;
const STOCK_INITIAL = (N / 2) * QTE; // ne permet que N/2 succès sur N tentatives concurrentes

test('AUDIT-2.1 — décrément de stock pharmacie atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Medication = require('../models/Medication');
  const Prescription = require('../models/Prescription');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_t21-pharm-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T21', prenom: 'PharmMed', role: 'medecin', statut: 'actif' });
  const patient = await Patient.create({ nom: `T21-Pharm-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const cleanup = [
    () => User.findByIdAndDelete(medecin._id),
    () => Patient.findByIdAndDelete(patient._id),
  ];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test(`mouvement() — ${N} sorties de stock concurrentes, stock ne permettant que ${N / 2} succès`, async () => {
      const med = await Medication.create({ nom_commercial: `T21-Med-Mvt-${stamp}`, stock_actuel: STOCK_INITIAL, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const results = await Promise.all(Array.from({ length: N }, () =>
        call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'sortie', quantite: QTE, reference: `T21-${stamp}`, notes: '' }, user })
      ));

      const successes = results.filter(r => r.status === 200);
      const echecs    = results.filter(r => r.status === 400);
      assert.equal(successes.length, N / 2, `exactement ${N / 2} mouvements doivent réussir sur ${N} concurrents, obtenu ${successes.length}`);
      assert.equal(echecs.length, N / 2, `les ${N / 2} autres doivent échouer explicitement en 400, obtenu ${echecs.length}`);

      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 0, 'stock final doit être exactement 0 (aucune perte ni double décompte)');
      assert.equal(fresh.mouvements.length, N / 2, 'seuls les mouvements réellement appliqués doivent être journalisés');
    });

    await t.test(`createVente() — ${N} ventes concurrentes du même produit, stock ne permettant que ${N / 2} succès`, async () => {
      const med = await Medication.create({ nom_commercial: `T21-Med-Vente-${stamp}`, stock_actuel: STOCK_INITIAL, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const results = await Promise.all(Array.from({ length: N }, () =>
        call(pharmaC.createVente, { body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: med._id, quantite: QTE, prix_unitaire: 100 }] }, user })
      ));

      const successes = results.filter(r => r.status === 201);
      const echecs    = results.filter(r => r.status === 400);
      assert.equal(successes.length, N / 2, `exactement ${N / 2} ventes doivent réussir sur ${N} concurrentes, obtenu ${successes.length}`);
      assert.equal(echecs.length, N / 2, `les ${N / 2} autres doivent échouer explicitement en 400, obtenu ${echecs.length}`);

      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 0, 'stock final doit être exactement 0 (aucune perte ni double décompte)');
    });

    await t.test(`dispenser() — ${N} ordonnances distinctes dispensées concurremment sur le même produit, stock ne permettant que ${N / 2} succès`, async () => {
      const med = await Medication.create({ nom_commercial: `T21-Med-Rx-${stamp}`, stock_actuel: STOCK_INITIAL, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const rxs = await Promise.all(Array.from({ length: N }, () => Prescription.create({
        patient: patient._id, medecin: medecin._id, statut: 'active',
        lignes: [{ medicament: med._id, medicament_nom: med.nom_commercial, quantite: QTE }],
      })));
      cleanup.push(() => Prescription.deleteMany({ _id: { $in: rxs.map(r => r._id) } }));

      const results = await Promise.all(rxs.map(rx => call(pharmaC.dispenser, { params: { id: rx._id }, user })));

      const successes = results.filter(r => r.status === 200);
      const echecs    = results.filter(r => r.status === 400);
      assert.equal(successes.length, N / 2, `exactement ${N / 2} dispensations doivent réussir sur ${N} concurrentes, obtenu ${successes.length}`);
      assert.equal(echecs.length, N / 2, `les ${N / 2} autres doivent échouer explicitement en 400, obtenu ${echecs.length}`);

      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 0, 'stock final doit être exactement 0 (aucune perte ni double décompte)');

      const freshRxs = await Prescription.find({ _id: { $in: rxs.map(r => r._id) } }).lean();
      const dispensees = freshRxs.filter(r => r.statut === 'dispensee');
      const restees    = freshRxs.filter(r => r.statut === 'active');
      assert.equal(dispensees.length, N / 2, 'exactement les ordonnances dont la dispensation a réussi doivent passer à dispensee');
      assert.equal(restees.length, N / 2, 'les ordonnances dont la dispensation a échoué doivent rester à active (pas de statut modifié sur échec)');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
