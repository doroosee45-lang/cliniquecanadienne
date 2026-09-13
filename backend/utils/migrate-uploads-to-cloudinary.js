// MIGRATION-CLOUDINARY (13 sept. 2026) — script de maintenance à exécuter
// UNE SEULE FOIS, manuellement, une fois CLOUDINARY_CLOUD_NAME/API_KEY/
// API_SECRET réellement configurés (décision produit : migrer aussi les
// fichiers existants, pas seulement les nouveaux). Suit le même principe que
// utils/migrate-link-patient-id.js/utils/seed.js : script autonome, son
// propre bootstrap dotenv, jamais exécuté automatiquement au démarrage.
//
// Piloté par la BASE DE DONNÉES, jamais par un simple listage du dossier
// backend/uploads/ : seuls les fichiers réellement référencés par un
// document Mongo (Patient.photo, Medication.photo, Document.fichier_path,
// Message.pieceJointe.path, ImagingResult.images[].path,
// Echographie.images[].url) sont migrés. Plusieurs de ces dossiers
// contiennent déjà des fichiers orphelins (anciennes photos jamais nettoyées
// lors d'un remplacement, cf. audit de migration) — ce script ne leur donne
// délibérément pas une seconde vie sur Cloudinary : migrer un fichier mort
// serait fabriquer une référence qui n'a jamais existé.
//
// Ne supprime JAMAIS les fichiers locaux d'origine (action destructive,
// hors périmètre de ce script) : ils restent sur disque après migration,
// simples doublons inertes une fois la référence en base repointée vers
// Cloudinary. À nettoyer manuellement plus tard si souhaité, une fois la
// migration vérifiée sur le tableau de bord Cloudinary.
//
// Chaque enregistrement est traité indépendamment (try/catch individuel) :
// un échec (fichier local manquant, erreur réseau Cloudinary) est journalisé
// et n'interrompt jamais le reste du lot — le résumé final distingue
// succès/échecs/ignorés (déjà migré) pour chaque catégorie.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../config/env');
const cloudinaryUtil = require('./cloudinary');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function resolveLocalFile(relativePath) {
  // relativePath attendu sous la forme "/uploads/<dossier>/<fichier>".
  const cleaned = relativePath.replace(/^\/?uploads\//, '');
  const resolved = path.resolve(path.join(UPLOADS_ROOT, cleaned));
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) return null; // jamais suivre une traversée de chemin
  return resolved;
}

async function migrateOne(localPath, cloudinaryFolder) {
  const resolved = resolveLocalFile(localPath);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`Fichier local introuvable : ${localPath}`);
  }
  const buffer = fs.readFileSync(resolved);
  const filenameBase = path.basename(resolved, path.extname(resolved));
  const result = await cloudinaryUtil.uploadBuffer(buffer, { folder: `medisync/${cloudinaryFolder}`, public_id: filenameBase });
  return { url: result.secure_url, public_id: result.public_id };
}

async function migratePatients(summary) {
  const Patient = require('../models/Patient');
  const patients = await Patient.find({ photo: { $regex: '^/uploads/patients/' } });
  for (const patient of patients) {
    try {
      const { url, public_id } = await migrateOne(patient.photo, 'patients');
      patient.photo = url;
      patient.photo_public_id = public_id;
      await patient.save({ validateBeforeSave: false });
      summary.patients.ok++;
    } catch (err) {
      summary.patients.fail++;
      console.error(`  [patients] ${patient._id} — ${err.message}`);
    }
  }
}

async function migrateMedications(summary) {
  const Medication = require('../models/Medication');
  const meds = await Medication.find({ photo: { $regex: '^/uploads/medications/' } });
  for (const med of meds) {
    try {
      const { url } = await migrateOne(med.photo, 'medications');
      med.photo = url;
      await med.save({ validateBeforeSave: false });
      summary.medications.ok++;
    } catch (err) {
      summary.medications.fail++;
      console.error(`  [medications] ${med._id} — ${err.message}`);
    }
  }
}

async function migrateDocuments(summary) {
  const Document = require('../models/Document');
  const docs = await Document.find({ fichier_path: { $regex: '^/uploads/documents/' } });
  for (const doc of docs) {
    try {
      const { url } = await migrateOne(doc.fichier_path, 'documents');
      doc.fichier_path = url;
      await doc.save({ validateBeforeSave: false });
      summary.documents.ok++;
    } catch (err) {
      summary.documents.fail++;
      console.error(`  [documents] ${doc._id} — ${err.message}`);
    }
  }
}

async function migrateMessages(summary) {
  const Message = require('../models/Message');
  const msgs = await Message.find({ 'pieceJointe.path': { $regex: '^/uploads/messages/' } });
  for (const msg of msgs) {
    try {
      const { url } = await migrateOne(msg.pieceJointe.path, 'messages');
      msg.pieceJointe.path = url;
      await msg.save({ validateBeforeSave: false });
      summary.messages.ok++;
    } catch (err) {
      summary.messages.fail++;
      console.error(`  [messages] ${msg._id} — ${err.message}`);
    }
  }
}

async function migrateRadiology(summary) {
  const ImagingResult = require('../models/ImagingResult');
  const exams = await ImagingResult.find({ 'images.path': { $regex: '^/uploads/radiology/' } });
  for (const exam of exams) {
    for (const img of exam.images) {
      if (!img.path || !img.path.startsWith('/uploads/radiology/')) continue;
      try {
        const { url } = await migrateOne(img.path, 'radiology');
        img.path = url;
        summary.radiology.ok++;
      } catch (err) {
        summary.radiology.fail++;
        console.error(`  [radiology] ${exam._id} / ${img.filename} — ${err.message}`);
      }
    }
    await exam.save({ validateBeforeSave: false });
  }
}

async function migrateEchographie(summary) {
  const Echographie = require('../models/Echographie');
  const demandes = await Echographie.find({ 'images.url': { $regex: '^/uploads/echographie/' } });
  for (const demande of demandes) {
    for (const img of demande.images) {
      if (!img.url || !img.url.startsWith('/uploads/echographie/')) continue;
      try {
        const { url } = await migrateOne(img.url, 'echographie');
        img.url = url;
        summary.echographie.ok++;
      } catch (err) {
        summary.echographie.fail++;
        console.error(`  [echographie] ${demande._id} — ${err.message}`);
      }
    }
    await demande.save({ validateBeforeSave: false });
  }
}

async function run() {
  if (!cloudinaryUtil.isConfigured()) {
    console.error('❌ CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET non configurés — migration refusée (jamais une migration simulée).');
    process.exit(1);
  }
  await mongoose.connect(env.MONGO_URI);

  const summary = {
    patients: { ok: 0, fail: 0 }, medications: { ok: 0, fail: 0 },
    documents: { ok: 0, fail: 0 }, messages: { ok: 0, fail: 0 },
    radiology: { ok: 0, fail: 0 }, echographie: { ok: 0, fail: 0 },
  };

  await migratePatients(summary);
  await migrateMedications(summary);
  await migrateDocuments(summary);
  await migrateMessages(summary);
  await migrateRadiology(summary);
  await migrateEchographie(summary);

  console.log('\n✅ Migration terminée. Résumé (succès/échecs) :');
  for (const [cat, { ok, fail }] of Object.entries(summary)) {
    console.log(`  ${cat}: ${ok} migré(s), ${fail} échec(s)`);
  }
  console.log('\nLes fichiers locaux d\'origine (backend/uploads/) n\'ont PAS été supprimés — à nettoyer manuellement une fois la migration vérifiée sur le tableau de bord Cloudinary.');

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Erreur lors de la migration :', err);
    process.exit(2);
  });
}

module.exports = { run };
