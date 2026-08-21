// Audit dashboards (10 rôles) — vérifie contre la base réelle que :
//   1. /portal/dashboard (PatientDashboard) existe désormais, renvoie des
//      données réellement scopées au patient connecté (aucune fuite d'un
//      autre dossier), et que chaque KPI reflète des fixtures réelles créées
//      ici — pas un objet vide comme avant ce correctif (route absente).
//   2. radiologueStats renvoie un en_cours réel (statut ImagingResult
//      'realise') et une liste `examens` réellement backée, et ne renvoie
//      plus le champ precision_ia (valeur inventée, retirée).
//   3. medecinStats.ia_stats.taux_precision n'est plus une valeur inventée
//      (94 en dur) mais 0 explicite, et hospit_patients ne porte plus de
//      statut clinique fictif ('stable' en dur, retiré).
//   4. superAdminStats.sys_status.db reflète l'état réel de la connexion
//      Mongoose, et ne renvoie plus disk/cpu/ram/backup/services_actifs
//      (valeurs matérielles inventées, retirées).
//   5. medecinStats.kpis.mes_urgences reflète réellement Urgence.
//      medecin_responsable (nouvellement agrégé — absent auparavant).
//   6. superAdminStats (vue globale professionnalisée) : RDV/consultations
//      du jour, urgences, laboratoire, imagerie, pharmacie, activité 7
//      jours et users_par_role (tous rôles connus explicitement à 0)
//      reflètent réellement des fixtures créées ici — rien de fictif.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Audit dashboards — endpoints réels, aucune donnée fictive (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient        = require('../models/Patient');
  const User           = require('../models/User');
  const Appointment    = require('../models/Appointment');
  const Prescription   = require('../models/Prescription');
  const Consultation   = require('../models/Consultation');
  const Invoice        = require('../models/Invoice');
  const ImagingResult  = require('../models/ImagingResult');
  const Urgence        = require('../models/Urgence');
  const portalC        = require('../controllers/portal.controller');
  const dashC          = require('../controllers/dashboard.controller');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; }, set: () => {} };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({
      email: `_dash-med-${stamp}@_test.local`, password: 'Xx1aaaaa',
      nom: 'Diallo', prenom: 'A', role: 'medecin', specialite: 'Cardiologie',
      telephone: '060000000', statut: 'actif',
    });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));

    const patientUser = await User.create({
      email: `_dash-pat-${stamp}@_test.local`, password: 'Xx1aaaaa',
      nom: 'Test', prenom: 'Patient', role: 'patient', statut: 'actif',
    });

    const patient = await Patient.create({
      nom: 'Test', prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M',
      email: patientUser.email, medecin_referent: medecin._id,
    });
    await User.findByIdAndUpdate(patientUser._id, { patient_id: patient._id });
    // patientUser doit être supprimé AVANT patient à l'exécution : Patient.js
    // refuse la suppression d'un dossier encore référencé par un
    // User.patient_id actif (garde ticket 0008). cleanup.reverse() exécute
    // les push dans l'ordre inverse — patient-delete est donc poussé en
    // premier ici pour s'exécuter en dernier.
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    cleanup.push(() => User.findByIdAndDelete(patientUser._id));

    const rdv = await Appointment.create({
      patient: patient._id, medecin: medecin._id,
      date_heure: new Date(Date.now() + 2 * 86400000),
      motif: 'Suivi', type: 'suivi', statut: 'confirme',
    });
    cleanup.push(() => Appointment.findByIdAndDelete(rdv._id));

    const ordo = await Prescription.create({
      patient: patient._id, medecin: medecin._id, statut: 'active',
      date_expiration: new Date(Date.now() + 30 * 86400000),
      lignes: [{ medicament_nom: 'Paracétamol', posologie: '1cp x3/j', duree: '5j' }],
    });
    cleanup.push(() => Prescription.findByIdAndDelete(ordo._id));

    const consult = await Consultation.create({
      patient: patient._id, medecin: medecin._id, statut: 'terminee',
      signes_vitaux: { poids: 68, tension_systolique: 120, tension_diastolique: 80, pouls: 72, temperature: 37.1 },
    });
    cleanup.push(() => Consultation.findByIdAndDelete(consult._id));

    const facture = await Invoice.create({
      patient: patient._id, montant_ttc: 15000,
      lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 15000, montant: 15000 }],
    });
    cleanup.push(() => Invoice.findByIdAndDelete(facture._id));

    await t.test('portal.controller.getDashboard — données réelles, strictement scopées au patient connecté', async () => {
      const req = { user: { _id: patientUser._id, email: patientUser.email, patient_id: patient._id } };
      const { status, body } = await call(portalC.getDashboard, req);
      assert.equal(status, 200);
      assert.equal(body.stats.kpis.rdv_a_venir, 1);
      assert.equal(body.stats.kpis.ordonnances_actives, 1);
      assert.equal(body.stats.kpis.factures_impayees, 1);
      assert.equal(body.stats.kpis.consultations_total, 1);
      assert.ok(body.stats.prochain_rdv, 'prochain_rdv doit être renseigné');
      assert.equal(body.stats.prochain_rdv.medecin, medecin.nom);
      assert.equal(body.stats.medecin_ref.nom, medecin.nom);
      assert.equal(body.stats.medecin_ref.specialite, 'Cardiologie');
      assert.equal(body.stats.constantes.poids, 68);
      assert.equal(body.stats.constantes.tension, '120/80');
      assert.ok(body.stats.alertes.some(a => /facture/i.test(a.msg)), 'alerte facture impayée attendue');
    });

    await t.test('portal.controller.getDashboard — 404 si aucun dossier Patient lié (pas de fuite vers un autre dossier)', async () => {
      const orphanUser = await User.create({
        email: `_dash-orphan-${stamp}@_test.local`, password: 'Xx1aaaaa',
        nom: 'Orphan', prenom: 'X', role: 'patient', statut: 'actif',
      });
      cleanup.push(() => User.findByIdAndDelete(orphanUser._id));
      const { status } = await call(portalC.getDashboard, { user: { _id: orphanUser._id, email: orphanUser.email } });
      assert.equal(status, 404);
    });

    await t.test('dashboard.controller.radiologueStats — en_cours et examens réellement backés, precision_ia inventé retiré', async () => {
      const img = await ImagingResult.create({
        patient: patient._id, patient_nom: 'Test Patient',
        type_examen: 'Radio thorax', date_prescription: new Date(), statut: 'realise',
      });
      cleanup.push(() => ImagingResult.findByIdAndDelete(img._id));

      const { status, body } = await call(dashC.radiologueStats, { user: { _id: medecin._id, role: 'radiologue' } });
      assert.equal(status, 200);
      assert.ok(body.stats.kpis.en_cours >= 1, 'en_cours doit refléter le statut réel "realise"');
      assert.equal('precision_ia' in body.stats.kpis, false, 'precision_ia (valeur inventée) ne doit plus être renvoyé');
      assert.ok(Array.isArray(body.stats.examens), 'la liste examens doit désormais être renvoyée');
      if (body.stats.examens.length > 0) {
        const e = body.stats.examens[0];
        assert.ok('patient' in e && 'type' in e && 'heure' in e && 'statut' in e);
      }
    });

    await t.test('dashboard.controller.medecinStats — aucun taux de précision IA inventé, aucun statut clinique fictif, urgences réellement agrégées', async () => {
      const urgence = await Urgence.create({
        patient_nom: 'Test Patient', medecin_responsable: medecin._id, statut: 'observation',
      });
      cleanup.push(() => Urgence.findByIdAndDelete(urgence._id));

      const { status, body } = await call(dashC.medecinStats, { user: { _id: medecin._id, role: 'medecin' } });
      assert.equal(status, 200);
      assert.equal(body.stats.ia_stats.taux_precision, 0, 'taux_precision doit être 0 explicite, plus 94 en dur');
      body.stats.hospit_patients.forEach(h => assert.equal('statut' in h, false, 'statut clinique fictif retiré'));
      assert.ok(body.stats.kpis.mes_urgences >= 1, 'mes_urgences doit refléter Urgence.medecin_responsable réel');
    });

    await t.test('dashboard.controller.superAdminStats — sys_status.db réel, plus de valeurs matérielles inventées', async () => {
      const { status, body } = await call(dashC.superAdminStats, { user: { _id: medecin._id, role: 'superadmin' } });
      assert.equal(status, 200);
      assert.equal(body.stats.sys_status.db, 'ok', 'connexion Mongo réellement active pendant ce test');
      assert.equal('disk' in body.stats.sys_status, false);
      assert.equal('backup' in body.stats.sys_status, false);
      assert.equal('server_cpu' in body.stats.sys_status, false);
      assert.equal('server_ram' in body.stats.sys_status, false);
      assert.equal('services_actifs' in body.stats.sys_status, false);
    });

    await t.test('dashboard.controller.superAdminStats — vue globale professionnalisée, entièrement backée par des fixtures réelles', async () => {
      const rdvAuj = await Appointment.create({
        patient: patient._id, medecin: medecin._id, date_heure: new Date(),
        motif: 'Contrôle', type: 'consultation', statut: 'confirme',
      });
      cleanup.push(() => Appointment.findByIdAndDelete(rdvAuj._id));
      // superAdminStats est mis en cache 30s sous une clé globale (non
      // personnalisée) — le sous-test précédent l'a déjà appelé, donc sans
      // invalidation explicite ce nouvel appel recevrait la réponse figée
      // d'avant la création de rdvAuj ci-dessus.
      require('../utils/dashboardCache').invalidateStatsCache();

      const { status, body } = await call(dashC.superAdminStats, { user: { _id: medecin._id, role: 'superadmin' } });
      assert.equal(status, 200);
      const s = body.stats;

      // RDV du jour
      assert.ok(s.kpis.rdv_auj >= 1, 'rdv_auj doit refléter le RDV créé aujourd\'hui');
      assert.ok(s.rdv_stats.confirmes >= 1);
      assert.ok(Array.isArray(s.rdv_auj_liste));
      assert.ok(s.rdv_auj_liste.some(r => r.patient === 'Patient Test' && r.medecin === 'Dr. Diallo'),
        'la liste RDV du jour doit contenir le RDV réel créé, avec patient/médecin corrects');

      // Consultations du jour
      assert.ok(Array.isArray(s.consultations_auj_liste));
      assert.ok(s.consultations_auj_liste.some(c => c.patient === 'Patient Test'),
        'la liste consultations du jour doit contenir la consultation réelle créée');

      // Urgences (fixture créée dans le sous-test medecinStats ci-dessus, toujours en base)
      assert.ok(s.kpis.urgences_en_cours >= 1);
      assert.ok(s.urgences.en_cours >= 1);
      assert.ok(s.urgences.nouvelles >= 1);

      // Laboratoire / Imagerie / Pharmacie / Hospitalisation — présents, jamais fictifs
      assert.ok('demandes_auj' in s.laboratoire && 'en_cours' in s.laboratoire && 'critiques' in s.laboratoire);
      assert.ok('examens_auj' in s.imagerie && 'en_attente' in s.imagerie && 'rapports_dispo' in s.imagerie);
      assert.ok('stock_faible' in s.pharmacie && 'ruptures' in s.pharmacie);
      assert.ok('admissions_auj' in s.hospitalisation && 'patients_actuels' in s.hospitalisation && 'sorties_auj' in s.hospitalisation);

      // Activité médicale 7 jours — jamais de série tronquée ou inventée
      assert.equal(s.chart_activite.labels.length, 7);
      assert.equal(s.chart_activite.patients.length, 7);
      assert.equal(s.chart_activite.consultations.length, 7);
      assert.equal(s.chart_activite.rdv.length, 7);
      assert.equal(s.chart_activite.hospitalisations.length, 7);

      // users_par_role — tous les rôles connus présents explicitement, jamais une clé absente
      ['medecin','infirmier','laborantin','radiologue','pharmacien','comptable','receptionniste','patient','superadmin','adminclinique']
        .forEach(r => assert.equal(typeof s.users_par_role[r], 'number', `${r} doit être un nombre explicite, jamais absent`));
      assert.ok(s.users_par_role.medecin >= 1, 'doit refléter le médecin réel créé par ce test');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
