// Audit du 17 sept. 2026 — deux écarts confirmés dans
// consultations.controller.js :
//
// 1. create() ne vérifiait req.body.medecin que pour sa FORME (isObjectId),
// jamais son existence réelle ni son rôle — même garde manquante que celle
// déjà comblée pour patient (CLIN-07) et appointment (RDV-CONSULT-002)
// dans ce même fichier. Cas non couvert par
// auditCorrection6MedecinReelConsultation.test.js (qui ne teste que le cas
// "absent").
//
// 2. update() ne bloquait pas structurellement une transition vers
// statut:'terminee', qui déclenche pourtant dans create() la génération
// automatique de Prescription/Invoice/LabResult/ImagingResult. Un appel
// direct à PUT /consultations/:id (jamais fait par Consultations.jsx
// aujourd'hui, vérifié) aurait pu clôturer une consultation avec des
// prescriptions/frais déjà renseignés SANS jamais générer ces documents —
// défense en profondeur, pas une exploitation confirmée aujourd'hui.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('Consultations — audit du 17 sept. 2026 : medecin réellement vérifié, clôture bloquée via update() (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const consultC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `Sept17Consult-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1990-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecinReel = await User.create({ email: `_sept17-consult-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecinReel._id));
    const infirmier = await User.create({ email: `_sept17-consult-inf-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Inf', role: 'infirmier', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(infirmier._id));

    // ── Finding 1 : medecin réellement vérifié ──
    await t.test('create() — ObjectId syntaxiquement valide mais ne référençant aucun User → 404, jamais accepté', async () => {
      const faux = new mongoose.Types.ObjectId();
      const r = await call(consultC.create, { user: infirmier, ip: '127.0.0.1', body: { patient: String(patient._id), medecin: String(faux), type_consultation: 'generale', motif: 'Test' } });
      assert.equal(r.status, 404, JSON.stringify(r.body));
      assert.match(r.body.message, /Médecin introuvable/);
    });

    await t.test('create() — ObjectId réel mais référençant un User qui n\'est pas medecin (infirmier) → 404, jamais accepté', async () => {
      const r = await call(consultC.create, { user: infirmier, ip: '127.0.0.1', body: { patient: String(patient._id), medecin: String(infirmier._id), type_consultation: 'generale', motif: 'Test' } });
      assert.equal(r.status, 404, JSON.stringify(r.body));
      assert.match(r.body.message, /Médecin introuvable/);
    });

    await t.test('create() — medecin réel désactivé (statut inactif) → 404, jamais accepté', async () => {
      const medecinInactif = await User.create({ email: `_sept17-consult-medinactif-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'DrInactif', role: 'medecin', statut: 'inactif' });
      cleanup.push(() => User.findByIdAndDelete(medecinInactif._id));
      const r = await call(consultC.create, { user: infirmier, ip: '127.0.0.1', body: { patient: String(patient._id), medecin: String(medecinInactif._id), type_consultation: 'generale', motif: 'Test' } });
      assert.equal(r.status, 404, JSON.stringify(r.body));
    });

    await t.test('create() — non-régression : un vrai médecin actif reste accepté et correctement attribué', async () => {
      const r = await call(consultC.create, { user: infirmier, ip: '127.0.0.1', body: { patient: String(patient._id), medecin: String(medecinReel._id), type_consultation: 'generale', motif: 'Test non-régression' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Consultation.findByIdAndDelete(r.body.consultation._id));
      assert.equal(String(r.body.consultation.medecin), String(medecinReel._id));
    });

    // ── Finding 2 : update() bloque la transition vers terminee ──
    await t.test('update() — tentative de clôture directe (statut: terminee) refusée (400), jamais de transition silencieuse', async () => {
      const enCours = await Consultation.create({ patient: patient._id, medecin: medecinReel._id, statut: 'en_cours', type_consultation: 'generale', motif: 'Test clôture directe' });
      cleanup.push(() => Consultation.findByIdAndDelete(enCours._id));

      const r = await call(consultC.update, {
        params: { id: String(enCours._id) }, user: medecinReel, ip: '127.0.0.1',
        body: { statut: 'terminee', prescriptions: [{ medicament_nom: 'Test', posologie: '1x/j', duree: '5j' }], frais_consultation: 15000 },
      });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.match(r.body.message, /clôture/i);

      const Prescription = require('../models/Prescription');
      const Invoice = require('../models/Invoice');
      const fresh = await Consultation.findById(enCours._id).lean();
      assert.equal(fresh.statut, 'en_cours', 'le statut ne doit jamais avoir été modifié par la tentative bloquée');
      const presc = await Prescription.findOne({ consultation: enCours._id });
      assert.equal(presc, null, 'aucune prescription ne doit avoir été générée par une clôture bloquée');
      const inv = await Invoice.findOne({ consultation: enCours._id });
      assert.equal(inv, null, 'aucune facture ne doit avoir été générée par une clôture bloquée');
    });

    await t.test('update() — non-régression : modifier un autre champ (ex. anamnese) sans toucher au statut reste autorisé', async () => {
      const enCours = await Consultation.create({ patient: patient._id, medecin: medecinReel._id, statut: 'en_cours', type_consultation: 'generale', motif: 'Test édition normale' });
      cleanup.push(() => Consultation.findByIdAndDelete(enCours._id));
      const r = await call(consultC.update, { params: { id: String(enCours._id) }, user: medecinReel, ip: '127.0.0.1', body: { anamnese: 'Note complémentaire réelle ajoutée après coup.' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.consultation.anamnese, 'Note complémentaire réelle ajoutée après coup.');
      assert.equal(r.body.consultation.statut, 'en_cours');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
