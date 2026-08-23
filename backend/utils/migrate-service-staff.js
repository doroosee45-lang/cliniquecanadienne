/**
 * Module Administration Point 3 — migration ponctuelle : Staff.service passe
 * d'un champ texte libre (String) à une vraie référence ObjectId vers
 * Service (voir settings.controller.js::createService / GET
 * /settings/services). hr.controller.js fait déjà .populate('service',
 * 'nom') depuis un moment — un no-op silencieux tant que le schéma stockait
 * une String — cette migration ferme cet écart. Staff.departement (jamais
 * relié à aucune collection réelle) est supprimé du schéma en parallèle.
 *
 * Opère directement sur la collection MongoDB (comme
 * migrate-rename-dossierchirurgical-patient.js), pas via Mongoose, pour
 * convertir le type de stockage réel (String -> ObjectId) sans dépendre du
 * schéma applicatif au moment de l'exécution.
 *
 * Pour chaque fiche Staff :
 *   - service déjà en ObjectId réel            → inchangée (déjà migrée).
 *   - service en String correspondant à un      → convertie en ObjectId,
 *     Service._id réel existant                  departement retiré (info
 *                                                  redondante, remplacée).
 *   - service absent/vide mais departement       → JAMAIS de correspondance
 *     renseigné, ou service en String ne           devinée : loggée pour
 *     correspondant à aucun Service réel           réconciliation manuelle,
 *                                                    rien n'est modifié.
 *   - ni service ni departement                 → rien à migrer, ignorée.
 *
 * Idempotent — une fiche déjà migrée n'est pas modifiée par un second
 * passage. Non destructif sur les cas ambigus : aucune donnée n'est perdue
 * tant que la réconciliation manuelle n'a pas eu lieu.
 *
 * Usage : node utils/migrate-service-staff.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté\n');

  const staffCol = mongoose.connection.collection('staffs');
  const serviceCol = mongoose.connection.collection('services');

  const realServiceIds = new Set(
    (await serviceCol.find({}, { projection: { _id: 1 } }).toArray()).map(s => s._id.toString())
  );
  console.log(`Services réels trouvés : ${realServiceIds.size}`);

  const allStaff = await staffCol.find({}).toArray();
  console.log(`Fiches Staff trouvées   : ${allStaff.length}`);

  let converted = 0, alreadyObjectId = 0, ignoredVides = 0;
  const manualReview = [];

  for (const s of allStaff) {
    const raw = s.service;
    const label = `${s._id} — ${s.prenom || ''} ${s.nom || ''}`.trim();
    const hasDept = s.departement != null && s.departement !== '';

    if (raw instanceof ObjectId) { alreadyObjectId++; continue; }

    if (raw == null || raw === '') {
      if (hasDept) {
        manualReview.push(`${label} — departement="${s.departement}" mais aucun service assigné`);
      } else {
        ignoredVides++;
      }
      continue;
    }

    const str = String(raw);
    if (ObjectId.isValid(str) && realServiceIds.has(str)) {
      await staffCol.updateOne(
        { _id: s._id },
        { $set: { service: new ObjectId(str) }, $unset: { departement: '' } }
      );
      converted++;
    } else {
      manualReview.push(`${label} — service="${raw}" ne correspond à aucun Service réel — departement="${s.departement || ''}"`);
    }
  }

  console.log(`\n── Résultat ──`);
  console.log(`  Converties (String → ObjectId réel, departement retiré) : ${converted}`);
  console.log(`  Déjà en ObjectId (migration précédente)                 : ${alreadyObjectId}`);
  console.log(`  Ni service ni departement (rien à migrer)               : ${ignoredVides}`);
  console.log(`  À réconcilier manuellement                             : ${manualReview.length}`);
  if (manualReview.length) {
    console.log(`\n⚠️  Fiches à traiter manuellement (service/departement laissés inchangés) :`);
    manualReview.forEach(m => console.log('  - ' + m));
  }

  const remainingStrings = await staffCol.countDocuments({ service: { $type: 'string', $ne: '' } });
  const total = await staffCol.countDocuments({});
  console.log(`\n── Vérification finale ──`);
  console.log(`  Total fiches Staff                                : ${total}`);
  console.log(`  Fiches avec service encore en String (hors vide)  : ${remainingStrings} (attendu = nombre à réconcilier ci-dessus)`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
