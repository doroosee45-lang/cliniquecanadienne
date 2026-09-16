// POST5-006 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE.
// consultations.controller.js::remove supprimait la Consultation sans
// jamais vérifier Invoice.consultation (le champ dédié que create()
// renseigne réellement) : une consultation ayant déjà produit une facture
// — payée ou non — pouvait être supprimée, laissant la facture référencer
// un acte clinique inexistant, détruisant sa traçabilité comptable.
//
// Aucun mécanisme d'archivage/désactivation n'existe aujourd'hui pour
// Consultation (statut n'a que en_cours/terminee/suspendue) : plutôt que
// d'inventer un tel mécanisme, même principe que le garde-fou déjà établi
// pour Patient (models/Patient.js) — refus explicite (409) tant qu'un
// historique financier réel existe, quel que soit son statut de paiement.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'Post5006TestPass1!';
const FETCH_TIMEOUT_MS = 10000;
const withTimeout = (opts) => ({ ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, withTimeout({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  if (res.status !== 200) throw new Error(`login ${email} a échoué (${res.status})`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('POST5-006 — DELETE /consultations/:id refuse réellement de supprimer une consultation référencée par une facture (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [], consultations: [], invoices: [], prescriptions: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const Consultation = require('../models/Consultation');
    const Invoice = require('../models/Invoice');
    const Prescription = require('../models/Prescription');

    const stamp = Date.now();
    const admin = await User.create({ email: `_p5006-admin-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Admin', role: 'superadmin', statut: 'actif' });
    created.users.push(admin._id);
    const medecin = await User.create({ email: `_p5006-med-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const patient = await Patient.create({ nom: `P5006-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1988-01-01' });
    created.patients.push(patient._id);

    const cookieAdmin = await login(server.baseUrl, admin.email);

    await t.test('consultation avec facture IMPAYÉE liée → suppression refusée (409), rien supprimé', async () => {
      const cons = await Consultation.create({ patient: patient._id, medecin: medecin._id, motif: 'Test' });
      created.consultations.push(cons._id);
      const inv = await Invoice.create({ patient: patient._id, consultation: cons._id, service_label: 'Consultation', created_by: admin._id, montant_ht: 15000, montant_ttc: 15000, statut: 'emise' });
      created.invoices.push(inv._id);

      const res = await fetch(`${server.baseUrl}/consultations/${cons._id}`, withTimeout({ method: 'DELETE', headers: { Cookie: cookieAdmin } }));
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.match(body.message, /facture/i);

      const stillThere = await Consultation.findById(cons._id).lean();
      assert.ok(stillThere, 'la consultation ne doit pas avoir été supprimée');
      const invStillThere = await Invoice.findById(inv._id).lean();
      assert.ok(invStillThere, 'la facture ne doit pas avoir été affectée');
    });

    await t.test('consultation avec facture PAYÉE liée → suppression également refusée (409)', async () => {
      const cons = await Consultation.create({ patient: patient._id, medecin: medecin._id, motif: 'Test payé' });
      created.consultations.push(cons._id);
      const inv = await Invoice.create({ patient: patient._id, consultation: cons._id, service_label: 'Consultation', created_by: admin._id, montant_ht: 15000, montant_ttc: 15000, montant_paye: 15000, statut: 'payee' });
      created.invoices.push(inv._id);

      const res = await fetch(`${server.baseUrl}/consultations/${cons._id}`, withTimeout({ method: 'DELETE', headers: { Cookie: cookieAdmin } }));
      assert.equal(res.status, 409);
      const stillThere = await Consultation.findById(cons._id).lean();
      assert.ok(stillThere);
    });

    await t.test('non-régression — consultation SANS facture liée reste supprimable, prescriptions toujours détachées (pas supprimées)', async () => {
      const cons = await Consultation.create({ patient: patient._id, medecin: medecin._id, motif: 'Sans facture' });
      created.consultations.push(cons._id);
      const presc = await Prescription.create({ patient: patient._id, medecin: medecin._id, consultation: cons._id, diagnostic: 'Test', lignes: [{ medicament_nom: 'Paracétamol' }] });
      created.prescriptions.push(presc._id);

      const res = await fetch(`${server.baseUrl}/consultations/${cons._id}`, withTimeout({ method: 'DELETE', headers: { Cookie: cookieAdmin } }));
      assert.equal(res.status, 200, 'aucune facture liée — la suppression doit toujours fonctionner');

      const goneConsultation = await Consultation.findById(cons._id).lean();
      assert.equal(goneConsultation, null);
      const detachedPresc = await Prescription.findById(presc._id).lean();
      assert.ok(detachedPresc, 'la prescription reste un document médical valide, jamais supprimée');
      assert.equal(detachedPresc.consultation, undefined, 'seul le lien vers la consultation supprimée doit être détaché');
      created.consultations = created.consultations.filter(id => String(id) !== String(cons._id));
    });

    await t.test('non-régression — accès API direct : consultation inexistante → 404 (comportement inchangé)', async () => {
      const res = await fetch(`${server.baseUrl}/consultations/${new mongoose.Types.ObjectId()}`, withTimeout({ method: 'DELETE', headers: { Cookie: cookieAdmin } }));
      assert.equal(res.status, 404);
    });
  } finally {
    if (connected) {
      const Invoice = require('../models/Invoice');
      const Consultation = require('../models/Consultation');
      const Prescription = require('../models/Prescription');
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await Invoice.deleteMany({ _id: { $in: created.invoices } });
      await Prescription.deleteMany({ _id: { $in: created.prescriptions } });
      await Consultation.deleteMany({ _id: { $in: created.consultations } });
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
