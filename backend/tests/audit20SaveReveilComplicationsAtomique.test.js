// AUDIT-20-3 (18 sept. 2026, audit indépendant) —
// blocoperatoireController.js::saveReveil lisait
// DossierChirurgical.nb_complications puis réécrivait séparément
// (dossier.nb_complications += complications.length; dossier.save()) —
// exactement le même bug déjà trouvé et corrigé une fois dans
// chirurgieController.js::addComplication (SPEC-04, voir
// tests/spec04CompteursAtomiquesChirurgie.test.js), réapparu ici via un
// point d'entrée différent sur le même modèle. Ce test prouve, sur une
// vraie course (Promise.all, pas séquentiel), que N appels saveReveil
// concurrents (chacun signalant 1 complication) produisent bien
// nb_complications = N, jamais moins — même méthode que SPEC-04.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const N = 8;

test('AUDIT-20-3 — saveReveil() : nb_complications reste exact sous appels concurrents réels', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const blocC = require('../controllers/blocoperatoireController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Audit20-3-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1980-01-01' });
  const dossier = await DossierChirurgical.create({ numero: `AUDIT20-3-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'opere' });
  const user = { _id: new mongoose.Types.ObjectId() };

  try {
    await t.test(`${N} saveReveil() concurrents réels (1 complication chacun) → nb_complications = ${N} exactement, jamais moins`, async () => {
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(blocC.saveReveil, {
          params: { id: dossier._id.toString() }, user, ip: '127.0.0.1',
          body: { etat_patient: 'stable', observations: `Reveil ${i}`, complications: [{ type_complication: 'autre' }], temperature: '37', tension_sys: '120', tension_dia: '80', pouls: '70' },
        })
      ));

      for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));

      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.nb_complications, N, `nb_complications doit être exactement ${N} après ${N} appels concurrents réels (1 complication chacun), jamais moins (incrément perdu)`);

      // evolution_immediate : "dernier écrivain gagne" sur un champ simple
      // (pas un compteur) — la valeur finale doit être UNE des N notes
      // réellement envoyées, jamais vide/corrompue/périmée.
      assert.match(fresh.evolution_immediate, /^Réveil: état=stable/);
      assert.ok(/Reveil \d/.test(fresh.evolution_immediate), 'la note finale doit provenir d\'un des appels réels, jamais une valeur fabriquée');

      // Chaque réponse doit refléter le document RÉELLEMENT mis à jour
      // (dossierFinal, relu après l'écriture atomique) — jamais l'objet en
      // mémoire périmé d'avant l'incrément (le bug de précision signalé
      // explicitement par l'auteur du correctif).
      for (const r of results) {
        assert.ok(r.body.intervention.nb_complications >= 1, 'chaque réponse doit refléter un nb_complications réellement incrémenté, jamais la valeur périmée d\'avant l\'écriture');
      }
    });

    await t.test('non-régression — saveReveil() sans complications ne touche jamais nb_complications', async () => {
      const dossier2 = await DossierChirurgical.create({ numero: `AUDIT20-3B-${stamp}`, patient: patient._id, patient_nom: patient.nom, statut: 'opere', nb_complications: 3 });
      const { status, body } = await call(blocC.saveReveil, {
        params: { id: dossier2._id.toString() }, user, ip: '127.0.0.1',
        body: { etat_patient: 'stable', observations: 'RAS', temperature: '37', tension_sys: '120', tension_dia: '80', pouls: '70' },
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.intervention.nb_complications, 3, 'sans complications dans le body, nb_complications ne doit jamais changer');
      await DossierChirurgical.findByIdAndDelete(dossier2._id);
    });
  } finally {
    await DossierChirurgical.findByIdAndDelete(dossier._id);
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
