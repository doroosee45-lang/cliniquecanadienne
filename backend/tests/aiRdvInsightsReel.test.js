// MODULE AI — sous-module Rendez-vous (implémentation réelle demandée
// explicitement pour remplacer le placeholder "🚧 Fonctionnalité en cours
// de développement" posé en Sous-phase 5.6 à la place d'une "prévision
// d'affluence" et d'une "charge par médecin" entièrement fabriquées).
//
// ai.controller.js::getRdvInsights ne prédit rien : il agrège les vrais
// Appointment déjà planifiés pour la semaine en cours (statut ≠ annulé),
// par jour et par médecin. Aucune capacité/suggestion inventée.
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
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

test('AI/Rendez-vous — getRdvInsights agrège la vraie charge de la semaine, jamais une prévision inventée (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `AIRdv-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1992-05-01' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medA = await User.create({ email: `_airdv-meda-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Alpha', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medA._id));
    const medB = await User.create({ email: `_airdv-medb-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Beta', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medB._id));

    // Lundi de la semaine en cours — même calcul que getRdvInsights, pour
    // placer des rendez-vous synthétiques à des jours déterministes de LA
    // semaine réellement en cours au moment du test.
    const now = new Date();
    const jour = now.getDay();
    const decalage = jour === 0 ? 6 : jour - 1;
    const lundi = new Date(now);
    lundi.setDate(now.getDate() - decalage);
    lundi.setHours(9, 0, 0, 0);
    const mercredi = new Date(lundi); mercredi.setDate(lundi.getDate() + 2);
    const vendredi = new Date(lundi); vendredi.setDate(lundi.getDate() + 4);

    const mk = (date, medecin, statut = 'planifie') => Appointment.create({ patient: patient._id, medecin, date_heure: date, motif: 'Test synthétique', statut });

    // Base réelle partagée (Atlas) : d'autres rendez-vous réels/de
    // démonstration peuvent déjà exister cette semaine, indépendamment de
    // ce test. Comparaison AVANT/APRÈS (delta), jamais un total absolu
    // supposé, pour isoler précisément l'effet des données synthétiques
    // ajoutées ici.
    const avant = await call(aiC.getRdvInsights, {});
    const baseParJour = avant.body.semaine.data.slice();
    const baseTotal = avant.body.total_semaine;

    const rdv1 = await mk(lundi, medA._id); cleanup.push(() => Appointment.findByIdAndDelete(rdv1._id));
    const rdv2 = await mk(mercredi, medA._id); cleanup.push(() => Appointment.findByIdAndDelete(rdv2._id));
    const rdv3 = await mk(mercredi, medB._id); cleanup.push(() => Appointment.findByIdAndDelete(rdv3._id));
    const rdv4 = await mk(vendredi, medA._id); cleanup.push(() => Appointment.findByIdAndDelete(rdv4._id));
    // Annulé — ne doit jamais compter dans la charge réelle.
    const rdvAnnule = await mk(vendredi, medA._id, 'annule'); cleanup.push(() => Appointment.findByIdAndDelete(rdvAnnule._id));

    await t.test('charge de la semaine réelle par jour (annulé exclu) — delta avant/après isolant les données synthétiques', async () => {
      const r = await call(aiC.getRdvInsights, {});
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.total_semaine - baseTotal, 4, 'le rendez-vous annulé ne doit jamais être compté (4 réels ajoutés sur 5 créés)');
      assert.equal(r.body.semaine.data[0] - baseParJour[0], 1, 'lundi : +1 rendez-vous réel');
      assert.equal(r.body.semaine.data[2] - baseParJour[2], 2, 'mercredi : +2 rendez-vous réels (2 médecins)');
      assert.equal(r.body.semaine.data[4] - baseParJour[4], 1, 'vendredi : +1 rendez-vous réel (le second, annulé, exclu)');
      assert.deepEqual(r.body.semaine.labels, ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
    });

    await t.test('charge par médecin réelle, triée décroissante, jamais une capacité inventée', async () => {
      const r = await call(aiC.getRdvInsights, {});
      const alpha = r.body.charge_medecins.find(m => m.medecin.includes('Alpha'));
      const beta = r.body.charge_medecins.find(m => m.medecin.includes('Beta'));
      assert.equal(alpha.nb, 3, 'Dr Alpha : lundi + mercredi + vendredi (annulé exclu)');
      assert.equal(beta.nb, 1);
      assert.equal(r.body.charge_medecins[0].medecin, alpha.medecin, 'triée décroissante — le plus chargé en premier');
      // Aucun champ de capacité/pourcentage de charge ne doit jamais être
      // renvoyé — rien de tel n'existe réellement dans ce système.
      assert.equal('capacite' in alpha, false);
      assert.equal('pct' in alpha, false);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
