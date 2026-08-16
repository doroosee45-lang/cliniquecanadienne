// Suite du balayage T5.2 (R-04a) — le même bug (Model.create({ ...req.body })
// sans strict:false sur un schéma désynchronisé du frontend) a été retrouvé
// sur deux autres modules après le correctif initial sur Consultation :
//   - Appointments : `salle` jamais déclaré sur le schéma.
//   - Patients : `nationalite`/`situation_mat` jamais déclarés.
// Chacun envoie ici le payload réel construit par sa page frontend et vérifie
// qu'aucun champ n'est perdu — même méthode que consultationFullPayload.test.js.
//
// Finance/Invoices a d'abord été diagnostiqué à tort comme un désaccord de
// nom de champ (frontend envoie `echeance`, schéma déclare `date_echeance`) :
// finance.controller.js::create mappe déjà correctement l'un vers l'autre
// avant Invoice.create(). Le vrai bug, trouvé en creusant plus loin : le hook
// pre('save') du modèle écrasait inconditionnellement date_echeance par
// "+30 jours" pour TOUTE nouvelle facture (models/Invoice.js), y compris
// quand le contrôleur venait de le poser correctement depuis le formulaire —
// l'échéance choisie par le personnel était donc toujours silencieusement
// remplacée. Corrigé pour ne poser le défaut que si date_echeance n'est pas
// déjà renseigné.
//
// Balayage étendu à hr.controller.js (sûr — liste de champs explicite, pas de
// spread brut), recurring.controller.js (sûr — payload frontend vérifié
// champ à champ contre RecurringProtocol) et settings.controller.js. Ce
// dernier a révélé le bug le plus sérieux du balayage : Administration.jsx
// envoie le mot de passe saisi sous `mot_de_passe`, le schéma User déclare
// `password` — User.create(req.body)/le destructuring de updateUser
// ignoraient ce champ, donc un compte staff créé (ou un mot de passe
// réinitialisé) via Administration > Utilisateurs ne recevait jamais aucun
// mot de passe réellement utilisable. Corrigé dans les deux fonctions.
// createService/createInsurance du même fichier utilisent aussi
// Model.create(req.body) brut, mais n'ont aucun appelant frontend (recherche
// exhaustive : aucun POST vers /admin/services ou /admin/insurances nulle
// part dans le frontend) — endpoints orphelins, pas de perte de données
// active, donc pas corrigés ici (même situation que le ticket 0006 avant sa
// résolution).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('balayage T5.2 — Appointments, Patients, Finance/Invoices, Administration (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Appointment = require('../models/Appointment');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Invoice = require('../models/Invoice');
  const apptC = require('../controllers/appointments.controller');
  const patC  = require('../controllers/patients.controller');
  const settingsC = require('../controllers/settings.controller');
  const finC  = require('../controllers/finance.controller');

  const stamp = Date.now();
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'Staff', nom: 'Test', role: 'receptionniste' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('Appointments — le payload réel (dont salle) est retrouvé intact en base', async () => {
      const patient = await Patient.create({ nom: `T52A-${stamp}`, prenom: 'Pat', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const medecin = await User.create({ email: `_t52a-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'T52A', role: 'medecin', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(medecin._id));

      // Payload construit à l'identique de Appointments.jsx (~ligne 1050-1060).
      const payload = {
        patient:       patient._id,
        medecin:       medecin._id,
        date_heure:    `2026-09-01T10:00:00`,
        duree_minutes: 30,
        motif:         'Consultation de suivi',
        type:          'consultation',
        statut:        'en_attente',
        notes:         'RAS',
        salle:         'Salle 3',
      };
      const { status, body } = await call(apptC.create, { body: payload, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 201);
      cleanup.push(() => Appointment.findByIdAndDelete(body.appointment._id));

      const fresh = await Appointment.findById(body.appointment._id).lean();
      assert.equal(fresh.salle, 'Salle 3', 'salle ne doit plus être perdu à la création');
      assert.equal(fresh.notes, payload.notes);
      assert.equal(fresh.motif, payload.motif);
    });

    await t.test('Patients — nationalite et situation_mat sont retrouvés intacts en base', async () => {
      const email = `_t52b-${stamp}@_test.local`;
      // Payload construit à l'identique de Patients.jsx (FORM_INIT + payload de handleCreatePatient).
      const payload = {
        nom: `T52B-${stamp}`, prenom: 'Pat', date_naissance: '1990-01-01', sexe: 'F',
        telephone: '060000000', email,
        groupe_sanguin: 'O+', nationalite: 'Congolaise', situation_mat: 'mariee',
        allergies: [], photo: '',
        adresse: { rue: 'Rue Test', ville: 'Souanké', pays: 'Congo', code_postal: '' },
        assurances: [],
        contact_urgence: { nom: '', relation: '', telephone: '' },
      };
      const { status, body } = await call(patC.create, { body: payload, user: staff, ip: '127.0.0.1', headers: {} });
      assert.equal(status, 201);
      cleanup.push(() => Patient.findByIdAndDelete(body.patient._id));
      cleanup.push(() => User.deleteOne({ email }));

      const fresh = await Patient.findById(body.patient._id).lean();
      assert.equal(fresh.nationalite, 'Congolaise', 'nationalite ne doit plus être perdue à la création');
      assert.equal(fresh.situation_mat, 'mariee', 'situation_mat ne doit plus être perdue à la création');
    });

    await t.test('Finance/Invoices — l\'échéance choisie par le personnel n\'est plus écrasée par le défaut à 30 jours', async () => {
      const payload = {
        patient_nom: `T52C-${stamp}`,
        service: 'Consultation',
        montant: 15000,
        echeance: '2026-10-01',
        statut: 'non_paye',
      };
      const { status, body } = await call(finC.create, { body: payload, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 201);
      cleanup.push(() => Invoice.findByIdAndDelete(body.invoice._id));

      const fresh = await Invoice.findById(body.invoice._id).lean();
      assert.ok(fresh.date_echeance, 'date_echeance doit être renseigné à partir du champ echeance envoyé par le frontend');
      assert.equal(new Date(fresh.date_echeance).toISOString().slice(0, 10), '2026-10-01', 'la valeur choisie par le personnel doit être conservée, pas remplacée par le défaut à 30 jours');
      assert.equal(fresh.echeance, undefined, 'aucun champ echeance résiduel ne doit être persisté (hors schéma)');
    });

    await t.test('Finance/Invoices — le défaut à 30 jours s\'applique toujours si aucune échéance n\'est fournie', async () => {
      const payload = { patient_nom: `T52D-${stamp}`, service: 'Consultation', montant: 5000, statut: 'non_paye' };
      const { body } = await call(finC.create, { body: payload, user: staff, ip: '127.0.0.1' });
      cleanup.push(() => Invoice.findByIdAndDelete(body.invoice._id));

      const fresh = await Invoice.findById(body.invoice._id).lean();
      const days = Math.round((new Date(fresh.date_echeance) - Date.now()) / 86400000);
      assert.ok(days >= 29 && days <= 30, `le défaut doit rester ~30 jours quand rien n'est fourni (obtenu: ${days})`);
    });

    await t.test('Administration — createUser mappe mot_de_passe (frontend) vers password (schéma)', async () => {
      const email = `_t52e-${stamp}@_test.local`;
      // Payload construit à l'identique de Administration.jsx (EMPTY_USER + saveUser).
      const payload = { prenom: 'Nouvel', nom: 'Employe', email, telephone: '060000000', role: 'medecin', service: 'Chirurgie', statut: 'actif', mot_de_passe: 'MotDePasse1' };
      const { status, body } = await call(settingsC.createUser, { body: payload, user: staff, ip: '127.0.0.1' });
      assert.equal(status, 201);
      cleanup.push(() => User.findByIdAndDelete(body.user._id));

      const fresh = await User.findById(body.user._id).select('+password');
      assert.ok(fresh.password, 'le compte créé via Administration doit avoir un mot de passe utilisable — avant le correctif, il restait undefined');
      assert.ok(await fresh.matchPassword('MotDePasse1'), 'le mot de passe saisi dans le formulaire doit être celui réellement utilisable pour se connecter');
      // AUDIT-01 — service (select "Service / Département") n'était pas
      // déclaré sur le schéma User : silencieusement supprimé à la création.
      assert.equal(body.user.service, 'Chirurgie', 'le service choisi à la création doit être renvoyé dans la réponse');
      assert.equal(fresh.service, 'Chirurgie', 'le service choisi à la création doit être réellement persisté en base');
    });

    await t.test('Administration — updateUser persiste le champ service (AUDIT-01)', async () => {
      const email = `_t52h-${stamp}@_test.local`;
      const user = await User.create({ email, password: 'Xx1aaaaa', nom: 'Test', prenom: 'T52H', role: 'medecin', statut: 'actif', service: 'Urgences' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status, body } = await call(settingsC.updateUser, {
        params: { id: user._id },
        body: { prenom: 'T52H', nom: 'Test', email, telephone: '', role: 'medecin', service: 'Pédiatrie', statut: 'actif', mot_de_passe: '' },
        user: staff, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.user.service, 'Pédiatrie', 'la réponse doit refléter le nouveau service');

      const fresh = await User.findById(user._id);
      assert.equal(fresh.service, 'Pédiatrie', 'le changement de service doit être réellement persisté en base, pas seulement dans la réponse');
    });

    await t.test('Administration — updateUser réinitialise le mot de passe via mot_de_passe', async () => {
      const email = `_t52f-${stamp}@_test.local`;
      const user = await User.create({ email, password: 'AncienMdp1', nom: 'Test', prenom: 'T52F', role: 'medecin', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status } = await call(settingsC.updateUser, {
        params: { id: user._id },
        body: { prenom: 'T52F', nom: 'Test', email, telephone: '', role: 'medecin', service: '', statut: 'actif', mot_de_passe: 'NouveauMdp2' },
        user: staff, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await User.findById(user._id).select('+password');
      assert.ok(await fresh.matchPassword('NouveauMdp2'), 'le nouveau mot de passe saisi doit remplacer l\'ancien');
      assert.equal(await fresh.matchPassword('AncienMdp1'), false, 'l\'ancien mot de passe ne doit plus fonctionner');
    });

    await t.test('Administration — updateUser sans mot_de_passe ne touche pas le mot de passe existant', async () => {
      const email = `_t52g-${stamp}@_test.local`;
      const user = await User.create({ email, password: 'Inchange1', nom: 'Test', prenom: 'T52G', role: 'medecin', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      const { status } = await call(settingsC.updateUser, {
        params: { id: user._id },
        body: { prenom: 'T52G', nom: 'Test', email, telephone: '', role: 'medecin', service: '', statut: 'actif', mot_de_passe: '' },
        user: staff, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await User.findById(user._id).select('+password');
      assert.ok(await fresh.matchPassword('Inchange1'), 'un champ mot_de_passe vide ne doit pas effacer le mot de passe existant');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
