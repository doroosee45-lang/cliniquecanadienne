// AUDIT-ECHOGRAPHIE-IMAGES — l'étape "Images" du wizard de réalisation
// capturait les fichiers via FileReader côté navigateur (state React local
// uniquement, jamais envoyés au serveur) : perdues au rafraîchissement/à la
// navigation, aucun bouton "Enregistrer" ne les persistait. Corrigé par un
// vrai upload (POST /echographie/:id/images, même pattern que
// radiology.controller.js::uploadImages) branché sur un bouton Enregistrer
// réel. Ce test vérifie que le contrôleur persiste bien les images, base
// réelle (le middleware multer lui-même n'est pas testé ici — req.files
// est simulé directement, comme les autres tests de ce projet qui
// contournent la couche HTTP).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { withLocalUploadFallback } = require('./helpers/forceLocalUploadFallback');

test('echographieController.uploadImages — persistance réelle des images (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Echographie = require('../models/Echographie');
  const User = require('../models/User');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const agent = await User.create({ email: `_echo-img-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'Img', role: 'radiologue', statut: 'actif' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [() => User.findByIdAndDelete(agent._id)];

  try {
    const demande = await Echographie.create({
      patient: new mongoose.Types.ObjectId(), patient_nom: `Patiente Img ${stamp}`, dossier: 'DOS-IMG-0001', age: 30, sexe: 'F',
      source: 'Maternité', medecin_presc: 'Dr. Test', type: 'Obstétricale', sous_type: 'Morphologique',
      motif: 'Contrôle', priorite: 'normale', statut: 'realisee',
    });
    cleanup.push(() => Echographie.findByIdAndDelete(demande._id));

    await t.test('des fichiers réellement reçus (req.files) sont persistés dans demande.images', async () => {
      // MIGRATION-CLOUDINARY — req.files[].buffer (multer memoryStorage),
      // plus de filename généré par multer côté disque. Force le repli
      // disque local même si CLOUDINARY_* est réellement configuré dans le
      // .env de cette machine.
      const { status, body } = await withLocalUploadFallback(() => call(echoC.uploadImages, {
        user: agent, ip: '127.0.0.1', params: { id: demande._id.toString() },
        files: [
          { originalname: 'coupe1.jpg', buffer: Buffer.from('img-a') },
          { originalname: 'coupe2.png', buffer: Buffer.from('img-b') },
        ],
      }));
      assert.equal(status, 200);
      assert.equal(body.images.length, 2);
      assert.match(body.images[0].url, /^\/uploads\/echographie\/\d+-0-coupe1\.jpg$/);
      assert.equal(body.images[0].description, 'coupe1.jpg');
      cleanup.push(() => fs.promises.unlink(path.join(__dirname, '..', body.images[0].url)).catch(() => {}));
      cleanup.push(() => fs.promises.unlink(path.join(__dirname, '..', body.images[1].url)).catch(() => {}));

      const relu = await Echographie.findById(demande._id).lean();
      assert.equal(relu.images.length, 2, 'les images doivent être réellement persistées en base, pas seulement renvoyées dans la réponse');
      assert.match(relu.images[1].url, /^\/uploads\/echographie\/\d+-1-coupe2\.png$/);
    });

    await t.test('aucun fichier reçu — 400, rien persisté', async () => {
      const { status, body } = await call(echoC.uploadImages, {
        user: agent, ip: '127.0.0.1', params: { id: demande._id.toString() }, files: [],
      });
      assert.equal(status, 400);
      assert.equal(body.success, false);
    });

    await t.test('demande introuvable — 404', async () => {
      // echographieController.js::uploadImages stocke les fichiers AVANT de
      // vérifier que la demande existe (comportement préexistant, non
      // modifié ici) : ce cas écrit donc bien un fichier réel sur disque
      // (repli local) malgré le 404 final — capturé ici pour nettoyage,
      // plutôt que d'en déduire le nom exact.
      const dir = path.join(__dirname, '..', 'uploads', 'echographie');
      const before = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
      const { status } = await withLocalUploadFallback(() => call(echoC.uploadImages, {
        user: agent, ip: '127.0.0.1', params: { id: new mongoose.Types.ObjectId().toString() },
        files: [{ originalname: 'x.jpg', buffer: Buffer.from('x') }],
      }));
      assert.equal(status, 404);
      const after = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      for (const f of after) if (!before.has(f)) cleanup.push(() => fs.promises.unlink(path.join(dir, f)).catch(() => {}));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
