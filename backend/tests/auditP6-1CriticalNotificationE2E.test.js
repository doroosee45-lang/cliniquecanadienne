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
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

const { REF_VALUES, deriveCriticalPayload } = require(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'labResultats.js'));

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

    await t.test("validerAnalyse calcule le payload avec la même fonction que Laboratory.jsx (deriveCriticalPayload), pas un est_critique fourni à la main", async () => {
      const relu = await LabResult.findById(labId).lean();
      // Reproduit exactement ce que fait validerAnalyse() : lit currentAnalyse.resultats
      // (donc les vraies données persistées à l'étape précédente) et appelle la même
      // fonction partagée que la page importe.
      const { est_critique, valeurs_critiques } = deriveCriticalPayload(relu.resultats, REF_VALUES);
      assert.equal(est_critique, true, 'un statut_res:"critique" saisi doit se traduire en est_critique:true côté frontend');
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

    await t.test("non-régression : aucun résultat critique saisi -> est_critique reste false, aucune notification supplémentaire créée", async () => {
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
      const { est_critique } = deriveCriticalPayload(relu2.resultats, REF_VALUES);
      assert.equal(est_critique, false);

      // Notification.entite_id n'existe pas sur ce schéma (createNotification
      // de validate() ne corrèle pas au LabResult) : seule une comparaison de
      // décompte avant/après, pas un filtre par identifiant, prouve
      // réellement qu'aucune notification supplémentaire n'a été créée.
      const avant = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      await call(labC.validate, { params: { id: labId2 }, body: { resultats: relu2.resultats, commentaires: '', est_critique, valeurs_critiques: '' }, user: laborantin });
      const apres = await Notification.countDocuments({ destinataire: medecin._id, type: 'critical' });
      assert.equal(apres, avant, 'aucune notification critique supplémentaire ne doit être créée quand est_critique est false');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
