// AUDIT-P6-1 — comble l'angle mort signalé après clôture de P6-1 :
// auditP6-1LaboratoirePrelevementResultats.test.js prouve que le
// contrôleur validate() notifie bien le médecin quand on lui fournit
// { est_critique: true } — mais construit ce payload à la main, sans
// jamais exercer la logique frontend qui le calcule réellement dans
// Laboratory.jsx::validerAnalyse.
//
// Ce test importe directement ../../frontend/src/utils/labResultats.js
// (deriveCriticalPayload / REF_VALUES — le module que la page importe
// aussi), pour prouver la chaîne complète : des statut_res saisis à
// l'étape "Résultats" -> calcul frontend réel -> appel du contrôleur
// réel -> notification réellement persistée en base pour le médecin
// prescripteur. Si ce fichier partagé divergeait un jour de ce que la
// page utilise, ce test échouerait — contrairement à un payload
// reconstitué à la main qui resterait vert même après une régression
// frontend.
//
// Réouvert (décision explicite) : est_critique n'est plus purement dérivé
// des statut_res. Laboratory.jsx pré-coche une case "résultat critique"
// avec deriveCriticalPayload() quand la modale de validation s'ouvre, mais
// c'est l'état de la case au moment de la signature qui est envoyé — le
// biologiste peut la décocher (résultat détecté mais jugé non critique
// après relecture) ou la cocher (rien détecté, mais critique cliniquement).
// simulateEstCritiqueConfirme() ci-dessous mirror exactement ce mécanisme
// en deux temps (pré-remplissage puis override optionnel) en réutilisant la
// même fonction partagée deriveCriticalPayload — sans quoi ce test
// resterait vert même si le pré-remplissage réel de la case divergeait de
// la détection.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

const { REF_VALUES, deriveCriticalPayload } = require(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'labResultats.js'));

function simulateEstCritiqueConfirme(resultats, biologisteOverride) {
  const { est_critique: preCoche } = deriveCriticalPayload(resultats, REF_VALUES);
  return biologisteOverride === undefined ? preCoche : biologisteOverride;
}

test('laboratoire — chaîne complète frontend réel -> validate() -> notification (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const labC = require('../controllers/laboratory.controller');
  const LabResult = require('../models/LabResult');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Notification = require('../models/Notification');

  const stamp = Date.now();
  const medecin = await User.create({ email: `_e2e-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Prescripteur', prenom: 'E2E', role: 'medecin', statut: 'actif' });
  const laborantin = await User.create({ email: `_e2e-laborantin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Labo', prenom: 'E2E', role: 'laborantin', statut: 'actif' });
  const patient = await Patient.create({ nom: 'PatientE2E', prenom: stamp.toString(), date_naissance: '1990-01-01', sexe: 'F' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [
    () => User.findByIdAndDelete(medecin._id),
    () => User.findByIdAndDelete(laborantin._id),
  ];
  // Patient supprimé après tous les LabResult créés plus bas, qui le
  // référencent encore (hook pre('findOneAndDelete') de Patient).
  const patientCleanup = [
    () => Patient.findByIdAndDelete(patient._id),
  ];

  try {
    const { body: created } = await call(labC.create, {
      user: laborantin,
      body: { patient: patient._id, medecin_prescripteur: medecin._id, examens_demandes: ['glycemie', 'hb'] },
    });
    const labId = created.result._id;
    cleanup.push(() => LabResult.findByIdAndDelete(labId));

    await t.test("saisie des résultats : glycémie marquée critique par le technicien (statut_res réel, pas un payload de test)", async () => {
      const resultatsSaisis = [
        { exam_id: 'glycemie', valeur: '2.20', ref: REF_VALUES.glycemie.ref, unite: REF_VALUES.glycemie.unite, statut_res: 'critique' },
        { exam_id: 'hb', valeur: '13.5', ref: REF_VALUES.hb.ref, unite: REF_VALUES.hb.unite, statut_res: 'normal' },
      ];
      const { status } = await call(labC.saisirResultats, { params: { id: labId }, body: { resultats: resultatsSaisis }, user: laborantin });
      assert.equal(status, 200);
    });

    await t.test("validerAnalyse envoie l'état de la case (pré-cochée par deriveCriticalPayload, non modifiée par le biologiste ici)", async () => {
      const relu = await LabResult.findById(labId).lean();
      // Reproduit exactement ce que fait Laboratory.jsx en deux temps :
      // la modale de validation pré-coche la case depuis deriveCriticalPayload
      // (donc les vraies données persistées à l'étape précédente), puis
      // validerAnalyse() envoie l'état de la case, pas le calcul brut.
      const { valeurs_critiques } = deriveCriticalPayload(relu.resultats, REF_VALUES);
      const est_critique = simulateEstCritiqueConfirme(relu.resultats);
      assert.equal(est_critique, true, 'un statut_res:"critique" saisi doit pré-cocher la case (non modifiée ici)');
      assert.match(valeurs_critiques, /Glycémie/, 'le récapitulatif doit citer le résultat critique par son label réel');

      const payload = { resultats: relu.resultats, commentaires: 'Contrôle E2E', est_critique, valeurs_critiques };
      const { status } = await call(labC.validate, { params: { id: labId }, body: payload, user: laborantin });
      assert.equal(status, 200);
    });

    await t.test("la notification de résultat critique est réellement persistée pour le médecin prescripteur", async () => {
      const relu = await LabResult.findById(labId).lean();
      assert.equal(relu.est_critique, true, 'est_critique doit être réellement persisté en base');
      assert.equal(relu.statut, 'valide');

      const notif = await Notification.findOne({ destinataire: medecin._id, type: 'critical' }).lean();
      assert.ok(notif, 'une notification critique doit avoir été créée pour le médecin prescripteur, à partir du payload calculé par la logique frontend réelle');
      assert.match(notif.message, /Glycémie/);
      cleanup.push(() => Notification.findByIdAndDelete(notif._id));
    });

    await t.test("non-régression : aucun résultat critique saisi -> la case n'est pas pré-cochée, aucune notification supplémentaire créée", async () => {
      const { body: created2 } = await call(labC.create, {
        user: laborantin,
        body: { patient: patient._id, medecin_prescripteur: medecin._id, examens_demandes: ['hb'] },
      });
      const labId2 = created2.result._id;
      cleanup.push(() => LabResult.findByIdAndDelete(labId2));

      await call(labC.saisirResultats, {
        params: { id: labId2 },
        body: { resultats: [{ exam_id: 'hb', valeur: '14.0', ref: REF_VALUES.hb.ref, unite: REF_VALUES.hb.unite, statut_res: 'normal' }] },
        user: laborantin,
      });
      const relu2 = await LabResult.findById(labId2).lean();
      const est_critique = simulateEstCritiqueConfirme(relu2.resultats);
      assert.equal(est_critique, false, 'aucun statut_res:"critique" -> la case ne doit pas être pré-cochée');

      // Notification.entite_id n'existe pas sur ce schéma (createNotification
      // de validate() ne corrèle pas au LabResult) : seule une comparaison de
      // décompte avant/après, pas un filtre par identifiant, prouve
      // réellement qu'aucune notification supplémentaire n'a été créée.
      const avant = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      await call(labC.validate, { params: { id: labId2 }, body: { resultats: relu2.resultats, commentaires: '', est_critique, valeurs_critiques: '' }, user: laborantin });
      const apres = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      assert.equal(apres, avant, 'aucune notification critique supplémentaire ne doit être créée quand est_critique est false');
    });

    await t.test("décision de réouverture : le biologiste décoche une case pré-cochée -> est_critique:false envoyé, aucune notification", async () => {
      const { body: created3 } = await call(labC.create, {
        user: laborantin,
        body: { patient: patient._id, medecin_prescripteur: medecin._id, examens_demandes: ['creatinine'] },
      });
      const labId3 = created3.result._id;
      cleanup.push(() => LabResult.findByIdAndDelete(labId3));

      await call(labC.saisirResultats, {
        params: { id: labId3 },
        body: { resultats: [{ exam_id: 'creatinine', valeur: '25', ref: REF_VALUES.creatinine.ref, unite: REF_VALUES.creatinine.unite, statut_res: 'critique' }] },
        user: laborantin,
      });
      const relu3 = await LabResult.findById(labId3).lean();
      const preCoche = simulateEstCritiqueConfirme(relu3.resultats);
      assert.equal(preCoche, true, 'précondition : la case doit être pré-cochée par la détection avant que le biologiste ne la décoche');

      // Le biologiste juge, après relecture, que la notification n'est pas
      // justifiée et décoche la case — c'est exactement le scénario que la
      // dérivation automatique pure (avant cette réouverture) ne permettait
      // pas d'exprimer.
      const est_critique = simulateEstCritiqueConfirme(relu3.resultats, false);
      assert.equal(est_critique, false);

      const avant = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      const { status } = await call(labC.validate, { params: { id: labId3 }, body: { resultats: relu3.resultats, commentaires: 'Décoché après relecture', est_critique, valeurs_critiques: '' }, user: laborantin });
      assert.equal(status, 200);
      const apres = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      assert.equal(apres, avant, 'décocher une case pré-cochée doit réellement empêcher la notification, pas seulement changer l\'affichage');

      const releu3 = await LabResult.findById(labId3).lean();
      assert.equal(releu3.est_critique, false, 'la décision du biologiste (pas la détection automatique) doit être ce qui est persisté');
    });

    await t.test("décision de réouverture : le biologiste coche manuellement une case non pré-cochée -> est_critique:true envoyé, notification créée", async () => {
      const { body: created4 } = await call(labC.create, {
        user: laborantin,
        body: { patient: patient._id, medecin_prescripteur: medecin._id, examens_demandes: ['cholesterol'] },
      });
      const labId4 = created4.result._id;
      cleanup.push(() => LabResult.findByIdAndDelete(labId4));

      await call(labC.saisirResultats, {
        params: { id: labId4 },
        body: { resultats: [{ exam_id: 'cholesterol', valeur: '1.9', ref: REF_VALUES.cholesterol.ref, unite: REF_VALUES.cholesterol.unite, statut_res: 'normal' }] },
        user: laborantin,
      });
      const relu4 = await LabResult.findById(labId4).lean();
      const preCoche = simulateEstCritiqueConfirme(relu4.resultats);
      assert.equal(preCoche, false, 'précondition : rien détecté, la case ne doit pas être pré-cochée avant que le biologiste ne la coche lui-même');

      // Jugement clinique du biologiste au-delà de la détection automatique
      // (ex. contexte patient non capturé par le simple statut_res).
      const est_critique = simulateEstCritiqueConfirme(relu4.resultats, true);
      const { valeurs_critiques } = deriveCriticalPayload(relu4.resultats, REF_VALUES);

      const avant = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      const { status } = await call(labC.validate, { params: { id: labId4 }, body: { resultats: relu4.resultats, commentaires: 'Coché manuellement — contexte clinique', est_critique, valeurs_critiques }, user: laborantin });
      assert.equal(status, 200);
      const notif = await Notification.findOne({ destinataire: medecin._id, type: 'critical' }).sort('-createdAt').lean();
      assert.ok(notif, 'cocher manuellement doit réellement créer une notification, même sans détection automatique');
      cleanup.push(() => Notification.findByIdAndDelete(notif._id));
      const apres = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      assert.equal(apres, avant + 1);
    });
  } finally {
    for (const fn of cleanup) await fn();
    for (const fn of patientCleanup) await fn();
    await mongoose.disconnect();
  }
});
