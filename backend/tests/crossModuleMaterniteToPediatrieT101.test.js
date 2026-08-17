// Phase 10.1 — test de non-régression croisé Maternité↔Pédiatrie.
// La création explicite d'un dossier pédiatrique depuis un Newborn
// (createChildDossier, cf. newbornChildDossier.test.js qui couvre déjà le
// report des champs et le garde-fou anti-doublon) doit aussi journaliser
// l'action dans le module 'pediatrie' — angle non couvert par ce test
// existant. Une régression ici romprait la traçabilité de la frontière
// Maternité→Pédiatrie sans faire échouer le test fonctionnel déjà en place.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Maternité→Pédiatrie — createChildDossier journalise dans AuditLog (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Newborn = require('../models/Newborn');
  const Child = require('../models/Child');
  const AuditLog = require('../models/AuditLog');
  const maternityC = require('../controllers/maternityController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T101', nom: 'Test' };
  let nb, childId;

  try {
    nb = await Newborn.create({
      mere_nom: `T101-${stamp}`, prenom: 'Bébé', sexe: 'M', poids: 3000, taille: 48,
      etat: 'bon', created_by: user._id,
    });

    await t.test('createChildDossier crée bien une entrée AuditLog module=pediatrie, action=CREATE', async () => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await maternityC.createChildDossier({ params: { id: nb._id }, user, ip: '127.0.0.1' }, res, () => {});
      assert.equal(status, 201);
      childId = body.enfant._id;

      const log = await AuditLog.findOne({ module: 'pediatrie', action: 'CREATE', entite_id: childId.toString() }).sort('-createdAt');
      assert.ok(log, 'une entrée AuditLog doit exister pour la création du dossier enfant');
      assert.equal(String(log.utilisateur), String(user._id));
    });
  } finally {
    if (childId) await Child.findByIdAndDelete(childId);
    if (nb) await Newborn.findByIdAndDelete(nb._id);
    await mongoose.disconnect();
  }
});
