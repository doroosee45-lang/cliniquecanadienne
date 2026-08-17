// P7-1 / P7-2 — audit2-9 : deux constats liés sur le module hospitalisation.
//
// P7-1 : hospC.update existait déjà (générique findByIdAndUpdate) mais
// n'était routé nulle part → PUT /hospitalization/:id retournait 404. La
// sortie patient (enregistrerSortie côté front) appelait ce même endpoint
// inexistant au lieu de PUT /:id/discharge — la vraie logique de sortie
// (libération du lit, notification patient) n'était donc jamais atteinte.
// Le formulaire de sortie envoie aussi des champs (etat_patient,
// recommandations, rdv_controle, heure_sortie) absents du schéma jusqu'ici.
//
// P7-2 : les 5 sections du "dossier de séjour" (constantes, traitements,
// examens, visites, prescriptions en cours de séjour) appelaient des routes
// GET/POST /hospitalization/:id/<ressource> qui n'existaient nulle part côté
// serveur — masqué côté front par Promise.allSettled (retombe sur []).
//
// Vérifie contre la vraie base (MONGO_URI) que : les routes sont bien
// montées, PUT /:id persiste réellement, PUT /:id/discharge reste
// fonctionnel (statut + libération du lit + nouveaux champs), et que les 10
// routes des 5 sous-ressources persistent/retournent réellement leurs
// données (relecture fraîche .findById().lean()).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P7-1/P7-2 — hospitalisation : PUT /:id, discharge, sous-ressources du séjour (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Hospitalization = require('../models/Hospitalization');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Room = require('../models/Room');
  const hospC = require('../controllers/hospitalization.controller');
  const hospRoutes = require('../routes/hospitalization.routes');

  const stamp = Date.now();
  const user = await User.create({ email: `_p71-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'P71', prenom: 'Test', role: 'medecin', statut: 'actif' });
  const patient = await Patient.create({ nom: `P71Pat${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email: `_p71-pat-${stamp}@_test.local` });

  const cleanup = [];
  const mkRes = () => {
    const res = {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
  };

  let hosp;

  try {
    // ── (préalable) Les routes sont réellement montées, pas seulement les
    // fonctions contrôleur — c'est précisément le bug constaté pour PUT /:id.
    await t.test('routes montées : PUT /:id générique + les 10 routes des sous-ressources', () => {
      const registered = hospRoutes.stack
        .filter(l => l.route)
        .map(l => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));

      const expectRoute = (path, method) => {
        const found = registered.find(r => r.path === path && r.methods.includes(method));
        assert.ok(found, `route manquante : ${method.toUpperCase()} ${path}`);
      };
      expectRoute('/:id', 'put');
      expectRoute('/:id/discharge', 'put');
      for (const res of ['constantes', 'traitements', 'examens', 'visites', 'prescriptions']) {
        expectRoute(`/:id/${res}`, 'get');
        expectRoute(`/:id/${res}`, 'post');
      }
    });

    await t.test('PUT /:id générique persiste réellement une modification (contact_urgence)', async () => {
      hosp = await Hospitalization.create({
        patient: patient._id, medecin_responsable: user._id, service_nom: 'Médecine',
        motif_entree: 'Test P7-1', lit_numero: `P71-${stamp}`, contact_urgence: 'Ancien contact',
      });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));

      const res = mkRes();
      await hospC.update(
        { params: { id: hosp._id }, body: { contact_urgence: 'Nouveau contact', tel_urgence: '06-00-00-00' }, user, ip: '127.0.0.1' },
        res, () => {}
      );
      assert.equal(res.body.success, true);

      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.contact_urgence, 'Nouveau contact');
      assert.equal(fresh.tel_urgence, '06-00-00-00');
    });

    await t.test('PUT /:id/discharge reste fonctionnel : libère le lit et persiste les nouveaux champs de sortie', async () => {
      const room = await Room.create({ numero: `P71R-${stamp}`, lits: [{ numero: 'L1', statut: 'occupe', patient_actuel: patient._id }] });
      cleanup.push(() => Room.findByIdAndDelete(room._id));

      const hosp2 = await Hospitalization.create({
        patient: patient._id, medecin_responsable: user._id, chambre: room._id, service_nom: 'Médecine',
        motif_entree: 'Test discharge', lit_numero: 'L1', statut: 'en_cours',
      });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp2._id));

      const res = mkRes();
      await hospC.discharge(
        {
          params: { id: hosp2._id },
          body: { etat_patient: 'gueri', recommandations: 'Repos, hydratation', rdv_controle: 'Dans 2 semaines', heure_sortie: '14:30', diagnostic_sortie: 'Guéri' },
          user, ip: '127.0.0.1',
        },
        res, () => {}
      );
      assert.equal(res.body.success, true);

      const freshHosp = await Hospitalization.findById(hosp2._id).lean();
      assert.equal(freshHosp.statut, 'sorti');
      assert.ok(freshHosp.date_sortie, 'date_sortie doit être renseignée');
      assert.equal(freshHosp.etat_patient, 'gueri');
      assert.equal(freshHosp.recommandations, 'Repos, hydratation');
      assert.equal(freshHosp.rdv_controle, 'Dans 2 semaines');
      assert.equal(freshHosp.heure_sortie, '14:30');
      assert.equal(freshHosp.diagnostic_sortie, 'Guéri');

      const freshRoom = await Room.findById(room._id).lean();
      const bed = freshRoom.lits.find(l => l.numero === 'L1');
      assert.equal(bed.statut, 'libre', 'le lit doit être libéré');
      assert.equal(bed.patient_actuel, undefined, 'le lit ne doit plus référencer de patient');
    });

    // ── Les 5 sous-ressources du dossier de séjour ──────────────────────
    const subResources = [
      {
        seg: 'constantes', add: 'addConstante', get: 'getConstantes', field: 'constantes', singular: 'constante', plural: 'constantes',
        payload: { temperature: 37.2, tension_sys: 120, tension_dia: 80, fc: 72, spo2: 98, poids: 70, note_med: 'RAS', note_inf: 'Patient calme' },
      },
      {
        seg: 'traitements', add: 'addTraitement', get: 'getTraitements', field: 'traitements', singular: 'traitement', plural: 'traitements',
        payload: { medicament: 'Paracétamol', dose: '1g', heure: '08:00', voie: 'orale', personnel: 'Inf. Test', statut: 'administre' },
      },
      {
        seg: 'examens', add: 'addExamen', get: 'getExamens', field: 'examens', singular: 'examen', plural: 'examens',
        payload: { type: 'labo', designation: 'NFS', statut: 'attente', resultat: '' },
      },
      {
        seg: 'visites', add: 'addVisite', get: 'getVisites', field: 'visites', singular: 'visite', plural: 'visites',
        payload: { visiteur: 'Famille', heure_entree: '14:00', heure_sortie: '15:00', note: 'Visite calme' },
      },
      {
        seg: 'prescriptions', add: 'addPrescriptionSejour', get: 'getPrescriptionsSejour', field: 'prescriptions_sejour', singular: 'prescription', plural: 'prescriptions',
        payload: { type: 'medicament', designation: 'Ibuprofène', posologie: '3x/jour', medecin: 'Dr Test' },
      },
    ];

    for (const sr of subResources) {
      await t.test(`POST /:id/${sr.seg} persiste réellement l'élément (relecture fraîche du document parent)`, async () => {
        const res = mkRes();
        await hospC[sr.add]({ params: { id: hosp._id }, body: sr.payload, user, ip: '127.0.0.1' }, res, () => {});
        assert.equal(res.body.success, true, JSON.stringify(res.body));
        assert.ok(res.body[sr.singular], `réponse POST doit contenir "${sr.singular}"`);

        const fresh = await Hospitalization.findById(hosp._id).lean();
        const arr = fresh[sr.field] || [];
        assert.equal(arr.length, 1, `${sr.field} doit contenir 1 élément après le POST`);
        for (const k of Object.keys(sr.payload)) {
          if (sr.payload[k] === '') continue; // valeurs vides volontaires (ex: resultat en attente)
          assert.equal(String(arr[0][k]), String(sr.payload[k]), `${sr.field}.${k} mal persisté`);
        }
      });

      await t.test(`GET /:id/${sr.seg} retourne bien l'élément ajouté`, async () => {
        const res = mkRes();
        await hospC[sr.get]({ params: { id: hosp._id } }, res, () => {});
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body[sr.plural]), `réponse GET doit contenir un tableau "${sr.plural}"`);
        assert.equal(res.body[sr.plural].length, 1);
      });
    }
  } finally {
    for (const fn of cleanup) { try { await fn(); } catch {} }
    await User.findByIdAndDelete(user._id);
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
