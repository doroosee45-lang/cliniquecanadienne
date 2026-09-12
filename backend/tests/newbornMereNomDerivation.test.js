// AUDIT-MATERNITE-PATIENT (extension nouveau-nés) — createNewborn reprenait
// mere_nom tel quel depuis le frontend (construit depuis patient_nom/
// patient_prenom de la grossesse), donc vide dès que la grossesse liée
// n'avait pas de patiente identifiée (mêmes 2 dossiers historiques trouvés
// sans patient_id). Corrigé pour re-dériver mere_nom/patient_id depuis la
// vraie Pregnancy liée (via grossesse_id) quand elle a un patient_id réel —
// source unique de vérité, jamais de confiance aveugle dans ce que le
// frontend a envoyé. Si la grossesse liée n'a elle-même aucun patient_id
// (cas non résolu), mere_nom reste tel quel (vide) — aucune tentative de
// deviner, cohérent avec la décision déjà prise pour les 2 dossiers
// existants.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('maternityController.createNewborn — dérivation réelle de mere_nom/patient_id depuis la grossesse liée (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Pregnancy = require('../models/Pregnancy');
  const Newborn = require('../models/Newborn');
  const maternityC = require('../controllers/maternityController');

  const stamp = Date.now();
  const agent = await User.create({ email: `_nb-agent-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'Nb', role: 'sage_femme', statut: 'actif' });
  const patient = await Patient.create({ nom: `NbDeriv${stamp}`, prenom: 'Maman', date_naissance: '1995-01-01', sexe: 'F', telephone: '+242060000001' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [
    () => User.findByIdAndDelete(agent._id),
    () => Patient.findByIdAndDelete(patient._id),
  ];

  try {
    await t.test('grossesse liée à un vrai patient_id → mere_nom/patient_id du nouveau-né dérivés depuis la grossesse, pas depuis ce que le frontend envoie', async () => {
      const grossesse = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, ddr: new Date(), created_by: agent._id });
      cleanup.push(() => Pregnancy.findByIdAndDelete(grossesse._id));

      const { status, body } = await call(maternityC.createNewborn, {
        user: agent, ip: '127.0.0.1',
        body: { grossesse_id: grossesse._id.toString(), mere_nom: 'CECI NE DOIT PAS ETRE UTILISE', prenom: 'BebeTest', sexe: 'M', poids: 3000, taille: 49 },
      });
      assert.equal(status, 201);
      assert.equal(body.nouveau_ne.mere_nom, `${patient.prenom} ${patient.nom}`, 'mere_nom doit venir de la grossesse réelle, pas de la valeur envoyée par le frontend');
      assert.equal(body.nouveau_ne.patient_id.toString(), patient._id.toString(), 'patient_id doit être réellement copié depuis la grossesse');
      cleanup.push(() => Newborn.findByIdAndDelete(body.nouveau_ne._id));

      const relu = await Newborn.findById(body.nouveau_ne._id).lean();
      assert.equal(relu.mere_nom, `${patient.prenom} ${patient.nom}`, 'persisté en base, pas seulement dans la réponse');
    });

    await t.test('grossesse liée sans patient_id (dossier non résolu) → mere_nom reste tel quel, aucune tentative de deviner', async () => {
      // SPEC-03 (correction du 12 sept. 2026) — patient_id est désormais
      // requis côté schéma pour toute NOUVELLE grossesse (Pregnancy.create
      // rejetterait ce fixture). Mais 2 dossiers historiques réels, créés
      // avant ce correctif, existent encore sans patient_id — la logique de
      // createNewborn doit continuer à les gérer sans deviner. insertOne
      // (driver Mongo brut, contourne la validation Mongoose) reproduit
      // fidèlement cet état légataire toujours présent en base, sans quoi
      // ce scénario réel ne serait plus du tout testable.
      const { insertedId } = await Pregnancy.collection.insertOne({ ddr: new Date(), created_by: agent._id, createdAt: new Date(), updatedAt: new Date() });
      const grossesseNonResolue = { _id: insertedId };
      cleanup.push(() => Pregnancy.findByIdAndDelete(grossesseNonResolue._id));

      const { status, body } = await call(maternityC.createNewborn, {
        user: agent, ip: '127.0.0.1',
        body: { grossesse_id: grossesseNonResolue._id.toString(), mere_nom: '', prenom: 'BebeTest2', sexe: 'F', poids: 2900, taille: 48 },
      });
      assert.equal(status, 201);
      assert.equal(body.nouveau_ne.mere_nom, '', 'ne doit rien inventer si la grossesse liée n\'a elle-même aucun patient_id');
      assert.ok(!body.nouveau_ne.patient_id, 'patient_id ne doit pas être renseigné si la grossesse n\'en a pas');
      cleanup.push(() => Newborn.findByIdAndDelete(body.nouveau_ne._id));
    });

    await t.test('sans grossesse_id du tout — comportement inchangé (passthrough)', async () => {
      const { status, body } = await call(maternityC.createNewborn, {
        user: agent, ip: '127.0.0.1',
        body: { mere_nom: 'Texte libre sans grossesse liée', prenom: 'BebeTest3', sexe: 'M', poids: 3100, taille: 50 },
      });
      assert.equal(status, 201);
      assert.equal(body.nouveau_ne.mere_nom, 'Texte libre sans grossesse liée');
      cleanup.push(() => Newborn.findByIdAndDelete(body.nouveau_ne._id));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
