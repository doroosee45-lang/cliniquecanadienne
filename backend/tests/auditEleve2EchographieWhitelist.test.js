// Audit élevé 2/9 — echographieController.js::update n'avait aucune liste
// noire de champs, contrairement à tous les autres contrôleurs cliniques
// (radiology, prescriptions) : n'importe quel rôle autorisé sur la route
// générique (dont infirmier/sage_femme) pouvait positionner
// statut:'validee'/rapport_statut/rapport_radiologue/conclusion directement.
// PUT /:id/rapport (saveRapport) est désormais restreint à
// radiologue/superadmin au niveau de la route, miroir de radiology.routes.js
// (/cr, /rapport, /validation).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

test('Audit élevé 2 — liste blanche Echographie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Echographie = require('../models/Echographie');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const infirmier = { _id: new mongoose.Types.ObjectId(), role: 'infirmier', prenom: 'Test', nom: 'Infirmier' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('update() — les champs de validation de rapport sont désormais bloqués, même pour un rôle autorisé sur la route générique', async () => {
      const demande = await Echographie.create({ patient: `T-ELEVE2-${stamp}`, motif: 'Motif initial' });
      cleanup.push(() => Echographie.findByIdAndDelete(demande._id));

      const { status, body } = await call(echoC.update, {
        params: { id: demande._id },
        body: {
          motif: 'Motif modifié — légitime',
          statut: 'validee',
          rapport_statut: 'valide',
          rapport_radiologue: 'Dr. Faux Radiologue',
          conclusion: 'Conclusion inventée par un rôle non autorisé',
          rapport_texte: 'Texte inventé',
          recommandations: 'Recommandations inventées',
        },
        user: infirmier, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.demande.motif, 'Motif modifié — légitime', 'un champ légitime hors liste noire doit toujours fonctionner (non-régression)');

      const fresh = await Echographie.findById(demande._id).lean();
      assert.equal(fresh.statut, 'en_attente', 'statut ne doit jamais être modifiable via update() générique');
      assert.equal(fresh.rapport_statut, undefined, 'rapport_statut ne doit jamais être modifiable via update()');
      assert.equal(fresh.rapport_radiologue, undefined);
      assert.equal(fresh.conclusion, undefined, 'conclusion ne doit jamais être modifiable via update() — doit passer par saveRapport()');
      assert.equal(fresh.rapport_texte, undefined);
      assert.equal(fresh.recommandations, undefined);
    });

    await t.test('update() — patient/patient_ref/numero (identité) restent aussi protégés', async () => {
      const demande = await Echographie.create({ patient: `T-ELEVE2B-${stamp}`, numero: `ECH-TEST-${stamp}` });
      cleanup.push(() => Echographie.findByIdAndDelete(demande._id));
      const numeroAvant = demande.numero;

      await call(echoC.update, {
        params: { id: demande._id },
        body: { patient: 'Nom usurpé', numero: 'ECH-USURPE-0000' },
        user: infirmier, ip: '127.0.0.1',
      });

      const fresh = await Echographie.findById(demande._id).lean();
      assert.equal(fresh.patient, `T-ELEVE2B-${stamp}`, 'patient (identité) ne doit pas être modifiable via update()');
      assert.equal(fresh.numero, numeroAvant, 'numero ne doit pas être modifiable via update()');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});

test('Audit élevé 2 — PUT /:id/rapport restreint à radiologue/superadmin (serveur isolé réel)', { skip: !mongodExists() && 'mongod introuvable' }, async (t) => {
  const server = await startIsolatedServer();
  await mongoose.connect(server.mongoUri);
  const User = require('../models/User');
  const Echographie = require('../models/Echographie');

  const PASSWORD = 'Eleve2Test2026!';
  const stamp = Date.now();
  const cookies = {};
  const roles = ['radiologue', 'superadmin', 'infirmier', 'sage_femme', 'medecin', 'adminclinique'];

  const login = async (email) => {
    const res = await fetch(`${server.baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    return (res.headers.get('set-cookie') || '').split(';')[0];
  };

  try {
    for (const role of roles) {
      const email = `_eleve2-${role}@_test.local`;
      await User.create({ email, password: PASSWORD, nom: 'T', prenom: role, role, statut: 'actif' });
      cookies[role] = await login(email);
    }

    for (const role of ['infirmier', 'sage_femme', 'medecin', 'adminclinique']) {
      await t.test(`PUT /echographie/:id/rapport — ${role} refusé (403)`, async () => {
        const demande = await Echographie.create({ patient: `T-ELEVE2-ROUTE-${stamp}-${role}` });
        const res = await fetch(`${server.baseUrl}/echographie/${demande._id}/rapport`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookies[role] },
          body: JSON.stringify({ rapport_statut: 'valide' }),
        });
        assert.equal(res.status, 403, `${role} ne doit plus pouvoir valider un rapport d'échographie`);
        await Echographie.findByIdAndDelete(demande._id);
      });
    }

    for (const role of ['radiologue', 'superadmin']) {
      await t.test(`PUT /echographie/:id/rapport — ${role} continue de fonctionner normalement (non-régression)`, async () => {
        const demande = await Echographie.create({ patient: `T-ELEVE2-ROUTE-OK-${stamp}-${role}` });
        const res = await fetch(`${server.baseUrl}/echographie/${demande._id}/rapport`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookies[role] },
          body: JSON.stringify({ rapport_statut: 'valide', conclusion: 'Conclusion réelle' }),
        });
        assert.equal(res.status, 200, `${role} doit toujours pouvoir valider un rapport (non-régression)`);
        const body = await res.json();
        assert.equal(body.demande.rapport_statut, 'valide');
        assert.equal(body.demande.statut, 'validee');
        await Echographie.findByIdAndDelete(demande._id);
      });
    }
  } finally {
    for (const role of roles) await User.deleteOne({ email: `_eleve2-${role}@_test.local` });
    await mongoose.disconnect();
    await server.stop();
  }
});
