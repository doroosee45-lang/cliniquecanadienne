// AUDIT-20-10 (19 sept. 2026, audit indépendant) —
// hr.controller.js::genererPlanningIA et publishSchedules, deux bugs
// distincts, jamais audités jusqu'ici :
//
// (a) genererPlanningIA — staffList chargé une fois, puis un appel réseau
//     OpenAI intercalé (plusieurs secondes en conditions réelles), puis
//     mutation en mémoire de staff.planning + Promise.all(staffList.map(s
//     => s.save())) en toute fin de fonction. Deux caractéristiques
//     distinctes de ce bug, vérifiées séparément ci-dessous avec des
//     résultats différents :
//       - perte d'un addSchedule concurrent par écrasement du save()
//         tardif : tentative de reproduction sérieuse (addSchedule
//         déclenché PENDANT le délai simulant l'appel OpenAI), mais NON
//         REPRODUITE, même sur l'ancien code — cohérent avec le constat
//         déjà établi en AUDIT-20-8 : un simple push() en fin de tableau
//         (ici staff.planning.push dans genererPlanningIA, comme
//         addSchedule) n'entre pas en conflit de version sous Mongoose,
//         les deux $push finissent par coexister. Disclosure honnête, pas
//         de reproduction forcée.
//       - un employé en échec de sauvegarde (VersionError ou, comme
//         reproduit ci-dessous, suppression pendant l'appel IA) faisait
//         échouer le Promise.all ENTIER : CONFIRMÉ ET REPRODUIT — sur
//         l'ancien code, un seul employé supprimé entre-temps fait
//         échouer toute la fonction (500), y compris pour les employés
//         parfaitement valides dont le créneau est alors perdu lui aussi.
//     Corrigé en $push atomique ($each) PAR EMPLOYÉ via findByIdAndUpdate,
//     même motif qu'addSchedule — staff.planning.push en mémoire est
//     conservé UNIQUEMENT pour que les vérifications intra-lot
//     (dejaPlanifie, repos après nuit) restent correctes, jamais persisté
//     via save(). Un échec isolé sur un employé n'affecte plus les autres.
//
// (b) publishSchedules — notifications (email + SMS) envoyées dans la
//     boucle, mais statut:'publie'/notifie_publication:true n'étaient
//     persistés qu'une seule fois, via un seul staff.save() en fin de
//     boucle groupée. CONFIRMÉ ET REPRODUIT (script de vérification
//     ad hoc, non committé — staff.save() stubbé pour échouer après
//     l'envoi réussi des 2 notifications) : sur l'ancien code, les 2
//     emails partent réellement, staff.save() échoue ensuite, RIEN n'est
//     persisté (les 2 créneaux restent 'brouillon'), et un nouvel appel
//     renvoie intégralement les 2 mêmes notifications en double —
//     exactement le scénario redouté. Corrigé en persistant chaque
//     créneau (findOneAndUpdate + arrayFilters) immédiatement après
//     l'envoi de SES notifications. Le test ci-dessous cible le nouveau
//     point de persistance critique (Staff.findOneAndUpdate, puisque
//     staff.save() n'existe plus dans le code corrigé) — adaptation
//     fidèle de l'intention du test suggéré, pas une transcription
//     littérale d'un appel qui n'existe plus après le correctif.
//
// Données synthétiques de démonstration — aucune donnée réelle. Aucun
// appel réseau OpenAI/email/SMS réel : ai.generateReport et
// mail.sendPlanningPublishedEmail sont stubbés (même convention que
// tests/aiChatAssistant.test.js et tests/planningPublish.test.js).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  let error = null;
  await fn(req, res, (err) => { error = err; if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
  return { status, body, error };
};

test('AUDIT-20-10 — hr.controller.js::genererPlanningIA/publishSchedules atomiques (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const hrC = require('../controllers/hr.controller');
  const openai = require('../utils/openai');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Test', nom: 'Concurrence' };
  const serviceId = new mongoose.Types.ObjectId();
  const created = [];

  const originalGenerateReport = openai.generateReport;
  const originalIsConfigured = openai.isConfigured;
  const originalSendEmail = mailModule.sendPlanningPublishedEmail;
  const originalFindOneAndUpdate = Staff.findOneAndUpdate.bind(Staff);

  try {
    await t.test('genererPlanningIA — non-régression : un addSchedule concurrent pendant l\'appel IA (simulé lent) n\'est jamais écrasé par la sauvegarde tardive (non reproduit sur l\'ancien code, corrigé quand même par cohérence)', async () => {
      const staffA = await Staff.create({ nom: `Audit2010A-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', service: serviceId });
      const staffB = await Staff.create({ nom: `Audit2010B-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', service: serviceId });
      created.push(staffA._id, staffB._id);

      openai.isConfigured = () => true;
      openai.generateReport = async () => {
        // Simule la latence réelle d'un appel réseau OpenAI : c'est
        // PENDANT ce délai que le test déclenche un addSchedule concurrent.
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          content: JSON.stringify([
            { employe_id: staffA._id.toString(), date: '2026-11-02', creneau: 'matin' },
            { employe_id: staffB._id.toString(), date: '2026-11-02', creneau: 'soir' },
          ]),
        };
      };

      const genPromise = hrC.genererPlanningIA(
        { user: admin, body: { service_id: serviceId.toString(), date_debut: '2026-11-01', date_fin: '2026-11-07' } },
        { status: () => ({ json: () => {} }), json: () => {} },
        () => {}
      );
      // Laisse le temps à genererPlanningIA de charger staffList et de
      // partir dans l'appel IA stubbé (300ms) avant de déclencher la
      // concurrence — reproduit fidèlement la fenêtre réelle décrite.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const addPromise = call(hrC.addSchedule, { params: { id: staffA._id.toString() }, user: admin, body: { date: '2026-11-03', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } });

      const [, addResult] = await Promise.all([genPromise, addPromise]);
      assert.equal(addResult.status, 200, JSON.stringify(addResult.body));

      const freshA = await Staff.findById(staffA._id);
      const aIA = freshA.planning.find(p => new Date(p.date).toISOString().substring(0, 10) === '2026-11-02');
      const aConcurrent = freshA.planning.find(p => new Date(p.date).toISOString().substring(0, 10) === '2026-11-03');
      assert.ok(aIA, 'le créneau proposé par l\'IA doit être persisté');
      assert.ok(aConcurrent, 'le créneau ajouté par addSchedule PENDANT l\'appel IA ne doit jamais être perdu — c\'est le bug AUDIT-20-10(a)');
      assert.equal(freshA.planning.length, 2, 'les deux créneaux doivent coexister, aucun écrasé par l\'autre');

      const freshB = await Staff.findById(staffB._id);
      assert.equal(freshB.planning.length, 1, 'staffB doit avoir reçu son créneau IA, indépendamment de staffA');
    });

    await t.test('genererPlanningIA — un employé supprimé pendant l\'appel IA n\'empêche pas la persistance des autres (isolation par employé)', async () => {
      const staffC = await Staff.create({ nom: `Audit2010C-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', service: serviceId });
      const staffD = await Staff.create({ nom: `Audit2010D-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', service: serviceId });
      created.push(staffC._id, staffD._id);

      openai.isConfigured = () => true;
      openai.generateReport = async () => {
        await Staff.findByIdAndDelete(staffD._id); // supprimé pendant l'appel IA, avant la persistance finale
        return {
          content: JSON.stringify([
            { employe_id: staffC._id.toString(), date: '2026-11-10', creneau: 'matin' },
            { employe_id: staffD._id.toString(), date: '2026-11-10', creneau: 'soir' },
          ]),
        };
      };

      const { status, body } = await call(hrC.genererPlanningIA, { user: admin, body: { service_id: serviceId.toString(), date_debut: '2026-11-08', date_fin: '2026-11-14' } });
      assert.equal(status, 200, JSON.stringify(body));

      const freshC = await Staff.findById(staffC._id);
      assert.equal(freshC.planning.length, 1, 'staffC doit être persisté même si staffD a disparu — un échec isolé ne doit jamais bloquer les autres employés (contrairement à l\'ancien Promise.all([...save()]) qui échouait entièrement)');
    });

    await t.test('publishSchedules — une panne juste après la persistance du créneau 1 laisse le créneau 1 réellement publié, idempotent au retry', async () => {
      const staff = await Staff.create({ nom: `Audit2010E-${stamp}`, prenom: 'Test', poste: 'infirmier', statut: 'actif', email: `audit2010e-${stamp}@_test.local` });
      created.push(staff._id);

      const noop = { status: () => ({ json: () => {} }), json: () => {} };
      await hrC.addSchedule({ params: { id: staff._id.toString() }, user: admin, body: { date: '2026-11-20', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } }, noop, () => {});
      await hrC.addSchedule({ params: { id: staff._id.toString() }, user: admin, body: { date: '2026-11-21', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } }, noop, () => {});

      const sentEmails = [];
      mailModule.sendPlanningPublishedEmail = async (opts) => { sentEmails.push(opts); return { simulated: true }; };

      let calls = 0;
      Staff.findOneAndUpdate = function (...args) {
        calls++;
        if (calls === 1) return originalFindOneAndUpdate(...args);
        Staff.findOneAndUpdate = originalFindOneAndUpdate;
        throw new Error('Panne simulée juste après la persistance du créneau 1');
      };

      const r1 = await call(hrC.publishSchedules, { params: { id: staff._id.toString() }, user: admin });
      assert.ok(r1.error, 'la panne simulée doit être propagée (next(err)), publishSchedules doit s\'arrêter net');
      assert.equal(sentEmails.length, 2, 'les 2 notifications ont bien été envoyées avant la panne (l\'échec survient après coup, à la persistance)');

      const mid = await Staff.findById(staff._id);
      const slot1 = mid.planning.find(p => new Date(p.date).toISOString().substring(0, 10) === '2026-11-20');
      const slot2 = mid.planning.find(p => new Date(p.date).toISOString().substring(0, 10) === '2026-11-21');
      assert.equal(slot1.statut, 'publie', 'le créneau 1 doit être réellement persisté malgré la panne survenue APRÈS lui — c\'est le correctif AUDIT-20-10(b)');
      assert.equal(slot2.statut, 'brouillon', 'le créneau 2 n\'a jamais été atteint par la panne, il reste correctement en brouillon');

      sentEmails.length = 0;
      const r2 = await call(hrC.publishSchedules, { params: { id: staff._id.toString() }, user: admin });
      assert.equal(r2.status, 200, JSON.stringify(r2.body));
      assert.equal(r2.body.publies, 1, 'seul le créneau 2 restant doit être traité au retry');
      assert.equal(sentEmails.length, 1, 'le créneau 1 déjà publié ne doit JAMAIS renvoyer sa notification — c\'est exactement le bug de duplication que ce correctif élimine');
    });
  } finally {
    openai.generateReport = originalGenerateReport;
    openai.isConfigured = originalIsConfigured;
    mailModule.sendPlanningPublishedEmail = originalSendEmail;
    Staff.findOneAndUpdate = originalFindOneAndUpdate;
    for (const id of created) await Staff.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
