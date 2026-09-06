// Sous-phase 5.7 (relecture du 6 sept. 2026) — Audit.jsx : "Enquêter"/
// "Clôturer" mutaient uniquement l'état React local, jamais persisté —
// getSuspects() (audit.controller.js) recalcule un tableau de suspects
// entièrement SYNTHÉTIQUE depuis AuditLog à chaque appel (_id: `brute_${ip}`
// / `denied_${userId}`, jamais un document réel), donc le statut revenait
// systématiquement à "ouvert" au moindre rechargement. "Notifier admin"
// affichait un faux succès sans le moindre envoi. "Créer alerte" poussait un
// objet local qui disparaissait au rechargement de l'onglet.
//
// Corrigé via un nouveau modèle AuditAlert : overlay de statut réel sur un
// suspect calculé (alert_id = l'_id synthétique), alertes manuelles
// réellement persistées (source:'manuel'), et notification réelle
// (Notification, déjà réelle) à chaque administrateur réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.7 (Audit) — alertes suspectes réellement persistées, notification réelle', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const AuditAlert = require('../models/AuditAlert');
  const Notification = require('../models/Notification');
  const User = require('../models/User');
  const auditC = require('../controllers/audit.controller');

  const stamp = Date.now();
  const created = { logs: [], alerts: [], users: [], notifications: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const admin1 = await User.create({ email: `_57audit-admin1-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin1', prenom: '57', role: 'superadmin', statut: 'actif' });
    const admin2 = await User.create({ email: `_57audit-admin2-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin2', prenom: '57', role: 'adminclinique', statut: 'actif' });
    const nonAdmin = await User.create({ email: `_57audit-nonadmin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'NonAdmin', prenom: '57', role: 'medecin', statut: 'actif' });
    created.users.push(admin1._id, admin2._id, nonAdmin._id);

    // IP unique (stampée) pour isolation garantie : 3 échecs de connexion réels.
    const ipTest = `10.57.${stamp % 250}.1`;
    for (let i = 0; i < 3; i++) {
      const log = await AuditLog.create({ action: 'LOGIN_ECHEC', ip_address: ipTest, statut: 'echec', module: 'auth' });
      created.logs.push(log._id);
    }

    let syntheticId;
    await t.test("getSuspects() calcule réellement un suspect brute-force pour l'IP réelle, statut réel 'ouvert' au départ", async () => {
      const { status, body } = await call(auditC.getSuspects, {});
      assert.equal(status, 200, JSON.stringify(body));
      const suspect = body.suspects.find(s => s.utilisateur === `IP: ${ipTest}`);
      assert.ok(suspect, "le suspect calculé depuis nos 3 vrais échecs doit apparaître");
      assert.equal(suspect.statut, 'ouvert');
      syntheticId = suspect._id;
    });

    await t.test("updateSuspectStatut() persiste réellement le statut — reflété par getSuspects() même après un recalcul complet (AVANT : toujours réinitialisé à 'ouvert')", async () => {
      const { status, body } = await call(auditC.updateSuspectStatut, { params: { id: syntheticId }, body: { statut: 'en_enquete' }, user: admin1 });
      assert.equal(status, 200, JSON.stringify(body));
      created.alerts.push(body.alert._id);

      const { body: b2 } = await call(auditC.getSuspects, {});
      const suspect = b2.suspects.find(s => s._id === syntheticId);
      assert.equal(suspect.statut, 'en_enquete', "le statut réel doit persister à travers un recalcul complet du tableau synthétique");

      await call(auditC.updateSuspectStatut, { params: { id: syntheticId }, body: { statut: 'cloture' }, user: admin1 });
      const { body: b3 } = await call(auditC.getSuspects, {});
      const suspectApresCloture = b3.suspects.find(s => s._id === syntheticId);
      assert.equal(suspectApresCloture.statut, 'cloture');
    });

    await t.test("notifySuspect() crée une vraie Notification pour chaque admin réel, jamais pour un non-admin", async () => {
      const { status, body } = await call(auditC.notifySuspect, {
        params: { id: syntheticId },
        body: { type: 'Tentatives de force brute', utilisateur: `IP: ${ipTest}`, description: `Test57 — ${ipTest}` },
      });
      assert.equal(status, 200, JSON.stringify(body));
      // Base Atlas réelle partagée entre sessions : d'autres comptes
      // superadmin/adminclinique réels peuvent déjà exister — preuve forte
      // ci-dessous (nos 2 admins précisément notifiés, le non-admin jamais).
      assert.ok(body.notifies >= 2, `doit notifier au moins nos 2 admins réels, obtenu ${body.notifies}`);

      const notifAdmin1 = await Notification.findOne({ destinataire: admin1._id, message: { $regex: 'Test57' } });
      const notifAdmin2 = await Notification.findOne({ destinataire: admin2._id, message: { $regex: 'Test57' } });
      const notifNonAdmin = await Notification.findOne({ destinataire: nonAdmin._id, message: { $regex: 'Test57' } });
      assert.ok(notifAdmin1, 'une vraie Notification doit exister pour le premier admin');
      assert.ok(notifAdmin2, 'une vraie Notification doit exister pour le second admin');
      assert.equal(notifNonAdmin, null, 'un non-admin ne doit jamais être notifié');
      created.notifications.push(notifAdmin1._id, notifAdmin2._id);
    });

    await t.test("createAlert() persiste réellement une alerte manuelle, réapparaît dans getSuspects()", async () => {
      const { status, body } = await call(auditC.createAlert, {
        body: { type: 'Activité critique signalée', utilisateur: `Test57-manuel-${stamp}`, description: 'Description test57', severite: 'critique' },
        user: admin1,
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.alerts.push(body.alert._id);

      const { body: b2 } = await call(auditC.getSuspects, {});
      const manuelle = b2.suspects.find(s => s.utilisateur === `Test57-manuel-${stamp}`);
      assert.ok(manuelle, "l'alerte créée manuellement doit réellement réapparaître dans le calcul, contrairement à l'ancien objet local perdu au rechargement");
      assert.equal(manuelle.statut, 'ouvert');
    });
  } finally {
    await Notification.deleteMany({ _id: { $in: created.notifications } });
    await AuditAlert.deleteMany({ _id: { $in: created.alerts } });
    await AuditLog.deleteMany({ _id: { $in: created.logs } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
