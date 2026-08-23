/**
 * AUDIT-ELEVE-5 — Migration ponctuelle : extrait Conversation.messages
 * (tableau embarqué) vers une collection Message dédiée. Voir le plan de
 * migration validé pour le raisonnement complet (schéma, séquencement,
 * risques/rollback).
 *
 * Idempotent — chaque Message réutilise l'_id du sous-document embarqué
 * d'origine ; un doublon (E11000 sur un _id déjà migré) est compté comme
 * "déjà présent, ignoré", jamais une erreur qui interromprait le lot.
 * Sûr à exécuter plusieurs fois de suite (voir le plan : une 2e passe est
 * prévue juste avant la bascule des contrôleurs, pour rattraper les
 * messages écrits par l'ancien code entre la 1re passe et la bascule).
 *
 * Purement additif : ne lit que Conversation, n'écrit que Message, ne
 * modifie ni ne supprime jamais Conversation.messages. Aucune perte
 * possible même en cas d'interruption en cours de route.
 *
 * Vérification d'intégrité bloquante : le script échoue explicitement
 * (code de sortie 1) si le comptage avant/après ne concorde pas ou si
 * l'échantillonnage détecte une divergence — jamais un simple avertissement
 * ignorable.
 *
 * Usage : node utils/migrate-messages-to-collection.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const SAMPLE_SIZE = 20;
const BATCH_SIZE = 100; // conversations par lot, pour borner la mémoire

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté\n');

  require('../models/Message'); // enregistre le modèle avant toute requête
  const Conversation = mongoose.connection.collection('conversations');
  const Message = mongoose.connection.collection('messages');

  // ── Comptage AVANT (source de vérité) ───────────────────────────────────
  const [{ totalEmbedded } = { totalEmbedded: 0 }] = await Conversation.aggregate([
    { $project: { count: { $size: { $ifNull: ['$messages', []] } } } },
    { $group: { _id: null, totalEmbedded: { $sum: '$count' } } },
  ]).toArray();
  const totalConversations = await Conversation.countDocuments({});
  console.log(`Conversations trouvées         : ${totalConversations}`);
  console.log(`Messages embarqués (source)    : ${totalEmbedded}\n`);

  // ── Migration par lots ───────────────────────────────────────────────
  let inseres = 0, dejaPresents = 0, examines = 0;
  const cursor = Conversation.find({}, { projection: { messages: 1 } });
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    try {
      const result = await Message.insertMany(batch, { ordered: false });
      inseres += result.insertedCount ?? Object.keys(result.insertedIds || {}).length;
    } catch (err) {
      // insertMany avec ordered:false continue malgré des E11000 individuels ;
      // le driver remonte quand même une erreur agrégée à la fin — on
      // distingue les vrais échecs (autre code) des doublons déjà migrés.
      const writeErrors = err.writeErrors || [];
      const dupes = writeErrors.filter(e => e.code === 11000).length;
      const autres = writeErrors.filter(e => e.code !== 11000);
      dejaPresents += dupes;
      inseres += batch.length - writeErrors.length;
      if (autres.length > 0) {
        console.error(`❌ ${autres.length} échec(s) non liés à un doublon :`, autres.slice(0, 3));
        throw new Error(`Échec de migration non récupérable sur ${autres.length} document(s).`);
      }
    }
    batch = [];
  };

  for await (const conv of cursor) {
    for (const m of (conv.messages || [])) {
      examines++;
      batch.push({
        _id: m._id,
        conversation_id: conv._id,
        expediteur: m.expediteur,
        contenu: m.contenu,
        pieceJointe: m.pieceJointe,
        reactions: m.reactions || [],
        lu_par: m.lu_par || [],
        date_envoi: m.date_envoi,
        createdAt: m.date_envoi,
        updatedAt: m.date_envoi,
      });
      if (batch.length >= BATCH_SIZE) await flush();
    }
  }
  await flush();

  console.log(`Messages examinés              : ${examines}`);
  console.log(`Nouvellement insérés           : ${inseres}`);
  console.log(`Déjà présents (2e passe, etc.)  : ${dejaPresents}\n`);

  // ── Vérification d'intégrité (bloquante) ────────────────────────────
  const totalMessages = await Message.countDocuments({});
  console.log(`── Vérification ──`);
  console.log(`Total Message (après)          : ${totalMessages}`);
  console.log(`Total embarqué (source)        : ${totalEmbedded}`);

  let ok = true;
  if (totalMessages !== totalEmbedded) {
    console.error(`❌ ÉCART : ${totalMessages} messages migrés pour ${totalEmbedded} attendus.`);
    ok = false;
  } else {
    console.log('✅ Comptage exact.');
  }

  // Intégrité référentielle — aucun Message ne doit pointer vers une
  // conversation inexistante.
  const convIds = new Set((await Conversation.find({}, { projection: { _id: 1 } }).toArray()).map(c => c._id.toString()));
  const orphans = await Message.aggregate([
    { $group: { _id: '$conversation_id' } },
  ]).toArray();
  const orphanCount = orphans.filter(o => !convIds.has(o._id.toString())).length;
  if (orphanCount > 0) {
    console.error(`❌ ${orphanCount} conversation_id référencé(s) par Message mais introuvable(s) dans Conversation.`);
    ok = false;
  } else {
    console.log('✅ Intégrité référentielle (conversation_id) confirmée.');
  }

  // Échantillonnage — comparaison champ par champ sur un échantillon aléatoire.
  const sample = await Conversation.aggregate([
    { $match: { 'messages.0': { $exists: true } } },
    { $sample: { size: SAMPLE_SIZE } },
  ]).toArray();
  let sampleMismatches = 0;
  for (const conv of sample) {
    for (const m of conv.messages) {
      const migre = await Message.findOne({ _id: m._id });
      if (!migre) { sampleMismatches++; console.error(`  ❌ Message ${m._id} absent de la nouvelle collection.`); continue; }
      if (String(migre.expediteur) !== String(m.expediteur) ||
          (migre.contenu || '') !== (m.contenu || '') ||
          new Date(migre.date_envoi).getTime() !== new Date(m.date_envoi).getTime() ||
          (migre.lu_par || []).length !== (m.lu_par || []).length) {
        sampleMismatches++;
        console.error(`  ❌ Message ${m._id} diverge entre source et migration.`);
      }
    }
  }
  console.log(`Échantillon vérifié            : ${sample.reduce((s, c) => s + c.messages.length, 0)} message(s) sur ${sample.length} conversation(s)`);
  if (sampleMismatches > 0) {
    console.error(`❌ ${sampleMismatches} divergence(s) détectée(s) dans l'échantillon.`);
    ok = false;
  } else {
    console.log('✅ Échantillon conforme.');
  }

  await mongoose.disconnect();
  if (!ok) {
    console.error('\n❌ MIGRATION NON VALIDÉE — ne pas basculer les contrôleurs tant que ces écarts ne sont pas résolus.');
    process.exit(1);
  }
  console.log('\n✅ Migration validée.');
  process.exit(0);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
