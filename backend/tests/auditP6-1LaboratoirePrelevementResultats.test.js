// P6-1 — Laboratoire : prélèvement, saisie des résultats, validation (bonne
// URL) et acquittement d'un résultat critique. Avant cette correction, le
// frontend appelait des routes inexistantes (/prelevement, /resultats) ou
// mal orthographiées (/validation au lieu de /validate), et retombait sur un
// catch qui affichait un faux succès local sans jamais persister en base.
// Ce test couvre les nouveaux contrôleurs prelever/saisirResultats, ainsi
// que la bonne URL de validate (déjà existant) et acquit (déjà existant),
// avec vérification systématique par relecture fraîche en base.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('laboratory.controller — prelever, saisirResultats, validate, acquit (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const LabResult = require('../models/LabResult');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Notification = require('../models/Notification');
  const labC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const patient = await Patient.create({
    nom: `P61Lab${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'F',
    groupe_sanguin: 'O+', telephone: '060000000',
  });
  const medecin = await User.create({ email: `_p61-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Prescripteur', prenom: 'P61', role: 'medecin', statut: 'actif' });
  const laborantin = await User.create({ email: `_p61-labo-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Biologiste', prenom: 'P61', role: 'laborantin', statut: 'actif' });
  const infirmier = await User.create({ email: `_p61-inf-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Preleveur', prenom: 'P61', role: 'infirmier', statut: 'actif' });

  const userMedecin    = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };
  const userLaborantin = { _id: laborantin._id, prenom: laborantin.prenom, nom: laborantin.nom, role: 'laborantin' };
  const userInfirmier  = { _id: infirmier._id, prenom: infirmier.prenom, nom: infirmier.nom, role: 'infirmier' };

  const cleanup = [
    () => Patient.findByIdAndDelete(patient._id),
    () => User.findByIdAndDelete(medecin._id),
    () => User.findByIdAndDelete(laborantin._id),
    () => User.findByIdAndDelete(infirmier._id),
  ];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    // ── Fixture : une demande d'analyse déjà créée ─────────────
    const { status: sCreate, body: bCreate } = await call(labC.create, {
      body: { patient: patient._id, patient_nom: `Test P61Lab${stamp}`, medecin_prescripteur: medecin._id.toString(), examens_demandes: ['NFS', 'glycemie'] },
      user: userMedecin,
    });
    assert.equal(sCreate, 201);
    const labId = bCreate.result._id;
    cleanup.push(() => LabResult.findByIdAndDelete(labId));
    assert.equal(bCreate.result.statut, 'en_attente');

    await t.test('prelever — persiste réellement statut:preleve, date_prelevement et les champs du formulaire de prélèvement', async () => {
      const { status, body } = await call(labC.prelever, {
        params: { id: labId },
        body: { type_echantillon: 'sang', preleveur: 'Inf. Preleveur P61', observations_prelevement: 'À jeun depuis 12h' },
        user: userInfirmier,
      });
      assert.equal(status, 200);
      assert.equal(body.result.statut, 'preleve');

      const relu = await LabResult.findById(labId).lean();
      assert.equal(relu.statut, 'preleve', 'le statut doit être réellement persisté en base');
      assert.equal(relu.type_echantillon, 'sang');
      assert.equal(relu.preleveur, 'Inf. Preleveur P61');
      assert.equal(relu.observations_prelevement, 'À jeun depuis 12h');
      assert.ok(relu.date_prelevement instanceof Date, 'date_prelevement doit être renseignée');
    });

    await t.test('prelever — résultat introuvable renvoie 404', async () => {
      const { status } = await call(labC.prelever, {
        params: { id: new mongoose.Types.ObjectId() },
        body: { type_echantillon: 'sang', preleveur: 'X' },
        user: userInfirmier,
      });
      assert.equal(status, 404);
    });

    let resultatsEnvoyes;
    await t.test('saisirResultats — persiste réellement le tableau resultats et statut:termine', async () => {
      resultatsEnvoyes = [
        { exam_id: 'NFS', valeur: '13.5', ref: '12.0 – 17.5', unite: 'g/dL', statut_res: 'normal' },
        { exam_id: 'glycemie', valeur: '2.20', ref: '0.70 – 1.10', unite: 'g/L', statut_res: 'critique' },
      ];
      const { status, body } = await call(labC.saisirResultats, {
        params: { id: labId },
        body: { resultats: resultatsEnvoyes },
        user: userLaborantin,
      });
      assert.equal(status, 200);
      assert.equal(body.result.statut, 'termine');

      const relu = await LabResult.findById(labId).lean();
      assert.equal(relu.statut, 'termine', 'le statut doit être réellement persisté en base');
      assert.equal(relu.resultats.length, 2, 'le tableau resultats doit être réellement persisté');
      assert.equal(relu.resultats[0].exam_id, 'NFS');
      assert.equal(relu.resultats[0].valeur, '13.5');
      assert.equal(relu.resultats[1].statut_res, 'critique');
      assert.ok(relu.date_resultat instanceof Date, 'date_resultat doit être renseignée');
    });

    await t.test('saisirResultats — résultat introuvable renvoie 404', async () => {
      const { status } = await call(labC.saisirResultats, {
        params: { id: new mongoose.Types.ObjectId() },
        body: { resultats: [] },
        user: userLaborantin,
      });
      assert.equal(status, 404);
    });

    await t.test('validate (bonne URL /validate) — persiste la validation et déclenche la notification critique vers le médecin prescripteur', async () => {
      const { status, body } = await call(labC.validate, {
        params: { id: labId },
        body: { resultats: resultatsEnvoyes, commentaires: 'Hyperglycémie sévère', est_critique: true, valeurs_critiques: 'Glycémie 2.20 g/L' },
        user: userLaborantin,
      });
      assert.equal(status, 200);
      assert.equal(body.result.statut, 'valide');

      const relu = await LabResult.findById(labId).lean();
      assert.equal(relu.statut, 'valide', 'le statut doit être réellement persisté en base');
      assert.equal(relu.est_critique, true);
      assert.ok(relu.date_validation instanceof Date);
      assert.equal(relu.validateur.toString(), laborantin._id.toString());

      const notif = await Notification.findOne({ destinataire: medecin._id, type: 'critical', message: 'Glycémie 2.20 g/L' }).lean();
      assert.ok(notif, 'une notification critique doit avoir été créée pour le médecin prescripteur');
      cleanup.push(() => Notification.findByIdAndDelete(notif._id));
    });

    await t.test('acquit (PUT /:id/acquit) — persiste réellement acquitte_par et acquitte_at', async () => {
      const { status, body } = await call(labC.acquit, {
        params: { id: labId },
        user: userMedecin,
      });
      assert.equal(status, 200);
      assert.equal(body.result.acquitte_par.toString(), medecin._id.toString());

      const relu = await LabResult.findById(labId).lean();
      assert.equal(relu.acquitte_par.toString(), medecin._id.toString(), 'acquitte_par doit être réellement persisté en base');
      assert.ok(relu.acquitte_at instanceof Date, 'acquitte_at doit être réellement persisté en base');
    });

    await t.test('acquit — résultat introuvable renvoie 404', async () => {
      const { status } = await call(labC.acquit, {
        params: { id: new mongoose.Types.ObjectId() },
        user: userMedecin,
      });
      assert.equal(status, 404);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
