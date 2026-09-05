/**
 * Correction 13 (relecture du 6 sept. 2026, DATA-001) — Migration ponctuelle :
 * Echographie.patient était une String libre (aucun populate() possible,
 * malgré required:true) tandis que la vraie référence patient_ref restait
 * optionnelle. Fusionnés en un seul champ de référence réelle :
 *   - `patient` devient la référence ObjectId réelle (ref:'Patient', required)
 *   - le libellé texte autrefois porté par `patient` est déplacé vers
 *     `patient_nom` (nouveau champ, texte libre, jamais perdu)
 *
 * Opère directement sur la collection MongoDB (pas via Mongoose, pour éviter
 * tout cast prématuré pendant la lecture des documents non encore migrés) :
 *   1. Copie patient (String) -> patient_nom pour TOUS les documents (aucune
 *      perte de l'ancien libellé affiché, y compris ceux déjà liés).
 *   2. Pour les documents ayant déjà un patient_ref réel : patient <- patient_ref
 *      (devient la référence), puis patient_ref est retiré (fusionné).
 *   3. Pour les documents SANS patient_ref (aucune référence réelle
 *      pré-existante à réutiliser) : `patient` est retiré plutôt que de
 *      laisser une String orpheline sous un champ désormais typé ObjectId
 *      côté application — PAS deviné, PAS fabriqué. Le libellé reste lisible
 *      via patient_nom (étape 1). Ces documents restent signalés en fin de
 *      script pour traitement manuel (rattachement à un vrai Patient si
 *      l'un existe, ou archivage) — aucune automatisation ne décide à leur
 *      place.
 *
 * Non destructif sur le contenu affiché (patient_nom préserve tout) ;
 * idempotent (un document déjà migré — patient déjà ObjectId, patient_ref
 * absent — n'est pas retouché par les filtres ci-dessous).
 *
 * Usage : node utils/migrate-echographie-patient-ref.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté\n');

  const collection = mongoose.connection.collection('echographies');

  const total = await collection.countDocuments({});
  console.log(`Documents Echographie au total : ${total}`);

  // Étape 1 — préserve le libellé affiché existant pour TOUS les documents
  // dont `patient` est encore une String (pas déjà migré).
  const toLabel = await collection.countDocuments({ patient: { $type: 'string' } });
  if (toLabel > 0) {
    const r1 = await collection.updateMany(
      { patient: { $type: 'string' } },
      [{ $set: { patient_nom: '$patient' } }]
    );
    console.log(`Étape 1 — libellé préservé (patient -> patient_nom) : ${r1.modifiedCount}/${toLabel}`);
  } else {
    console.log('Étape 1 — rien à préserver (aucun patient encore en String).');
  }

  // Étape 2 — documents avec une vraie référence pré-existante (patient_ref) :
  // devient la référence réelle sous `patient`, patient_ref est retiré.
  const toPromote = await collection.countDocuments({ patient_ref: { $exists: true, $ne: null } });
  if (toPromote > 0) {
    const r2 = await collection.updateMany(
      { patient_ref: { $exists: true, $ne: null } },
      [{ $set: { patient: '$patient_ref' } }, { $unset: 'patient_ref' }]
    );
    console.log(`Étape 2 — référence promue (patient_ref -> patient) : ${r2.modifiedCount}/${toPromote}`);
  } else {
    console.log('Étape 2 — aucun document avec patient_ref à promouvoir.');
  }

  // Étape 3 — documents restants sans référence réelle : `patient` (toujours
  // une String à ce stade) est retiré plutôt que fabriqué ou laissé
  // incohérent avec le nouveau schéma. Le libellé reste dans patient_nom.
  const orphans = await collection.find({ patient: { $type: 'string' } }).project({ patient_nom: 1, numero: 1 }).toArray();
  if (orphans.length > 0) {
    const r3 = await collection.updateMany(
      { patient: { $type: 'string' } },
      { $unset: { patient: '' } }
    );
    console.log(`Étape 3 — références non résolues, patient retiré (préservé sous patient_nom) : ${r3.modifiedCount}/${orphans.length}`);
  } else {
    console.log('Étape 3 — aucun document orphelin (tous résolus vers une vraie référence).');
  }

  // Retire aussi patient_ref sur d'éventuels documents qui l'auraient encore
  // (ne devrait plus en rester après l'étape 2, filet de sécurité idempotent).
  await collection.updateMany({ patient_ref: { $exists: true } }, { $unset: { patient_ref: '' } });

  const finalTotal = await collection.countDocuments({});
  const withRealPatient = await collection.countDocuments({ patient: { $type: 'objectId' } });
  const withoutPatient = await collection.countDocuments({ patient: { $exists: false } });
  console.log(`\n── Vérification finale ──`);
  console.log(`  Total documents                  : ${finalTotal}`);
  console.log(`  Avec référence patient réelle     : ${withRealPatient}`);
  console.log(`  Sans référence (à traiter manuel) : ${withoutPatient}`);
  if (orphans.length > 0) {
    console.log(`\n⚠️  Documents non résolus (aucun patient_ref pré-existant, non migrés vers une référence réelle) :`);
    orphans.forEach(o => console.log(`  - ${o._id} (numero:${o.numero || '?'}) — libellé conservé : "${o.patient_nom || ''}"`));
    console.log('  Ces documents ne satisfont plus le required:true du schéma applicatif tant qu\'un vrai Patient ne leur est pas rattaché manuellement.');
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
