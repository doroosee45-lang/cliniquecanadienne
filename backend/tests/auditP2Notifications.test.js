// AUDIT-07 — notifications.controller.js::getAll et ::markAllRead sont
// réellement utilisés (Header.jsx) mais n'avaient aucune couverture de
// test. markRead (lecture individuelle) est délibérément exclu ici :
// confirmé qu'aucun workflow frontend ne l'appelle (aucun onClick sur un
// item de notification malgré le curseur "pointer") — documenté séparément
// en ticket plutôt que testé, cf. décision explicite AUDIT-07.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('notifications.controller — getAll et markAllRead (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const notifC = require('../controllers/notifications.controller');
  const Notification = require('../models/Notification');
  const User = require('../models/User');

  const stamp = Date.now();
  const userA = await User.create({ email: `_notif-a-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'NotifA', role: 'medecin', statut: 'actif' });
  const userB = await User.create({ email: `_notif-b-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'NotifB', role: 'infirmier', statut: 'actif' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [
    () => User.findByIdAndDelete(userA._id),
    () => User.findByIdAndDelete(userB._id),
  ];

  try {
    await t.test('getAll — scopé au destinataire (userA ne voit pas les notifications de userB)', async () => {
      const notifA = await Notification.create({ destinataire: userA._id, titre: `T-Notif-A-${stamp}`, message: 'msg A' });
      const notifB = await Notification.create({ destinataire: userB._id, titre: `T-Notif-B-${stamp}`, message: 'msg B' });
      cleanup.push(() => Notification.findByIdAndDelete(notifA._id), () => Notification.findByIdAndDelete(notifB._id));

      const { status, body } = await call(notifC.getAll, { user: userA });
      assert.equal(status, 200);
      assert.ok(body.notifications.some(n => n._id.toString() === notifA._id.toString()), 'userA doit voir sa propre notification');
      assert.ok(!body.notifications.some(n => n._id.toString() === notifB._id.toString()), 'userA ne doit pas voir la notification de userB');
      assert.ok(body.unread >= 1, 'le compteur unread doit refléter au moins la notification non lue créée');
    });

    await t.test('markAllRead — ne marque comme lu que les notifications du destinataire courant', async () => {
      const notifA1 = await Notification.create({ destinataire: userA._id, titre: `T-Notif-A1-${stamp}`, message: 'msg', lu: false });
      const notifA2 = await Notification.create({ destinataire: userA._id, titre: `T-Notif-A2-${stamp}`, message: 'msg', lu: false });
      const notifB1 = await Notification.create({ destinataire: userB._id, titre: `T-Notif-B1-${stamp}`, message: 'msg', lu: false });
      cleanup.push(
        () => Notification.findByIdAndDelete(notifA1._id),
        () => Notification.findByIdAndDelete(notifA2._id),
        () => Notification.findByIdAndDelete(notifB1._id),
      );

      const { status } = await call(notifC.markAllRead, { user: userA });
      assert.equal(status, 200);

      const [reluA1, reluA2, reluB1] = await Promise.all([
        Notification.findById(notifA1._id).lean(),
        Notification.findById(notifA2._id).lean(),
        Notification.findById(notifB1._id).lean(),
      ]);
      assert.equal(reluA1.lu, true, 'la notification de userA doit être marquée lue');
      assert.equal(reluA2.lu, true, 'la notification de userA doit être marquée lue');
      assert.ok(reluA1.lu_at, 'lu_at doit être renseigné');
      assert.equal(reluB1.lu, false, 'markAllRead appelé par userA ne doit pas marquer la notification de userB comme lue');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
