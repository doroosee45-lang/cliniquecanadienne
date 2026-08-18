// AUDIT-A-8 — recurring.controller.js n'avait aucun test fonctionnel dédié
// pour getAll/create/update/remove (planifier() est déjà couvert par
// auditP7-6ConflitRdvReportEtRecurrence.test.js — non dupliqué ici).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('recurring.controller — couverture fonctionnelle getAll/create/update/remove (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const recC = require('../controllers/recurring.controller');
  const RecurringProtocol = require('../models/RecurringProtocol');
  const User = require('../models/User');

  const stamp = Date.now();
  const medecinA = await User.create({ email: `_a8-medA-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A8', prenom: 'MedA', role: 'medecin', statut: 'actif' });
  const medecinB = await User.create({ email: `_a8-medB-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A8', prenom: 'MedB', role: 'medecin', statut: 'actif' });
  const userA = { _id: medecinA._id, prenom: medecinA.prenom, nom: medecinA.nom, role: 'medecin' };
  const userAdmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const cleanup = [
    () => User.findByIdAndDelete(medecinA._id),
    () => User.findByIdAndDelete(medecinB._id),
  ];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('create() — persiste avec created_by, même si le body tente de le forcer', async () => {
      const { status, body } = await call(recC.create, {
        body: { titre: `A8-Protocole-${stamp}`, medecin: medecinA._id, frequence: 'mensuel', prochaine_date: new Date('2027-04-01'), created_by: new mongoose.Types.ObjectId() },
        user: userA, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(body.protocol._id));
      assert.equal(String(body.protocol.created_by), String(userA._id), 'created_by doit venir de req.user, pas du body');
    });

    let protocolA, protocolB;
    await t.test('getAll() — un médecin ne voit que ses propres protocoles', async () => {
      protocolA = await RecurringProtocol.create({ titre: `A8-ProtoA-${stamp}`, medecin: medecinA._id, frequence: 'hebdomadaire', prochaine_date: new Date('2027-04-01'), created_by: medecinA._id });
      protocolB = await RecurringProtocol.create({ titre: `A8-ProtoB-${stamp}`, medecin: medecinB._id, frequence: 'hebdomadaire', prochaine_date: new Date('2027-04-01'), created_by: medecinB._id });
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(protocolA._id));
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(protocolB._id));

      const { body } = await call(recC.getAll, { user: userA });
      const ids = body.protocols.map(p => String(p._id));
      assert.ok(ids.includes(String(protocolA._id)), 'le médecin A doit voir son propre protocole');
      assert.ok(!ids.includes(String(protocolB._id)), 'le médecin A ne doit pas voir le protocole du médecin B');
    });

    await t.test('getAll() — un admin voit tous les protocoles', async () => {
      const { body } = await call(recC.getAll, { user: userAdmin });
      const ids = body.protocols.map(p => String(p._id));
      assert.ok(ids.includes(String(protocolA._id)));
      assert.ok(ids.includes(String(protocolB._id)));
    });

    await t.test('update() — created_by et nb_patients restent bloqués, titre légitime persiste', async () => {
      const autreAuteur = new mongoose.Types.ObjectId();
      const { status, body } = await call(recC.update, {
        params: { id: protocolA._id },
        body: { titre: 'Titre modifié A8', created_by: autreAuteur, nb_patients: 999 },
        user: userA, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.protocol.titre, 'Titre modifié A8');

      const fresh = await RecurringProtocol.findById(protocolA._id).lean();
      assert.equal(String(fresh.created_by), String(medecinA._id), 'created_by ne doit pas être modifiable via cet endpoint');
      assert.equal(fresh.nb_patients, 0, 'nb_patients ne doit pas être modifiable via cet endpoint');
    });

    await t.test('update() — 404 explicite sur un protocole inexistant', async () => {
      const { status, body } = await call(recC.update, { params: { id: new mongoose.Types.ObjectId() }, body: { titre: 'X' }, user: userA, ip: '127.0.0.1' });
      assert.equal(status, 404);
      assert.match(body.message, /introuvable/);
    });

    await t.test('remove() — archivage logique (actif:false), pas de suppression physique', async () => {
      const { status } = await call(recC.remove, { params: { id: protocolB._id }, user: userAdmin, ip: '127.0.0.1' });
      assert.equal(status, 200);

      const fresh = await RecurringProtocol.findById(protocolB._id).lean();
      assert.ok(fresh, 'le document doit toujours exister en base après remove()');
      assert.equal(fresh.actif, false);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
