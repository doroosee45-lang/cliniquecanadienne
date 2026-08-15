/**
 * T2.2 — Migration ponctuelle : renseigne User.patient_id sur les comptes
 * role:'patient' déjà existants, par correspondance d'email avec Patient.
 * Les comptes créés après ce commit reçoivent déjà patient_id à la création
 * (patients.controller.js::create) — cette migration ne traite que le passé.
 *
 * Non destructive : ne fait qu'ajouter/mettre à jour un champ, ne supprime
 * ni ne modifie aucune autre donnée. Sûre à exécuter sur une base réelle,
 * et sans danger à ré-exécuter (idempotente).
 *
 * Usage : node utils/migrate-link-patient-id.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté\n');

  const patientUsers = await User.find({ role: 'patient' });
  console.log(`Comptes role:'patient' trouvés : ${patientUsers.length}`);

  let linked = 0, alreadyLinked = 0, noMatch = [], multipleMatch = [];

  for (const user of patientUsers) {
    if (user.patient_id) { alreadyLinked++; continue; }
    if (!user.email) { noMatch.push(`${user._id} (pas d'email)`); continue; }

    const matches = await Patient.find({ email: user.email.toLowerCase().trim() });
    if (matches.length === 0) {
      noMatch.push(`${user.email} — aucun dossier Patient correspondant`);
      continue;
    }
    if (matches.length > 1) {
      multipleMatch.push(`${user.email} — ${matches.length} dossiers Patient partagent cet email`);
      continue; // ambigu : ne pas deviner, laisser pour traitement manuel
    }

    user.patient_id = matches[0]._id;
    await user.save();
    linked++;
  }

  const total = patientUsers.length;
  const coverage = total > 0 ? Math.round(((linked + alreadyLinked) / total) * 100) : 100;

  console.log(`\n── Résultat ──`);
  console.log(`  Nouvellement liés      : ${linked}`);
  console.log(`  Déjà liés               : ${alreadyLinked}`);
  console.log(`  Sans dossier Patient    : ${noMatch.length}`);
  console.log(`  Email ambigu (>1 match) : ${multipleMatch.length}`);
  console.log(`  Couverture              : ${coverage}% (${linked + alreadyLinked}/${total})`);

  if (noMatch.length) { console.log(`\nComptes sans dossier Patient (normal si compte Google/patient jamais admis) :`); noMatch.forEach(m => console.log('  - ' + m)); }
  if (multipleMatch.length) { console.log(`\n⚠️  Ambiguïtés à traiter manuellement :`); multipleMatch.forEach(m => console.log('  - ' + m)); }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
