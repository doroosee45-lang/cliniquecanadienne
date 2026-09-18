// AUDIT-18 (audit manuel complet du module hospitalization, 18 sept.
// 2026) — deux correctifs vérifiés ici :
//
// Correction 1 — update() (PUT /:id) n'excluait que `patient` de
// HOSP_BLOCKED_FIELDS : `statut` restait librement modifiable, y compris
// vers les valeurs terminales (sorti/transfere/decede), contournant
// entièrement discharge() (seule route légitime, PUT /:id/discharge) et
// toute sa logique métier réelle (libération du lit, calcul du coût,
// génération de facture, notification). Bloqué désormais au même titre
// que `patient`.
//
// Correction 3 — la section "Chambre & Lit" du dossier de séjour
// (frontend/src/pages/Hospitalization.jsx) envoyait `lit` (un champ qui
// n'existe pas dans le schéma Mongoose — seul lit_numero existe) via
// PUT /:id : silencieusement ignoré par Mongoose, aucune erreur, rien
// persisté. Ce test prouve que `lit_numero`, le vrai champ, persiste
// réellement.
//
// Données synthétiques de démonstration — aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('Hospitalization — update() bloque statut (Correction 1), persiste réellement lit_numero (Correction 3) (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Hospitalization = require('../models/Hospitalization');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Medecin' };
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `Audit18-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1990-01-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test synthétique', statut: 'en_cours' });
    cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));

    // ── Correction 1 ──
    await t.test('PUT /:id avec statut:"sorti" est bloqué — statut reste en_cours, discharge() jamais contourné', async () => {
      const r = await call(hospC.update, { params: { id: String(hosp._id) }, user, ip: '127.0.0.1', body: { statut: 'sorti', motif_entree: 'Motif modifié réellement' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      // Le champ légitime (motif_entree) doit toujours être persisté —
      // seul statut est bloqué, pas tout le endpoint.
      assert.equal(r.body.hospitalization.motif_entree, 'Motif modifié réellement');
      assert.equal(r.body.hospitalization.statut, 'en_cours', 'statut ne doit jamais être modifiable via update(), même explicitement envoyé');

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.statut, 'en_cours', 'aucune libération de lit, aucune facture, aucune notification ne doivent avoir été déclenchées — discharge() jamais atteint');
      assert.equal(fresh.date_sortie, undefined, 'date_sortie ne doit jamais être posée par cette voie contournée');
    });

    await t.test('non-régression — le vrai chemin (PUT /:id/discharge) continue de faire réellement la transition', async () => {
      const r = await call(hospC.discharge, { params: { id: String(hosp._id) }, user, ip: '127.0.0.1', body: {} });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.statut, 'sorti', 'discharge() reste le seul chemin légitime et fonctionne toujours');
    });

    // ── Correction 3 ──
    await t.test('PUT /:id avec lit_numero (le vrai champ) persiste réellement', async () => {
      const hosp2 = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test lit_numero', statut: 'en_cours' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp2._id));
      const r = await call(hospC.update, { params: { id: String(hosp2._id) }, user, ip: '127.0.0.1', body: { lit_numero: '07' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const fresh = await Hospitalization.findById(hosp2._id).lean();
      assert.equal(fresh.lit_numero, '07', 'lit_numero doit être réellement persisté, contrairement à l\'ancien champ `lit` inexistant au schéma');
    });

    await t.test('non-régression — envoyer l\'ancien champ `lit` (inexistant au schéma) reste silencieusement sans effet, comme avant, jamais une erreur inattendue', async () => {
      const hosp3 = await Hospitalization.create({ patient: patient._id, motif_entree: 'Test champ lit legacy', statut: 'en_cours' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp3._id));
      const r = await call(hospC.update, { params: { id: String(hosp3._id) }, user, ip: '127.0.0.1', body: { lit: '99' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const fresh = await Hospitalization.findById(hosp3._id).lean();
      assert.equal(fresh.lit_numero, undefined, 'le champ `lit` (non schématisé) ne doit jamais apparaître comme lit_numero');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
