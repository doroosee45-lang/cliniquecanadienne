// AUDIT-P2-1 (groupe 2/2) — même correctif que le groupe 1 (User/Staff),
// appliqué aux 13 autres occurrences confirmées du même pattern
// (req.body transmis sans liste noire/blanche à findByIdAndUpdate ou
// Object.assign). Chaque sous-test vérifie deux choses avec une relecture
// fraîche en base : (a) les champs légitimes persistent toujours (pas de
// régression fonctionnelle), (b) un champ bloqué envoyé dans le même appel
// n'a strictement aucun effet.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P2-1 groupe 2 — mass-assignment bloqué sur 13 endpoints cliniques/métier (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);

  const patientsC = require('../controllers/patients.controller');
  const apptC = require('../controllers/appointments.controller');
  const consultC = require('../controllers/consultations.controller');
  const rxC = require('../controllers/prescriptions.controller');
  const radioC = require('../controllers/radiology.controller');
  const pharmaC = require('../controllers/pharmacy.controller');
  const recurringC = require('../controllers/recurring.controller');
  const maternityC = require('../controllers/maternityController');
  const pediatrieC = require('../controllers/pediatrieController');
  const chirurgieC = require('../controllers/chirurgieController');
  const hospC = require('../controllers/hospitalization.controller');

  const Patient = require('../models/Patient');
  const Appointment = require('../models/Appointment');
  const Consultation = require('../models/Consultation');
  const Prescription = require('../models/Prescription');
  const ImagingResult = require('../models/ImagingResult');
  const Medication = require('../models/Medication');
  const RecurringProtocol = require('../models/RecurringProtocol');
  const Pregnancy = require('../models/Pregnancy');
  const Newborn = require('../models/Newborn');
  const Child = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Hospitalization = require('../models/Hospitalization');
  const User = require('../models/User');

  const stamp = Date.now();
  const staff = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  const otherPatientId = new mongoose.Types.ObjectId();

  try {
    const medecin = await User.create({ email: `_p21c-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'M', prenom: 'D', role: 'medecin', statut: 'actif' });
    const patient = await Patient.create({ nom: 'P21C', prenom: stamp.toString(), date_naissance: '1990-01-01', sexe: 'F' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id), () => Patient.findByIdAndDelete(patient._id));

    await t.test('Patient.update — actif/token_activation/statut/cree_par bloqués, telephone/notes légitimes toujours persistés', async () => {
      const before = await Patient.findById(patient._id).lean();
      assert.equal(before.actif, false);
      await call(patientsC.update, {
        params: { id: patient._id },
        body: { telephone: '+242061111111', notes: 'RAS', actif: true, statut: 'decede', cree_par: new mongoose.Types.ObjectId(), token_activation: 'hack' },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Patient.findById(patient._id).lean();
      assert.equal(fresh.telephone, '+242061111111');
      assert.equal(fresh.notes, 'RAS');
      assert.equal(fresh.actif, false, 'actif ne doit pas être modifiable via cet endpoint');
      assert.equal(fresh.statut, 'actif', 'statut ne doit pas être modifiable via cet endpoint');
      assert.equal(fresh.token_activation, undefined);
    });

    let apptId;
    await t.test('Appointment.update — patient bloqué, statut/notes légitimes toujours persistés', async () => {
      const appt = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: new Date(), motif: 'Contrôle' });
      apptId = appt._id;
      cleanup.push(() => Appointment.findByIdAndDelete(apptId));
      await call(apptC.update, {
        params: { id: apptId },
        body: { statut: 'confirme', notes: 'Patient prévenu', patient: otherPatientId },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Appointment.findById(apptId).lean();
      assert.equal(fresh.statut, 'confirme');
      assert.equal(fresh.notes, 'Patient prévenu');
      assert.equal(fresh.patient.toString(), patient._id.toString(), 'patient ne doit pas être réassignable via cet endpoint');
    });

    await t.test('Consultation.update — patient/medecin bloqués, diagnostic légitime toujours persisté', async () => {
      const consult = await Consultation.create({ patient: patient._id, medecin: medecin._id, motif: 'Douleur', diagnostic: 'À préciser' });
      cleanup.push(() => Consultation.findByIdAndDelete(consult._id));
      await call(consultC.update, {
        params: { id: consult._id },
        body: { diagnostic: 'Grippe saisonnière', patient: otherPatientId, medecin: new mongoose.Types.ObjectId() },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Consultation.findById(consult._id).lean();
      assert.equal(fresh.diagnostic, 'Grippe saisonnière');
      assert.equal(fresh.patient.toString(), patient._id.toString());
      assert.equal(fresh.medecin.toString(), medecin._id.toString());
    });

    await t.test('Prescription.update — statut/dispensee_par bloqués (protège la machine à états P7-3), lignes légitimes toujours persistées', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, lignes: [{ medicament_nom: 'Paracétamol', posologie: '1cp x3/j' }] });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));
      await call(rxC.update, {
        params: { id: rx._id },
        body: { lignes: [{ medicament_nom: 'Amoxicilline', posologie: '1cp x2/j' }], statut: 'dispensee', dispensee_par: staff._id, date_dispensation: new Date() },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Prescription.findById(rx._id).lean();
      assert.equal(fresh.lignes[0].medicament_nom, 'Amoxicilline');
      assert.equal(fresh.statut, 'brouillon', 'statut ne doit pas être modifiable via cet endpoint générique — seul dispenser()/publier() le changent');
      assert.equal(fresh.dispensee_par, undefined);
    });

    await t.test('ImagingResult.update — statut/signature bloqués (protège le circuit validate()), compte_rendu légitime toujours persisté', async () => {
      const img = await ImagingResult.create({ patient: patient._id, type_examen: 'Radio thorax' });
      cleanup.push(() => ImagingResult.findByIdAndDelete(img._id));
      await call(radioC.update, {
        params: { id: img._id },
        body: { compte_rendu: 'RAS', statut: 'valide', signature: 'DR-HACK' },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await ImagingResult.findById(img._id).lean();
      assert.equal(fresh.compte_rendu, 'RAS');
      assert.equal(fresh.statut, 'programme', 'statut ne doit pas être modifiable via cet endpoint générique');
      assert.equal(fresh.signature, undefined);
    });

    await t.test('Medication.update — stock_actuel bloqué (protège la traçabilité des mouvements), prix_vente légitime toujours persisté', async () => {
      const med = await Medication.create({ nom_commercial: `MedP21C-${stamp}`, stock_actuel: 50 });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      await call(pharmaC.update, {
        params: { id: med._id },
        body: { prix_vente: 1500, stock_actuel: 999999 },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.prix_vente, 1500);
      assert.equal(fresh.stock_actuel, 50, 'stock_actuel ne doit pas être modifiable via cet endpoint générique — seuls mouvement()/dispenser() le changent');
    });

    await t.test('RecurringProtocol.update — created_by bloqué, titre légitime toujours persisté', async () => {
      const proto = await RecurringProtocol.create({ titre: 'Suivi diabète', medecin: medecin._id, frequence: 'mensuel', prochaine_date: new Date() });
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(proto._id));
      const autreAuteur = new mongoose.Types.ObjectId();
      await call(recurringC.update, {
        params: { id: proto._id },
        body: { titre: 'Suivi diabète type 2', created_by: autreAuteur },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await RecurringProtocol.findById(proto._id).lean();
      assert.equal(fresh.titre, 'Suivi diabète type 2');
      assert.notEqual(String(fresh.created_by), String(autreAuteur));
    });

    await t.test('Pregnancy.update — patient_id/cpns bloqués, statut légitime toujours persisté', async () => {
      const g = await Pregnancy.create({ patient_id: patient._id, ddr: new Date(), created_by: medecin._id });
      cleanup.push(() => Pregnancy.findByIdAndDelete(g._id));
      await call(maternityC.update, {
        params: { id: g._id },
        body: { statut: 'a_risque', patient_id: otherPatientId, cpns: [{ notes: 'injecté' }] },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Pregnancy.findById(g._id).lean();
      assert.equal(fresh.statut, 'a_risque');
      assert.equal(fresh.patient_id.toString(), patient._id.toString());
      assert.equal(fresh.cpns.length, 0, 'cpns ne doit pas être écrasable via cet endpoint générique — seul addCPN y ajoute');
    });

    await t.test('Newborn.update — child_id bloqué (garantie R-10d), observations légitimes toujours persistées', async () => {
      const nb = await Newborn.create({ prenom: 'BB', nom: 'P21C', sexe: 'F' });
      cleanup.push(() => Newborn.findByIdAndDelete(nb._id));
      const fauxChildId = new mongoose.Types.ObjectId();
      await call(maternityC.updateNewborn, {
        params: { id: nb._id },
        body: { observations: 'Bon état général', child_id: fauxChildId },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Newborn.findById(nb._id).lean();
      assert.equal(fresh.observations, 'Bon état général');
      assert.equal(fresh.child_id, null, 'child_id ne doit pas être modifiable via cet endpoint générique');
    });

    await t.test('Child.update — mesures_croissance bloqué (protège le correctif P6-4), statut légitime toujours persisté', async () => {
      const child = await Child.create({ nom: 'EnfantP21C', date_naissance: '2020-01-01', sexe: 'M' });
      cleanup.push(() => Child.findByIdAndDelete(child._id));
      await call(pediatrieC.update, {
        params: { id: child._id },
        body: { statut: 'surveillance', mesures_croissance: [{ poids: 0, taille: 0 }] },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Child.findById(child._id).lean();
      assert.equal(fresh.statut, 'surveillance');
      assert.equal(fresh.mesures_croissance.length, 0, 'mesures_croissance ne doit pas être écrasable via cet endpoint générique — seul addMesureCroissance y ajoute');
    });

    await t.test('PediatricConsultation.update — child_id bloqué, diagnostic légitime toujours persisté', async () => {
      const child2 = await Child.create({ nom: 'EnfantP21C2', date_naissance: '2019-01-01', sexe: 'F' });
      cleanup.push(() => Child.findByIdAndDelete(child2._id));
      const consult = await PediatricConsultation.create({ child_id: child2._id, motif: 'Fièvre', diagnostic: 'À préciser' });
      cleanup.push(() => PediatricConsultation.findByIdAndDelete(consult._id));
      const autreChild = new mongoose.Types.ObjectId();
      await call(pediatrieC.updateConsultation, {
        params: { id: consult._id },
        body: { diagnostic: 'Otite', child_id: autreChild },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await PediatricConsultation.findById(consult._id).lean();
      assert.equal(fresh.diagnostic, 'Otite');
      assert.equal(fresh.child_id.toString(), child2._id.toString());
    });

    await t.test('DossierChirurgical.updateDossier — patient bloqué (Object.assign), diagnostic_chirurgical légitime toujours persisté', async () => {
      const dossier = await DossierChirurgical.create({ numero: `CHIR-P21C-${stamp}`, patient: patient._id, patient_nom: 'P21C' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));
      await call(chirurgieC.updateDossier, {
        params: { id: dossier._id },
        body: { diagnostic_chirurgical: 'Appendicite', patient: otherPatientId, numero: 'CHIR-HACK' },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await DossierChirurgical.findById(dossier._id).lean();
      assert.equal(fresh.diagnostic_chirurgical, 'Appendicite');
      assert.equal(fresh.patient.toString(), patient._id.toString());
      assert.equal(fresh.numero, `CHIR-P21C-${stamp}`);
    });

    await t.test('Hospitalization.update — patient bloqué, statut légitime toujours persisté', async () => {
      const hosp = await Hospitalization.create({ patient: patient._id, motif_entree: 'Observation' });
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));
      await call(hospC.update, {
        params: { id: hosp._id },
        body: { statut: 'transfere', patient: otherPatientId },
        user: staff, ip: '127.0.0.1',
      });
      const fresh = await Hospitalization.findById(hosp._id).lean();
      assert.equal(fresh.statut, 'transfere');
      assert.equal(fresh.patient.toString(), patient._id.toString());
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
