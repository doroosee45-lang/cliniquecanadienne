// AUDIT-ANALYTICS-P1 — vérifie deux points réels du Phase 1 :
// 1. periode='custom' (date_debut/date_fin) filtre réellement getStats(),
//    au lieu de retomber silencieusement sur "mois" (startOf('custom')
//    n'existait pas) — la borne de fin (fin) est indispensable, sinon un
//    date_fin dans le passé n'aurait aucun effet.
// 2. POST /analytics/report/email envoie réellement un email par
//    destinataire actif du rôle choisi (jamais de consolidation), tracé en
//    AuditLog. mail.sendAnalyticsReportEmail est stubbée (même convention
//    que les autres tests d'intégration de ce projet).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 1 — période personnalisée réelle + envoi email par rôle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const analyticsC = require('../controllers/analytics.controller');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  // Fenêtre 2032 dédiée à ce test — aucune vraie donnée de production ne
  // peut s'y trouver, évite tout comptage pollué par de vraies données.
  const inside  = new Date('2032-03-15T10:00:00Z');
  const before  = new Date('2031-12-31T10:00:00Z');
  const after   = new Date('2032-07-01T10:00:00Z');

  const createdPatients = [];

  try {
    const pIn  = await Patient.create({ nom: `T-ANLP1-in-${stamp}`,  prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    const pOut1= await Patient.create({ nom: `T-ANLP1-out1-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    const pOut2= await Patient.create({ nom: `T-ANLP1-out2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    createdPatients.push(pIn, pOut1, pOut2);
    // $set direct sur createdAt : Mongoose réécrit createdAt à la création
    // (timestamps:true), donc l'override doit se faire après coup.
    // Patient.createdAt est schema-marqué immutable:true (timestamps:true
    // le fait automatiquement) — Mongoose bloque silencieusement tout $set
    // dessus, même via updateOne() direct (confirmé : modifiedCount:1 mais
    // la valeur ne bouge jamais en relisant le document). Seule l'écriture
    // via le driver natif (collection.updateOne, qui ne passe pas par la
    // couche de cast/immutable de Mongoose) permet de antidater ces
    // fixtures de test — jamais utilisé en dehors d'un test.
    await Patient.collection.updateOne({ _id: pIn._id },   { $set: { createdAt: inside } });
    await Patient.collection.updateOne({ _id: pOut1._id }, { $set: { createdAt: before } });
    await Patient.collection.updateOne({ _id: pOut2._id }, { $set: { createdAt: after } });

    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('periode=custom filtre réellement (date_debut/date_fin respectés)', async () => {
      body = null; status = 200;
      await analyticsC.getStats({ query: { periode: 'custom', date_debut: '2032-01-01', date_fin: '2032-06-30' } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.kpi.patients_nouveaux, 1, 'seul le patient du 15 mars 2032 doit être compté — pas ceux de déc. 2031 ni juillet 2032');
    });

    await t.test('la borne de fin (date_fin) est réellement respectée, pas seulement la borne de début', async () => {
      // date_fin fixé AVANT le patient "inside" (15 mars) : sans borne haute
      // réelle, une requête { $gte: debut } inclurait implicitement tout
      // jusqu'à maintenant et compterait ce patient à tort.
      body = null; status = 200;
      await analyticsC.getStats({ query: { periode: 'custom', date_debut: '2032-01-01', date_fin: '2032-03-10' } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.kpi.patients_nouveaux, 0, 'le patient du 15 mars doit être exclu par une fin de fenêtre fixée au 10 mars');
    });

    await t.test('une fenêtre ne couvrant aucun des 3 patients renvoie 0', async () => {
      body = null; status = 200;
      await analyticsC.getStats({ query: { periode: 'custom', date_debut: '2032-08-01', date_fin: '2032-09-01' } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.kpi.patients_nouveaux, 0);
    });

    // ── Envoi rapport par rôle ──────────────────────────────────────
    const originalSendAnalyticsReportEmail = mailModule.sendAnalyticsReportEmail;
    const sent = [];
    mailModule.sendAnalyticsReportEmail = async (opts) => { sent.push(opts); return { simulated: true }; };

    const staffUser = await User.create({
      email: `_t-anlp1-${stamp}@_test.local`, password: 'Xx1aaaaa',
      nom: 'Test', prenom: 'ANLP1', role: 'comptable', statut: 'actif',
    });
    const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };

    try {
      await t.test('sendReportEmail envoie un email par destinataire actif du rôle, sans consolidation', async () => {
        body = null; status = 200;
        await analyticsC.sendReportEmail({
          user: admin, ip: '127.0.0.1',
          body: { role: 'comptable', attachment: { filename: 'rapport-test.pdf', contentBase64: Buffer.from('PDF-CONTENT-TEST').toString('base64') } },
        }, res, () => {});
        assert.equal(status, 200);
        assert.ok(body.envoyes >= 1, 'au moins notre utilisateur de test comptable doit recevoir le rapport');
        const mine = sent.filter(s => s.email === staffUser.email);
        assert.equal(mine.length, 1, 'un seul email pour ce destinataire — pas de doublon');
      });

      await t.test('rôle invalide rejeté (400)', async () => {
        body = null; status = 200;
        await analyticsC.sendReportEmail({
          user: admin, ip: '127.0.0.1',
          body: { role: 'patient', attachment: { filename: 'x.pdf', contentBase64: 'AAAA' } },
        }, res, () => {});
        assert.equal(status, 400, '"patient" ne doit jamais être un rôle destinataire valide pour ce rapport');
      });

      await t.test('AuditLog trace l\'envoi (module analytics, action ANALYTICS_REPORT_EMAIL)', async () => {
        const log = await AuditLog.findOne({ module: 'analytics', action: 'ANALYTICS_REPORT_EMAIL' }).sort('-createdAt');
        assert.ok(log);
        assert.match(log.message, /comptable/);
      });
    } finally {
      mailModule.sendAnalyticsReportEmail = originalSendAnalyticsReportEmail;
      await User.findByIdAndDelete(staffUser._id);
      await AuditLog.deleteMany({ module: 'analytics', action: 'ANALYTICS_REPORT_EMAIL', createdAt: { $gte: new Date(stamp) } });
    }
  } finally {
    await Patient.deleteMany({ _id: { $in: createdPatients.map(p => p._id) } });
    await mongoose.disconnect();
  }
});
