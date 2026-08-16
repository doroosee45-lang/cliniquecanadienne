// Ticket 0006 / R-10b — le modèle Document n'était référencé nulle part
// dans le backend : aucun endpoint d'upload, donc hash_integrite jamais
// calculé. Ce test vérifie le nouvel endpoint minimal (upload, hash,
// consultation, statut par défaut actif) — pas les transitions de cycle
// de vie, hors périmètre par décision explicite.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

test('upload de document + hash d\'intégrité (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Document = require('../models/Document');
  require('../models/User'); // enregistré pour Document.populate('created_by') dans getAll/getOne
  require('../models/Patient'); // idem pour populate('patient')
  const docC = require('../controllers/document.controller');

  const admin = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
  const cleanup = [];

  // next() capturant l'erreur au lieu de l'avaler silencieusement — sinon
  // un contrôleur qui échoue et appelle next(err) laisse juste res.json()
  // jamais invoqué, sans indice sur la cause réelle.
  const call = async (fn, req) => {
    let status = 200, body = null, error = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { error = err; });
    if (error) throw error;
    return { status, body };
  };

  try {
    await t.test('create() calcule le hash SHA-256 réel du fichier reçu', async () => {
      const content = `contenu-test-${Date.now()}`;
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      const tmpPath = path.join(os.tmpdir(), `doc-test-${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, content);
      cleanup.push(() => fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath));

      const { status, body } = await call(docC.create, {
        user: admin, ip: '127.0.0.1',
        body: { nom: 'Justificatif test', type: 'autre' },
        file: { path: tmpPath, filename: path.basename(tmpPath), size: content.length, mimetype: 'application/pdf', originalname: 'justificatif.pdf' },
      });

      assert.equal(status, 201);
      assert.equal(body.document.hash_integrite, expectedHash, 'le hash stocké doit correspondre au SHA-256 réel du contenu');
      assert.equal(body.document.lifecycle_statut, 'actif', 'statut par défaut');
      assert.equal(body.document.nom, 'Justificatif test');
      assert.equal(body.document.fichier_path, `/uploads/documents/${path.basename(tmpPath)}`);
      const createdId = body.document._id;
      cleanup.push(() => Document.findByIdAndDelete(createdId));
    });

    await t.test('create() refuse un upload sans fichier', async () => {
      const { status } = await call(docC.create, { user: admin, ip: '127.0.0.1', body: {} });
      assert.equal(status, 400);
    });

    await t.test('getAll retourne le document créé, getOne le récupère individuellement', async () => {
      const tmpPath = path.join(os.tmpdir(), `doc-test-list-${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, 'contenu-liste');
      cleanup.push(() => fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath));

      const created = await call(docC.create, {
        user: admin, ip: '127.0.0.1',
        body: { nom: 'Doc pour liste', type: 'autre' },
        file: { path: tmpPath, filename: path.basename(tmpPath), size: 12, mimetype: 'application/pdf', originalname: 'liste.pdf' },
      });
      const createdId = created.body.document._id;
      cleanup.push(() => Document.findByIdAndDelete(createdId));

      const list = await call(docC.getAll, { query: {} });
      assert.equal(list.status, 200);
      assert.ok(list.body.documents.some(d => String(d._id) === String(createdId)));

      const one = await call(docC.getOne, { params: { id: createdId } });
      assert.equal(one.status, 200);
      assert.equal(one.body.document.nom, 'Doc pour liste');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
