// PERF-001-DATE-FILTER (trouvé le 14 sept. 2026 en relançant la suite après
// le correctif SEC-DOC-01, sans rapport avec lui) — appointments.controller
// .js::getAll construit la fenêtre du filtre `date` en mélangeant deux
// référentiels temporels : `new Date(dateString)` (une chaîne "YYYY-MM-DD"
// est toujours interprétée comme minuit UTC par le moteur JS) PUIS
// `.setHours(0,0,0,0)`/`.setHours(23,59,59,999)` (heure LOCALE du serveur).
// Sur un serveur dont le fuseau local n'est pas UTC (ex. Europe/Paris,
// UTC+2 l'été), la fenêtre résultante est décalée de l'offset local par
// rapport au jour UTC réellement demandé — un rendez-vous créé "maintenant"
// et interrogé pour "aujourd'hui" (date UTC) peut tomber hors fenêtre
// pendant la portion de la journée où le jour calendaire UTC et le jour
// calendaire local diffèrent (ex. entre minuit et 2h heure de Paris, la
// date UTC est encore "hier"). Reproduit réellement : perf001
// AppointmentsGetAllLean.test.js a commencé à échouer au changement de jour
// sans qu'aucun code lié aux rendez-vous n'ait été touché.
//
// Ce test prouve le comportement attendu avec des horodatages UTC fixes et
// connus (jamais new Date() sans argument pour les bornes), afin de rester
// vrai quel que soit le fuseau local de la machine qui l'exécute.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('PERF-001-DATE-FILTER — GET /appointments?date= respecte le jour calendaire UTC demandé, quel que soit le fuseau local du serveur (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const apptC = require('../controllers/appointments.controller');

  const stamp = Date.now();
  const call = async (query) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await apptC.getAll({ query }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `PerfDate-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const medecin = await User.create({ email: `_perfdate-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test', role: 'medecin', statut: 'actif' });

  // Jour de référence fixe (jamais "aujourd'hui" — un test qui dépend de la
  // date d'exécution reproduit exactement le bug qu'il vérifie).
  const JOUR = '2026-06-15'; // mercredi, sans lien avec un jour férié/DST particulier
  const cleanup = [];

  const mk = async (label, iso) => {
    const appt = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(iso), motif: `PerfDate-${label}-${stamp}`, statut: 'planifie', created_by: medecin._id });
    cleanup.push(() => Appointment.findByIdAndDelete(appt._id));
    return appt;
  };

  try {
    const apptMidi      = await mk('midi',        `${JOUR}T12:00:00.000Z`);
    const apptDebutJour  = await mk('debut-jour',  `${JOUR}T00:00:00.000Z`);
    const apptFinJour    = await mk('fin-jour',    `${JOUR}T23:59:59.999Z`);
    const apptVeilleFin  = await mk('veille-fin',  `2026-06-14T23:59:59.999Z`); // 1ms avant le jour
    const apptLendemainDebut = await mk('lendemain-debut', `2026-06-16T00:00:00.000Z`); // 1ms après le jour

    await t.test('rendez-vous du jour (milieu de journée) inclus', async () => {
      const { status, body } = await call({ date: JOUR });
      assert.equal(status, 200);
      assert.ok(body.appointments.some(a => String(a._id) === String(apptMidi._id)), 'le RDV de midi doit apparaître');
    });

    await t.test('rendez-vous en tout début de journée (00:00:00.000Z) inclus', async () => {
      const { body } = await call({ date: JOUR });
      assert.ok(body.appointments.some(a => String(a._id) === String(apptDebutJour._id)), 'le RDV de 00:00:00.000Z doit apparaître');
    });

    await t.test('rendez-vous en toute fin de journée (23:59:59.999Z) inclus', async () => {
      const { body } = await call({ date: JOUR });
      assert.ok(body.appointments.some(a => String(a._id) === String(apptFinJour._id)), 'le RDV de 23:59:59.999Z doit apparaître');
    });

    await t.test('rendez-vous de la veille (23:59:59.999Z le jour précédent) exclu de la journée demandée', async () => {
      const { body } = await call({ date: JOUR });
      assert.ok(!body.appointments.some(a => String(a._id) === String(apptVeilleFin._id)), 'le RDV de la veille ne doit jamais apparaître dans le jour suivant');
    });

    await t.test('rendez-vous du lendemain (00:00:00.000Z le jour suivant) exclu de la journée demandée', async () => {
      const { body } = await call({ date: JOUR });
      assert.ok(!body.appointments.some(a => String(a._id) === String(apptLendemainDebut._id)), 'le RDV du lendemain ne doit jamais apparaître dans le jour précédent');
    });

    await t.test('interroger la date précédente retrouve exactement le RDV de la veille', async () => {
      const { body } = await call({ date: '2026-06-14' });
      assert.ok(body.appointments.some(a => String(a._id) === String(apptVeilleFin._id)), 'le RDV de la veille doit apparaître en interrogeant son propre jour');
      assert.ok(!body.appointments.some(a => String(a._id) === String(apptMidi._id)), 'le RDV du jour de référence ne doit pas apparaître dans la veille');
    });

    await t.test('interroger la date suivante retrouve exactement le RDV du lendemain', async () => {
      const { body } = await call({ date: '2026-06-16' });
      assert.ok(body.appointments.some(a => String(a._id) === String(apptLendemainDebut._id)), 'le RDV du lendemain doit apparaître en interrogeant son propre jour');
      assert.ok(!body.appointments.some(a => String(a._id) === String(apptMidi._id)), 'le RDV du jour de référence ne doit pas apparaître dans le lendemain');
    });

    await t.test('non-régression — le filtre from/to (plage explicite) continue de fonctionner', async () => {
      const { status, body } = await call({ from: `${JOUR}T00:00:00.000Z`, to: `${JOUR}T23:59:59.999Z` });
      assert.equal(status, 200);
      assert.ok(body.appointments.some(a => String(a._id) === String(apptMidi._id)));
      assert.ok(!body.appointments.some(a => String(a._id) === String(apptVeilleFin._id)));
    });

    await t.test('non-régression — sans filtre de date, la fenêtre par défaut (60j passés → 1 an à venir autour d\'aujourd\'hui) reste appliquée', async () => {
      const { status, body } = await call({});
      assert.equal(status, 200);
      // Le jour de référence (2026-06-15) est loin dans le passé par rapport
      // à "aujourd'hui" (session courante, sept. 2026) — hors de la fenêtre
      // par défaut de 60 jours passés, donc absent ici. Seule la structure
      // de la réponse est vérifiée (aucune erreur, forme correcte).
      assert.equal(typeof body.total, 'number');
      assert.ok(Array.isArray(body.appointments));
    });
  } finally {
    for (const fn of cleanup) await fn();
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
