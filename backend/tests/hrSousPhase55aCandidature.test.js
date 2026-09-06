// Sous-phase 5.5.a (Recrutement) — l'onglet "Recrutement" de HR.jsx a été
// honnêtement désactivé en 5.7 : "Convoquer"/"Sélectionner" ne faisaient que
// muter un état React local (candidatures[], _id: Date.now().toString()),
// perdu au rechargement. Ce test prouve la persistance réelle du nouveau
// modèle Candidature (création → relecture après un getCandidatures() frais,
// donc pas juste l'objet renvoyé par create), et que authorize(...ADMIN)
// bloque bien un rôle non-admin sur ces routes — la même fonction middleware
// que celle réellement montée dans hr.routes.js, appelée directement (pas de
// serveur HTTP complet ici, volontairement : ce n'est pas un test de
// complaisance, authorize() n'est pas rejouée dans un mock, c'est la vraie
// fonction du projet).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.5.a (Recrutement) — CRUD Candidature réel + 403 non-admin', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Candidature = require('../models/Candidature');
  const hrC = require('../controllers/hr.controller');
  const { authorize } = require('../middleware/auth');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const created = { candidatures: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    let candId;

    await t.test('createCandidature persiste réellement un document Candidature', async () => {
      const { status, body } = await call(hrC.createCandidature, {
        user: admin, ip: '127.0.0.1',
        body: { nom: `Test55a-${stamp}`, poste: 'infirmier', experience: '3 ans', diplome: 'IDE', email: `test55a-${stamp}@_test.local`, telephone: '0600000000' },
      });
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.candidature._id);
      candId = body.candidature._id;
      created.candidatures.push(candId);

      const fresh = await Candidature.findById(candId).lean();
      assert.ok(fresh, 'doit exister réellement en base, pas seulement dans la réponse HTTP');
      assert.equal(fresh.statut, 'recu');
      assert.equal(fresh.nom, `Test55a-${stamp}`);
    });

    await t.test('createCandidature sans nom est rejeté (400), rien n\'est persisté', async () => {
      const before = await Candidature.countDocuments();
      const { status } = await call(hrC.createCandidature, { user: admin, ip: '127.0.0.1', body: { poste: 'infirmier' } });
      assert.equal(status, 400);
      const after = await Candidature.countDocuments();
      assert.equal(after, before, 'aucun document ne doit être créé sur un rejet 400');
    });

    await t.test('getCandidatures() retrouve la candidature après un rechargement (nouvel appel, pas le même objet)', async () => {
      const { status, body } = await call(hrC.getCandidatures, {});
      assert.equal(status, 200);
      const mine = body.candidatures.find(c => String(c._id) === String(candId));
      assert.ok(mine, 'doit réapparaître dans un getCandidatures() frais');
      assert.equal(mine.statut, 'recu');
    });

    await t.test('updateCandidatureStatut ("Convoquer" → entretien) persiste à travers un rechargement complet', async () => {
      const { status, body } = await call(hrC.updateCandidatureStatut, { params: { id: candId }, user: admin, ip: '127.0.0.1', body: { statut: 'entretien' } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.candidature.statut, 'entretien');

      // Preuve anti-"faux succès" : relecture par un getCandidatures() frais,
      // pas seulement la réponse du PUT — exactement le bug de 5.7.
      const { body: reloaded } = await call(hrC.getCandidatures, {});
      const mine = reloaded.candidatures.find(c => String(c._id) === String(candId));
      assert.equal(mine.statut, 'entretien');
    });

    await t.test('updateCandidatureStatut ("Sélectionner" → selectionne) idem', async () => {
      await call(hrC.updateCandidatureStatut, { params: { id: candId }, user: admin, ip: '127.0.0.1', body: { statut: 'selectionne' } });
      const fresh = await Candidature.findById(candId).lean();
      assert.equal(fresh.statut, 'selectionne');
    });

    await t.test('updateCandidatureStatut avec un statut invalide est rejeté (400), n\'altère pas le document', async () => {
      const { status } = await call(hrC.updateCandidatureStatut, { params: { id: candId }, user: admin, ip: '127.0.0.1', body: { statut: 'embauche_sur_le_champ' } });
      assert.equal(status, 400);
      const fresh = await Candidature.findById(candId).lean();
      assert.equal(fresh.statut, 'selectionne', 'inchangé après un rejet 400');
    });

    await t.test('authorize(...ADMIN) — le rôle réellement monté sur ces routes — refuse un rôle non-admin (403)', async () => {
      let status = 200, body = null, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'infirmier' }, baseUrl: '/hr', originalUrl: '/hr/candidatures', method: 'POST', ip: '127.0.0.1' };
      const ADMIN = ['superadmin', 'adminclinique'];
      await authorize(...ADMIN)(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false, 'next() ne doit jamais être appelé — la requête doit s\'arrêter au refus');
      assert.equal(body.success, false);
    });

    await t.test('authorize(...ADMIN) laisse passer un rôle admin réel', async () => {
      let status = 200, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'adminclinique' }, baseUrl: '/hr', originalUrl: '/hr/candidatures', method: 'POST', ip: '127.0.0.1' };
      const ADMIN = ['superadmin', 'adminclinique'];
      await authorize(...ADMIN)(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
      assert.equal(status, 200, 'authorize() ne doit pas avoir touché au status en cas de succès');
    });
  } finally {
    await Candidature.deleteMany({ _id: { $in: created.candidatures } });
    await mongoose.disconnect();
  }
});
