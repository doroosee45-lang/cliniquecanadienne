// ANOM-MAT-01 (audit métier du 13 sept. 2026, Phase 4) — Pregnancy.telephone
// est une copie figée du téléphone du Patient, écrite une seule fois à la
// création (maternityController.js::create) et jamais resynchronisée : un
// dossier de grossesse vit ~9 mois, largement assez pour qu'une patiente
// change de numéro entre-temps sans que le personnel de maternité ne le
// voie jamais. Corrigé en préférant, à la lecture (getAll/getOne), le
// téléphone LIVE du Patient lié quand il est disponible — même principe
// déjà établi par urgencesController.js::normalize() pour patient_nom —
// avec repli sur la copie figée si le patient n'est plus résolvable.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ANOM-MAT-01 — getAll/getOne renvoient le téléphone LIVE du patient lié, jamais la copie figée obsolète (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Pregnancy = require('../models/Pregnancy');
  const maternityC = require('../controllers/maternityController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId() };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `MAT01-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1992-01-01', telephone: '060000001' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    const { status, body } = await call(maternityC.create, { user, ip: '127.0.0.1', body: { patient_id: String(patient._id), ddr: new Date().toISOString() } });
    assert.equal(status, 201, JSON.stringify(body));
    cleanup.push(() => Pregnancy.findByIdAndDelete(body.grossesse._id));

    const freshAvant = await Pregnancy.findById(body.grossesse._id).lean();
    assert.equal(freshAvant.telephone, '060000001', 'préalable : la copie figée doit bien capturer le téléphone au moment de la création');

    // La patiente change de numéro APRÈS la création du dossier de
    // grossesse (le scénario exact décrit par l'anomalie — un changement en
    // cours de grossesse).
    await Patient.findByIdAndUpdate(patient._id, { telephone: '069999999' });

    await t.test('getOne renvoie le nouveau numéro, jamais l\'ancien figé en base', async () => {
      const r = await call(maternityC.getOne, { params: { id: body.grossesse._id } });
      assert.equal(r.status, 200);
      assert.equal(r.body.grossesse.telephone, '069999999', 'doit refléter le téléphone actuel du patient, pas la copie obsolète');
    });

    await t.test('getAll renvoie également le nouveau numéro pour ce dossier dans la liste', async () => {
      const r = await call(maternityC.getAll, { query: { limit: 200 } });
      assert.equal(r.status, 200);
      const found = r.body.grossesses.find(g => String(g._id) === String(body.grossesse._id));
      assert.ok(found, 'le dossier doit apparaître dans la liste');
      assert.equal(found.telephone, '069999999');
    });

    await t.test('non-régression — la copie figée en base (Pregnancy.telephone lui-même) reste inchangée, seule la LECTURE est corrigée', async () => {
      const freshApres = await Pregnancy.findById(body.grossesse._id).lean();
      assert.equal(freshApres.telephone, '060000001', 'aucune écriture silencieuse ne doit modifier le document stocké — uniquement la réponse API');
    });

    await t.test('repli sur la copie figée si le patient n\'est plus résolvable (patient supprimé/lien cassé)', async () => {
      // Simule un lien cassé sans dépendre d'une vraie suppression de
      // Patient (qui déclencherait le garde-fou DB-001 avec l'historique
      // réel de ce test) : un patient_id fabriqué, jamais résolu par
      // populate().
      const gOrphelin = await Pregnancy.create({
        patient_id: new mongoose.Types.ObjectId(), patient_nom: 'Orphelin', patient_prenom: 'Test',
        telephone: '065555555', ddr: new Date(), date_debut: new Date(), created_by: user._id,
      });
      cleanup.push(() => Pregnancy.findByIdAndDelete(gOrphelin._id));
      const r = await call(maternityC.getOne, { params: { id: gOrphelin._id } });
      assert.equal(r.status, 200);
      assert.equal(r.body.grossesse.telephone, '065555555', 'sans patient résolvable, la copie figée doit rester affichée — jamais une valeur vide ou inventée');
    });
  } finally {
    // Suppression dans l'ordre inverse de création (enfants avant parent) :
    // le garde-fou DB-001 (Patient.js::pre('findOneAndDelete')) refuse de
    // supprimer un Patient tant qu'un historique clinique réel (ici la
    // Pregnancy) le référence encore.
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
