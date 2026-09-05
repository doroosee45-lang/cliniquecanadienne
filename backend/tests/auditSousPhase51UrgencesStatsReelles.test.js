// Sous-phase 5.1 (relecture du 6 sept. 2026) — onglet Statistiques
// (Urgences.jsx) très majoritairement fabriqué : "Durée moy. séjour" (3h12),
// "Retours domicile"/"Hospitalisés"/"Transférés" (78%/18%/4%), "Flux
// horaire" et "Répartition motifs" tous codés en dur — alors que
// urgencesController.js::getStats calculait déjà réellement
// temps_attente_moy et un graphique 6 mois, jamais câblés côté frontend
// (import selectUrgencesChart resté mort dans Urgences.jsx).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Urgences) — onglet Statistiques réellement calculé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Urgence = require('../models/Urgence');
  const urgC = require('../controllers/urgencesController');

  const stamp = Date.now();
  const created = { urgences: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const now = new Date();
    const h = (n) => new Date(now.getTime() - n * 3600000);

    // Passage 1 — clôturé (retour_domicile), 2h de durée réelle, motif réel unique.
    const u1 = await Urgence.create({
      patient_nom: `T51-Urg1-${stamp}`, motif: `Motif-T51-${stamp}`, niveau_triage: 'vert',
      statut: 'sorti', date_arrivee: h(10), date_sortie: h(8), decision: 'retour_domicile',
    });
    // Passage 2 — clôturé (hospitalisation), 4h de durée réelle, même motif (pour tester le regroupement).
    const u2 = await Urgence.create({
      patient_nom: `T51-Urg2-${stamp}`, motif: `Motif-T51-${stamp}`, niveau_triage: 'orange',
      statut: 'hospitalise', date_arrivee: h(20), date_sortie: h(16), decision: 'hospitalisation',
    });
    // Passage 3 — toujours en attente (pas de date_sortie, pas de décision) : exclu des agrégats de durée/issues.
    const u3 = await Urgence.create({
      patient_nom: `T51-Urg3-${stamp}`, motif: 'Motif encore en attente', niveau_triage: 'jaune',
      statut: 'attente', date_arrivee: now,
    });
    created.urgences.push(u1._id, u2._id, u3._id);

    await t.test('getStats() calcule réellement durée moyenne, issues, motifs et flux horaire', async () => {
      const { status, body } = await call(urgC.getStats);
      assert.equal(status, 200, JSON.stringify(body));

      // Durée moyenne : agrégat global partagé réel — plausibilité vérifiée
      // (comme Hospitalization), la preuve forte est le avant/après (champ
      // absent avant correction).
      assert.ok(typeof body.kpis.duree_moy_min === 'number' && body.kpis.duree_moy_min > 0);

      // Issues réelles : nos 2 décisions doivent apparaître avec un poids réel non nul.
      const issRetour = body.issues.find(i => i.decision === 'retour_domicile');
      const issHosp = body.issues.find(i => i.decision === 'hospitalisation');
      assert.ok(issRetour && issRetour.pct > 0, 'retour_domicile réel doit apparaître');
      assert.ok(issHosp && issHosp.pct > 0, 'hospitalisation réelle doit apparaître');

      // Motif réel : notre motif unique (stampé) doit apparaître avec un
      // count de 2 (u1+u2), forcément le plus fréquent parmi les motifs
      // partageant ce stamp unique (isolation garantie par construction).
      const motifReel = body.repartition_motifs.find(m => m.motif === `Motif-T51-${stamp}`);
      assert.ok(motifReel, 'le motif réel créé deux fois doit apparaître dans le top motifs');
      assert.ok(motifReel.pct > 0);

      // Flux horaire réel : 12 tranches de 2h, total des comptages >= nos 3 passages réels.
      assert.equal(body.flux_horaire.labels.length, 12);
      const totalFlux = body.flux_horaire.data.reduce((s, n) => s + n, 0);
      assert.ok(totalFlux >= 3, `le flux horaire doit compter au moins nos 3 passages réels, obtenu ${totalFlux}`);
    });
  } finally {
    await Urgence.deleteMany({ _id: { $in: created.urgences } });
    await mongoose.disconnect();
  }
});
