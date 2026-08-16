// R-10d — pas de création automatique d'un dossier Child à la création d'un
// Newborn (décision explicite : proposition, pas automatisme forcé). Ce
// test vérifie l'action explicite de création, le report des champs
// pertinents, et le garde-fou contre une double création.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('création explicite du dossier pédiatrique depuis un nouveau-né (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Newborn = require('../models/Newborn');
  const Child = require('../models/Child');
  const maternityC = require('../controllers/maternityController');

  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
  const nb = await Newborn.create({
    mere_nom: 'Dupont', prenom: 'Bébé', sexe: 'F', poids: 3200, taille: 49,
    etat: 'surveillance', created_by: user._id,
  });
  let childId;

  try {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('la création d\'un Newborn ne crée aucun Child automatiquement', async () => {
      const fresh = await Newborn.findById(nb._id);
      assert.equal(fresh.child_id, null);
    });

    await t.test('createChildDossier crée un Child avec les champs reportés', async () => {
      await maternityC.createChildDossier({ params: { id: nb._id }, user }, res, () => {});
      assert.equal(status, 201);
      childId = body.enfant._id;
      assert.equal(body.enfant.sexe, 'F');
      assert.equal(body.enfant.poids_actuel, 3.2, 'grammes convertis en kg');
      assert.equal(body.enfant.taille_actuelle, 49);
      assert.equal(body.enfant.parent_nom, 'Dupont');
      assert.equal(body.enfant.statut, 'surveillance');

      const nbFresh = await Newborn.findById(nb._id);
      assert.equal(String(nbFresh.child_id), String(childId));
    });

    await t.test('une seconde tentative est refusée (400)', async () => {
      status = 200; body = null;
      await maternityC.createChildDossier({ params: { id: nb._id }, user }, res, () => {});
      assert.equal(status, 400);
    });
  } finally {
    if (childId) await Child.findByIdAndDelete(childId);
    await Newborn.findByIdAndDelete(nb._id);
    await mongoose.disconnect();
  }
});
