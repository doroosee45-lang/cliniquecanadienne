// T9.3 (R-17) — extension de donnees_avant/donnees_apres, groupe 4 (dernier) :
// administratif/support (ambulances, RH, pharmacie, RDV récurrents,
// paramètres). Même vérification que les groupes 1-3.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('donnees_avant/donnees_apres — ambulances, hr, pharmacy, recurring, settings (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Ambulance = require('../models/Ambulance');
  const Staff = require('../models/Staff');
  const Commande = require('../models/Commande');
  const Medication = require('../models/Medication');
  const Prescription = require('../models/Prescription');
  const Patient = require('../models/Patient');
  const RecurringProtocol = require('../models/RecurringProtocol');
  const Setting = require('../models/Setting');
  const Service = require('../models/Service');
  const ambC = require('../controllers/ambulances.controller');
  const hrC  = require('../controllers/hr.controller');
  const pharmaC = require('../controllers/pharmacy.controller');
  const recC = require('../controllers/recurring.controller');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T93', nom: 'Test', role: 'superadmin' };
  const patient = await Patient.create({ nom: `T93G4${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await require('../models/User').create({ email: `_t93g4-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'T93G4', role: 'medecin', statut: 'actif' });

  const cleanup = [() => Patient.findByIdAndDelete(patient._id), () => require('../models/User').findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('ambulances.controller — retourAmbulance journalise avant/apres', async () => {
      const amb = await Ambulance.create({ numero: `AMB-T93-${stamp}`, statut: 'en_route', destination: 'Hôpital central' });
      cleanup.push(() => Ambulance.findByIdAndDelete(amb._id));

      await call(ambC.retourAmbulance, { params: { numero: amb.numero }, user, ip: '127.0.0.1' });
      const log = await AuditLog.findOne({ module: 'ambulances', action: 'UPDATE', entite_id: amb._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'en_route');
      assert.equal(log.donnees_apres.statut, 'disponible');
    });

    await t.test('hr.controller — update et updateLeaveStatus journalisent avant/apres', async () => {
      const staff = await Staff.create({ prenom: 'T93G4', nom: 'Staff', poste: 'infirmier', conges_restants: 20 });
      cleanup.push(() => Staff.findByIdAndDelete(staff._id));

      await call(hrC.update, { params: { id: staff._id }, body: { departement: 'Urgences' }, user, ip: '127.0.0.1' });
      let log = await AuditLog.findOne({ module: 'hr', action: 'UPDATE', entite_id: staff._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_apres.departement, 'Urgences');

      await call(hrC.leave, { params: { id: staff._id }, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-05' }, user, ip: '127.0.0.1' });
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[0]._id;
      await call(hrC.updateLeaveStatus, { params: { id: staff._id, congeId }, body: { statut: 'approuve' }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'hr', action: 'LEAVE_APPROVE', entite_id: staff._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.conges_restants, 20);
      assert.equal(log.donnees_apres.conges_restants, 15, '20 - 5 jours approuvés');
    });

    await t.test('pharmacy.controller — receptionCommande, update, mouvement, dispenser journalisent avant/apres', async () => {
      const med = await Medication.create({ nom_commercial: `T93G4-Med-${stamp}`, stock_actuel: 10, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));

      const commande = await Commande.create({ fournisseur: 'Fournisseur T93', lignes: [{ medicament: med._id, nom: med.nom_commercial, quantite: 5, prix_unitaire: 100 }] });
      cleanup.push(() => Commande.findByIdAndDelete(commande._id));
      await call(pharmaC.receptionCommande, { params: { id: commande._id }, body: { receptions: [{ index: 0, quantite_recue: 5 }] }, user, ip: '127.0.0.1' });
      let log = await AuditLog.findOne({ module: 'pharmacy', action: 'UPDATE', entite_id: commande._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'brouillon');
      assert.equal(log.donnees_apres.statut, 'recu');

      await call(pharmaC.update, { params: { id: med._id }, body: { forme: 'sirop' }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'pharmacy', action: 'UPDATE', entite_id: med._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.forme, 'comprime');
      assert.equal(log.donnees_apres.forme, 'sirop');

      await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'entree', quantite: 3 }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'pharmacy', action: 'STOCK_MOUVEMENT', entite_id: med._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.stock_actuel, 15);
      assert.equal(log.donnees_apres.stock_actuel, 18);

      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, lignes: [{ medicament_nom: 'Test', quantite: 1 }], statut: 'active' });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));
      await call(pharmaC.dispenser, { params: { id: rx._id }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'pharmacy', action: 'DISPENSE', entite_id: rx._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'active');
      assert.equal(log.donnees_apres.statut, 'dispensee');
    });

    await t.test('recurring.controller — update, remove, planifier journalisent avant/apres', async () => {
      const protocol = await RecurringProtocol.create({ titre: `T93G4-Proto-${stamp}`, medecin: medecin._id, frequence: 'mensuel', prochaine_date: new Date('2026-09-01') });
      cleanup.push(() => RecurringProtocol.findByIdAndDelete(protocol._id));

      await call(recC.update, { params: { id: protocol._id }, body: { notes: 'Suivi renforcé' }, user, ip: '127.0.0.1' });
      let log = await AuditLog.findOne({ module: 'recurring', action: 'UPDATE', entite_id: protocol._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_apres.notes, 'Suivi renforcé');

      const apptReq = { params: { id: protocol._id }, body: { patient: patient._id, date_heure: '2026-09-05T10:00:00' }, user, ip: '127.0.0.1' };
      const { body } = await call(recC.planifier, apptReq);
      cleanup.push(() => require('../models/Appointment').findByIdAndDelete(body.appointment._id));
      log = await AuditLog.findOne({ module: 'recurring', action: 'PLANIFIER', entite_id: protocol._id.toString() }).sort('-createdAt');
      assert.ok(log.donnees_avant, 'avant doit être renseigné pour planifier');
      assert.notEqual(new Date(log.donnees_apres.prochaine_date).toISOString(), new Date(log.donnees_avant.prochaine_date).toISOString());

      await call(recC.remove, { params: { id: protocol._id }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'recurring', action: 'DELETE', entite_id: protocol._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.actif, true);
    });

    await t.test('settings.controller — upsert et updateService journalisent avant/apres', async () => {
      const cle = `t93g4_setting_${stamp}`;
      await call(settingsC.upsert, { body: { cle, valeur: 'v1', type: 'string' }, user, ip: '127.0.0.1' });
      cleanup.push(() => Setting.deleteOne({ cle }));
      let log = await AuditLog.findOne({ module: 'settings', action: 'UPDATE_SETTING' }).sort('-createdAt');
      assert.equal(log.donnees_avant, null, 'premier upsert — pas de valeur antérieure');
      assert.equal(log.donnees_apres.valeur, 'v1');

      await call(settingsC.upsert, { body: { cle, valeur: 'v2', type: 'string' }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'settings', action: 'UPDATE_SETTING' }).sort('-createdAt');
      assert.equal(log.donnees_avant.valeur, 'v1');
      assert.equal(log.donnees_apres.valeur, 'v2');

      const service = await Service.create({ nom: `T93G4-Service-${stamp}` });
      cleanup.push(() => Service.findByIdAndDelete(service._id));
      await call(settingsC.updateService, { params: { id: service._id }, body: { statut: 'inactif' }, user, ip: '127.0.0.1' });
      log = await AuditLog.findOne({ module: 'settings', action: 'UPDATE', entite_id: service._id.toString() }).sort('-createdAt');
      assert.notEqual(log.donnees_avant.statut, 'inactif');
      assert.equal(log.donnees_apres.statut, 'inactif');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
