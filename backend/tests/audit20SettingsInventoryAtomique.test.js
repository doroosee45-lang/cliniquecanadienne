// AUDIT-20-12 (19 sept. 2026, audit indépendant) —
// settings.controller.js::createMouvement affirmait dans son propre
// commentaire une implémentation atomique (findByIdAndUpdate + $inc) qui
// n'existait PAS réellement : le code faisait Equipment.findById() puis
// equipment.save() séparément — exactement le pattern lire-puis-écrire que
// le commentaire prétendait déjà éviter, même classe de bug que
// MaterielMedical.stock_actuel dans addConsommation avant son correctif
// (AUDIT-20-8). CONFIRMÉ ET REPRODUIT ci-dessous : N sorties concurrentes
// sur le même équipement perdaient des décréments (arithmétique finale
// fausse), exactement comme le stock de blocoperatoireController avant son
// correctif.
// Corrigé avec le même motif que Medication.stock_actuel
// (pharmacy.controller.js) : décrément atomique filtré sur
// quantite >= qte pour une sortie. ajustement (valeur ABSOLUE, pas un
// delta) passe par un $set atomique plutôt qu'un $inc. MouvementInventaire
// n'est créé qu'après le succès de l'opération atomique sur Equipment.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
  return { status, body };
};

test('AUDIT-20-12 — settings.controller.js::createMouvement atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Equipment = require('../models/Equipment');
  const MouvementInventaire = require('../models/MouvementInventaire');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Test', nom: 'Concurrence' };
  const created = [];

  try {
    await t.test('N sorties concurrentes sur le même équipement → quantite finale = initiale - (N × qte), jamais moins, jamais négative', async () => {
      const STOCK_INITIAL = 100;
      const QTE = 3;
      const N = 10;
      const eq = await Equipment.create({ nom: `Audit2012-A-${stamp}`, categorie: 'Consommable', quantite: STOCK_INITIAL, seuil_alerte: 5 });
      created.push(eq._id);

      const results = await Promise.all(Array.from({ length: N }, () =>
        call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'sortie', quantite: QTE, motif: 'test' } })
      ));
      for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));

      const fresh = await Equipment.findById(eq._id);
      const attendu = STOCK_INITIAL - N * QTE;
      assert.equal(fresh.quantite, attendu, `quantite finale attendue ${attendu} — obtenu ${fresh.quantite} : un décrément a été perdu si différent`);

      const mouvements = await MouvementInventaire.find({ equipement: eq._id });
      assert.equal(mouvements.length, N, `les ${N} mouvements doivent tous être tracés, aucun perdu`);
    });

    await t.test('sorties concurrentes en sur-souscription du stock → jamais négatif, exactement floor(stock/qte) réussissent, aucun mouvement orphelin sur les échecs', async () => {
      const STOCK_INITIAL = 10;
      const QTE = 3;
      const N = 6; // 6×3=18 > 10 : au plus 3 peuvent réussir
      const eq = await Equipment.create({ nom: `Audit2012-B-${stamp}`, categorie: 'Consommable', quantite: STOCK_INITIAL, seuil_alerte: 1 });
      created.push(eq._id);

      const results = await Promise.all(Array.from({ length: N }, () =>
        call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'sortie', quantite: QTE, motif: 'test' } })
      ));
      const succes = results.filter(r => r.status === 201).length;
      const echecs = results.filter(r => r.status === 400).length;
      assert.equal(succes + echecs, N);
      assert.equal(succes, Math.floor(STOCK_INITIAL / QTE), `exactement floor(${STOCK_INITIAL}/${QTE}) sorties doivent réussir`);

      const fresh = await Equipment.findById(eq._id);
      assert.equal(fresh.quantite, STOCK_INITIAL - succes * QTE);
      assert.ok(fresh.quantite >= 0, 'jamais négatif même sous forte contention');

      const mouvements = await MouvementInventaire.find({ equipement: eq._id });
      assert.equal(mouvements.length, succes, 'aucun mouvement ne doit être tracé pour une sortie refusée (stock insuffisant)');
    });

    await t.test('non-régression — entree incrémente correctement, ajustement fixe la valeur absolue (pas un delta)', async () => {
      const eq = await Equipment.create({ nom: `Audit2012-C-${stamp}`, categorie: 'Informatique', quantite: 20, seuil_alerte: 2 });
      created.push(eq._id);

      const r1 = await call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'entree', quantite: 5, motif: 'reappro' } });
      assert.equal(r1.status, 201, JSON.stringify(r1.body));
      assert.equal(r1.body.equipment.quantite, 25);

      const r2 = await call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'ajustement', quantite: 12, motif: 'inventaire physique' } });
      assert.equal(r2.status, 201, JSON.stringify(r2.body));
      assert.equal(r2.body.equipment.quantite, 12, 'ajustement doit fixer la quantite EXACTEMENT à la valeur fournie, pas l\'ajouter au solde existant');

      const mvtAjustement = await MouvementInventaire.findOne({ equipement: eq._id, type: 'ajustement' });
      assert.equal(mvtAjustement.quantite, 12, 'le mouvement ajustement trace la valeur cible absolue, pas un delta');
    });

    await t.test('non-régression — sortie insuffisante refusée (400), mouvement introuvable, équipement inchangé', async () => {
      const eq = await Equipment.create({ nom: `Audit2012-D-${stamp}`, categorie: 'Autre', quantite: 2, seuil_alerte: 1 });
      created.push(eq._id);
      const { status, body } = await call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'sortie', quantite: 5, motif: 'x' } });
      assert.equal(status, 400);
      const fresh = await Equipment.findById(eq._id);
      assert.equal(fresh.quantite, 2, 'quantite inchangée après un refus');
      const mouvements = await MouvementInventaire.find({ equipement: eq._id });
      assert.equal(mouvements.length, 0, 'aucun mouvement ne doit être créé pour une sortie refusée');
    });

    await t.test('non-régression — 404 sur équipement inexistant (les 3 types), type/quantite invalides rejetés (400)', async () => {
      const fauxId = new mongoose.Types.ObjectId().toString();
      for (const type of ['entree', 'sortie', 'ajustement']) {
        const { status } = await call(settingsC.createMouvement, { params: { id: fauxId }, user: admin, body: { type, quantite: 1, motif: 'x' } });
        assert.equal(status, 404, `type=${type}`);
      }
      const eq = await Equipment.create({ nom: `Audit2012-E-${stamp}`, categorie: 'Autre', quantite: 10 });
      created.push(eq._id);
      const rType = await call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'invalide', quantite: 1 } });
      assert.equal(rType.status, 400);
      const rQte = await call(settingsC.createMouvement, { params: { id: eq._id.toString() }, user: admin, body: { type: 'entree', quantite: 0 } });
      assert.equal(rQte.status, 400);
    });
  } finally {
    for (const id of created) {
      await MouvementInventaire.deleteMany({ equipement: id });
      await Equipment.findByIdAndDelete(id);
    }
    await mongoose.disconnect();
  }
});
