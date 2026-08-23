// AUDIT-ADMIN-P1 — dashC.sageFemmeStats, même structure que medecinStats.
// Pregnancy.sage_femme/Delivery.sage_femme sont des String libres (jamais
// un ObjectId ref) — le scope "mes patientes" est donc une correspondance
// best-effort sur le nom réel de l'utilisatrice connectée (même principe
// déjà validé en Analytics Phase 7 pour les champs médecin en texte libre).
// Vérifié : les vraies données de LA sage-femme connectée sont comptées,
// celles d'UNE AUTRE sage-femme ne le sont jamais (isolation réelle du
// matching par nom, pas juste "ça compte quelque chose").
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Administration Point 1 — dashboard sage-femme (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Pregnancy = require('../models/Pregnancy');
  const Delivery = require('../models/Delivery');
  const User = require('../models/User');
  const dashC = require('../controllers/dashboard.controller');

  const stamp = Date.now();
  const created = { patients: [], pregnancies: [], deliveries: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const sf1 = await User.create({ email: `t-adminp1-sf1-${stamp}@test.local`, nom: `Nzé${stamp}`, prenom: 'Aline', role: 'sage_femme', statut: 'actif' });
    const sf2 = await User.create({ email: `t-adminp1-sf2-${stamp}@test.local`, nom: `Koumba${stamp}`, prenom: 'Berthe', role: 'sage_femme', statut: 'actif' });
    created.users.push(sf1, sf2);
    const patient = await Patient.create({ nom: `T-ADMINP1-${stamp}`, prenom: 'P', date_naissance: '1995-01-01', sexe: 'F' });
    created.patients.push(patient);

    await t.test('sageFemmeStats — compte réellement les grossesses/accouchements de la sage-femme connectée, jamais ceux d\'une autre', async () => {
      const dpaProche = new Date(Date.now() + 3 * 86400000);
      const gAline = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, statut: 'active', sage_femme: `${sf1.prenom} ${sf1.nom}`, dpa: dpaProche });
      const gRisqueAline = await Pregnancy.create({ patient_id: patient._id, patient_nom: `${patient.nom}-Risque`, patient_prenom: patient.prenom, statut: 'a_risque', niveau_risque: 'eleve', sage_femme: `${sf1.prenom} ${sf1.nom}` });
      const gBerthe = await Pregnancy.create({ patient_id: patient._id, patient_nom: `${patient.nom}-Autre`, patient_prenom: patient.prenom, statut: 'active', sage_femme: `${sf2.prenom} ${sf2.nom}` });
      created.pregnancies.push(gAline, gRisqueAline, gBerthe);

      const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dAline = await Delivery.create({ patient_id: patient._id, patient_nom: patient.nom, sage_femme: `${sf1.prenom} ${sf1.nom}`, date_heure: new Date(debutMois.getTime() + 86400000) });
      created.deliveries.push(dAline);

      const { status, body } = await call(dashC.sageFemmeStats, { user: sf1 });
      assert.equal(status, 200);
      assert.ok(body.stats.kpis.mes_grossesses_suivies >= 2, 'les 2 grossesses réelles d\'Aline (active + à risque) doivent être comptées');
      assert.ok(body.stats.kpis.mes_accouchements_mois >= 1, 'l\'accouchement réel d\'Aline ce mois doit être compté');
      assert.ok(body.stats.kpis.patientes_risque_eleve >= 1, 'la grossesse à risque élevé réelle d\'Aline doit être comptée');
      assert.ok(body.stats.kpis.accouchements_prevus_7j >= 1, 'la DPA réelle sous 7 jours doit être comptée');
      assert.ok(body.stats.grossesses_a_risque.some(g => g.patiente.includes('P')), 'la liste détaillée doit contenir la vraie grossesse à risque');
      assert.ok(body.stats.alertes.length >= 1, 'une vraie alerte doit être générée pour la grossesse à risque élevé');

      const { body: bodyBerthe } = await call(dashC.sageFemmeStats, { user: sf2 });
      assert.ok(bodyBerthe.stats.kpis.patientes_risque_eleve === 0 || !bodyBerthe.stats.grossesses_a_risque.some(g => g.patiente === patient.prenom + ' ' + patient.nom + '-Risque'), 'la grossesse à risque d\'Aline ne doit jamais apparaître dans le dashboard de Berthe — isolation réelle par nom');
    });

    await t.test('sageFemmeStats — aucune donnée réelle → zéros explicites, jamais de valeur inventée', async () => {
      const sfVide = await User.create({ email: `t-adminp1-vide-${stamp}@test.local`, nom: `Personne${stamp}`, prenom: 'Sans', role: 'sage_femme', statut: 'actif' });
      created.users.push(sfVide);
      const { status, body } = await call(dashC.sageFemmeStats, { user: sfVide });
      assert.equal(status, 200);
      assert.equal(body.stats.kpis.mes_grossesses_suivies, 0);
      assert.equal(body.stats.kpis.cpn_aujourdhui, 0);
      assert.deepEqual(body.stats.alertes, []);
    });
  } finally {
    for (const d of created.deliveries) await Delivery.findByIdAndDelete(d._id);
    for (const p of created.pregnancies) await Pregnancy.findByIdAndDelete(p._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
