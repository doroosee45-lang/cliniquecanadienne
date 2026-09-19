// AUDIT-20-6 (19 sept. 2026, audit indépendant) —
// hospitalization.controller.js::makeSubResource (factory partagée par les
// 5 sous-ressources du dossier de séjour : constantes, traitements,
// examens, visites, prescriptions_sejour) faisait findById() puis
// push()/mutation en mémoire + hosp.save() du document Hospitalization
// PARENT entier, pour add() ET update(). Cause racine exacte : le
// versioning optimiste natif de Mongoose (__v, actif par défaut, jamais
// désactivé sur ce schéma) fait échouer l'un des deux .save() concurrents
// avec une VersionError explicite dès que deux écritures visent le même
// document parent — même si elles ne touchent aucun champ commun (ex. une
// infirmière ajoute une constante pendant qu'un médecin met à jour un
// traitement, sur le même séjour). Reproduit directement (contre un mongod
// local à faible latence, où la fenêtre de course est la plus large) :
// add()-vs-add() sur la MÊME sous-ressource, jusqu'à 20 concurrents, n'a
// jamais échoué — mais updateTraitement()-vs-addExamen() concurrents sur
// le même séjour a produit "VersionError: No matching document found ...
// version N" (500 brut). Différent en nature des bugs déjà corrigés dans ce
// projet (perte silencieuse de données) — ici une erreur visible forçant un
// nouvel essai côté client, mais réelle sous usage clinique concurrent
// réaliste.
//
// Corrigé : add() → findByIdAndUpdate + $push (chaque ajout est sa propre
// opération atomique) ; update() → findOneAndUpdate + $set positionnel via
// arrayFilters (ne touche que le sous-document ciblé, jamais le document
// parent entier) — ni l'un ni l'autre ne peut plus jamais entrer en
// conflit de version avec une écriture concurrente sur ce même séjour.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message, name: err.name }; } });
  return { status, body };
};

test('AUDIT-20-6 — sous-ressources du dossier de séjour atomiques sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Concurrence' };
  const created = { patients: [], hosps: [] };

  try {
    const patient = await Patient.create({ nom: `Audit20-6-${stamp}`, prenom: 'P', sexe: 'F', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);

    await t.test('4 sous-ressources différentes ajoutées en parallèle sur le même séjour → les 4 réussissent (201)', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test concurrence multi-ressources' });
      created.hosps.push(hosp._id);

      const [rConst, rTrait, rExam, rVisite] = await Promise.all([
        call(hospC.addConstante, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: { temperature: 37.2, tension_sys: 120, tension_dia: 80 } }),
        call(hospC.addTraitement, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: { medicament: 'Paracétamol', dose: '1g' } }),
        call(hospC.addExamen, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: { type: 'labo', designation: 'NFS' } }),
        call(hospC.addVisite, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: { visiteur: 'Famille' } }),
      ]);

      assert.equal(rConst.status, 201, JSON.stringify(rConst.body));
      assert.equal(rTrait.status, 201, JSON.stringify(rTrait.body));
      assert.equal(rExam.status, 201, JSON.stringify(rExam.body));
      assert.equal(rVisite.status, 201, JSON.stringify(rVisite.body));

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.constantes.length, 1);
      assert.equal(fresh.traitements.length, 1);
      assert.equal(fresh.examens.length, 1);
      assert.equal(fresh.visites.length, 1);
    });

    await t.test('8 ajouts concurrents sur la MÊME sous-ressource (visites) → les 8 sont persistés, aucun perdu', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test concurrence même ressource' });
      created.hosps.push(hosp._id);

      const N = 8;
      const results = await Promise.all(Array.from({ length: N }, (_, i) =>
        call(hospC.addVisite, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: { visiteur: `Visiteur${i}` } })
      ));
      for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.visites.length, N, `les ${N} visites doivent toutes être persistées, aucune perdue sous concurrence réelle`);
      const visiteurs = new Set(fresh.visites.map(v => v.visiteur));
      assert.equal(visiteurs.size, N, 'chaque visite doit être réellement distincte, aucun écrasement');
    });

    await t.test('update() d\'un traitement EN COURSE avec add() d\'un examen sur le même séjour → les deux réussissent, jamais de VersionError', async () => {
      const hosp = await Hospitalization.create({
        patient: patient._id, motif_entree: 'Test concurrence update/add',
        traitements: [{ medicament: 'Initial', statut: 'planifie' }],
      });
      created.hosps.push(hosp._id);
      const traitementId = hosp.traitements[0]._id.toString();

      const [rUpdate, rAdd] = await Promise.all([
        call(hospC.updateTraitement, { params: { id: hosp._id.toString(), sid: traitementId }, user, ip: '127.0.0.1', body: { statut: 'administre' } }),
        call(hospC.addExamen, { params: { id: hosp._id.toString() }, user, ip: '127.0.0.1', body: { type: 'labo', designation: 'Test concurrent' } }),
      ]);

      assert.equal(rUpdate.status, 200, `updateTraitement ne doit jamais échouer avec une VersionError sous concurrence réelle — obtenu ${rUpdate.status} ${rUpdate.body.name || ''} ${rUpdate.body.message || ''}`);
      assert.equal(rAdd.status, 201, JSON.stringify(rAdd.body));

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.traitements[0].statut, 'administre', 'la mise à jour du traitement doit être réellement persistée');
      assert.equal(fresh.examens.length, 1, 'l\'examen ajouté en parallèle doit être réellement persisté, jamais perdu');
    });

    await t.test('non-régression — 404 "Hospitalisation introuvable" sur un séjour inexistant', async () => {
      const fauxId = new mongoose.Types.ObjectId().toString();
      const { status, body } = await call(hospC.addVisite, { params: { id: fauxId }, user, ip: '127.0.0.1', body: { visiteur: 'X' } });
      assert.equal(status, 404);
      assert.match(body.message, /Hospitalisation introuvable/);

      const { status: s2, body: b2 } = await call(hospC.updateTraitement, { params: { id: fauxId, sid: new mongoose.Types.ObjectId().toString() }, user, ip: '127.0.0.1', body: { statut: 'administre' } });
      assert.equal(s2, 404);
      assert.match(b2.message, /Hospitalisation introuvable/);
    });

    await t.test('non-régression — 404 "Traitement introuvable" sur un sous-document inexistant (séjour réel)', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test 404 sous-document', traitements: [{ medicament: 'X' }] });
      created.hosps.push(hosp._id);
      const fauxSid = new mongoose.Types.ObjectId().toString();

      const { status, body } = await call(hospC.updateTraitement, { params: { id: hosp._id.toString(), sid: fauxSid }, user, ip: '127.0.0.1', body: { statut: 'administre' } });
      assert.equal(status, 404);
      assert.match(body.message, /Traitement introuvable/);

      // sid malformé (pas un ObjectId) — doit rester un 404 propre, jamais un 500.
      const { status: s2, body: b2 } = await call(hospC.updateTraitement, { params: { id: hosp._id.toString(), sid: 'pas-un-objectid' }, user, ip: '127.0.0.1', body: { statut: 'administre' } });
      assert.equal(s2, 404, JSON.stringify(b2));
    });

    await t.test('non-régression — update() applique réellement le changement en usage séquentiel normal', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test update séquentiel', examens: [{ type: 'labo', designation: 'NFS', statut: 'attente' }] });
      created.hosps.push(hosp._id);
      const examenId = hosp.examens[0]._id.toString();

      const { status, body } = await call(hospC.updateExamen, { params: { id: hosp._id.toString(), sid: examenId }, user, ip: '127.0.0.1', body: { statut: 'resultat', resultat: 'Normal' } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.examen.resultat, 'Normal');

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.examens[0].resultat, 'Normal', 'relecture fraîche : la mise à jour doit être réellement persistée');
      assert.equal(fresh.examens[0].statut, 'resultat');
    });
  } finally {
    for (const id of created.hosps) await Hospitalization.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
