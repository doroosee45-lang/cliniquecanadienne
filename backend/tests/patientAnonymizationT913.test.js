// T9.13 — anonymisation patient avec purge en cascade. Vérifie contre une
// base réelle : (a) les champs identifiants du Patient et du compte User
// lié sont réellement effacés, les champs cliniques/statistiques conservés,
// (b) les copies d'identité (patient_nom, telephone, etc.) sont scrubées
// dans les 8 collections qui les dupliquent, SANS toucher au contenu
// clinique/financier de ces mêmes documents ni à la référence ObjectId vers
// le patient, (c) un modèle sans copie d'identité (Consultation) reste
// intact — preuve que le module ne touche que ce qu'il documente,
// (d) une seconde anonymisation est rejetée, (e) l'action est journalisée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('T9.13 — anonymizePatient() : cascade réelle, contenu clinique préservé (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const ArchiveEntry = require('../models/ArchiveEntry');
  const Delivery = require('../models/Delivery');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const ImagingResult = require('../models/ImagingResult');
  const Invoice = require('../models/Invoice');
  const LabResult = require('../models/LabResult');
  const Pregnancy = require('../models/Pregnancy');
  const Urgence = require('../models/Urgence');
  const Consultation = require('../models/Consultation');
  const { anonymizePatient } = require('../utils/patientAnonymization');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId() };
  const cleanup = [];
  let patientIdForCleanup = null;

  try {
    const patient = await Patient.create({
      nom: 'Nkoulou', prenom: 'Sylvie', date_naissance: '1988-04-12', sexe: 'F',
      email: `_t913-${stamp}@_test.local`, telephone: '+242061234567',
      groupe_sanguin: 'O+', allergies: ['Pénicilline'],
      adresse: { rue: 'Rue du Marché', ville: 'Souanké', pays: 'Congo' },
      contact_urgence: { nom: 'Jean Nkoulou', relation: 'Époux', telephone: '+242069876543' },
      notes: 'Note confidentielle',
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    patientIdForCleanup = patient._id;

    const linkedUser = await User.create({
      email: patient.email, password: 'Xx1aaaaa', nom: patient.nom, prenom: patient.prenom,
      role: 'patient', statut: 'actif', patient_id: patient._id,
    });
    cleanup.push(() => User.findByIdAndDelete(linkedUser._id));

    const medecin = await User.create({ email: `_t913-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'M', prenom: 'D', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));

    const consult = await Consultation.create({ patient: patient._id, medecin: medecin._id, anamnese: 'Contrôle de routine', diagnostic: 'RAS' });
    cleanup.push(() => Consultation.findByIdAndDelete(consult._id));

    const archive = await ArchiveEntry.create({ titre: 'Dossier archivé', categorie: 'patient', patient: patient._id, patient_nom: 'Nkoulou Sylvie' });
    cleanup.push(() => ArchiveEntry.findByIdAndDelete(archive._id));

    const delivery = await Delivery.create({ patient_id: patient._id, patient_nom: 'Nkoulou Sylvie', type_accouchement: 'voie_basse', terme: 39 });
    cleanup.push(() => Delivery.findByIdAndDelete(delivery._id));

    const dossierChir = await DossierChirurgical.create({ numero: `CHIR-T913-${stamp}`, patient_id: patient._id, patient_nom: 'Nkoulou Sylvie', telephone: '+242061234567', date_naissance: new Date('1988-04-12'), diagnostic_chirurgical: 'Appendicite' });
    cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossierChir._id));

    const imaging = await ImagingResult.create({ patient: patient._id, patient_nom: 'Nkoulou Sylvie', patient_dossier: patient.numero_dossier, patient_dob: '12/04/1988', telephone: '+242061234567', adresse: 'Rue du Marché', type_examen: 'Radio thorax', compte_rendu: 'RAS' });
    cleanup.push(() => ImagingResult.findByIdAndDelete(imaging._id));

    const invoice = await Invoice.create({ patient: patient._id, patient_nom: 'Nkoulou Sylvie', montant_direct: 15000, lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 15000, montant: 15000 }], montant_ttc: 15000 });
    cleanup.push(() => Invoice.findByIdAndDelete(invoice._id));

    const lab = await LabResult.create({ patient: patient._id, patient_nom: 'Nkoulou Sylvie', patient_dossier: patient.numero_dossier, telephone: '+242061234567', date_naissance: '12/04/1988', examens_demandes: ['glycemie'] });
    cleanup.push(() => LabResult.findByIdAndDelete(lab._id));

    const pregnancy = await Pregnancy.create({ patient_id: patient._id, patient_nom: 'Nkoulou', patient_prenom: 'Sylvie', telephone: '+242061234567', date_naissance: new Date('1988-04-12'), ddr: new Date('2025-01-01') });
    cleanup.push(() => Pregnancy.findByIdAndDelete(pregnancy._id));

    const urgence = await Urgence.create({ patient: patient._id, patient_nom: 'Nkoulou Sylvie', patient_tel: '+242061234567', patient_dob: new Date('1988-04-12'), contact_urgence: 'Jean Nkoulou', tel_urgence: '+242069876543', motif: 'Douleur thoracique' });
    cleanup.push(() => Urgence.findByIdAndDelete(urgence._id));

    let result;
    await t.test('anonymizePatient() réussit et retourne un résumé de la cascade', async () => {
      result = await anonymizePatient(patient._id, { utilisateur: admin._id, ip: '127.0.0.1' });
      assert.equal(result.userAnonymise, true);
      assert.equal(result.cascade.ArchiveEntry, 1);
      assert.equal(result.cascade.Delivery, 1);
      assert.equal(result.cascade.DossierChirurgical, 1);
      assert.equal(result.cascade.ImagingResult, 1);
      assert.equal(result.cascade.Invoice, 1);
      assert.equal(result.cascade.LabResult, 1);
      assert.equal(result.cascade.Pregnancy, 1);
      assert.equal(result.cascade.Urgence, 1);
    });

    await t.test('Patient — champs identifiants effacés, champs cliniques conservés', async () => {
      const fresh = await Patient.findById(patient._id).lean();
      assert.equal(fresh.nom, 'Patient anonymisé');
      assert.equal(fresh.email, undefined);
      assert.equal(fresh.telephone, undefined);
      assert.equal(fresh.notes, undefined);
      assert.equal(fresh.contact_urgence?.nom, undefined);
      assert.equal(fresh.anonymise, true);
      assert.ok(fresh.anonymise_at instanceof Date);
      assert.equal(fresh.anonymise_par.toString(), admin._id.toString());
      // Conservé — valeur clinique/statistique, non ré-identifiant isolément.
      assert.equal(fresh.groupe_sanguin, 'O+');
      assert.deepEqual(fresh.allergies, ['Pénicilline']);
      assert.equal(new Date(fresh.date_naissance).getFullYear(), 1988);
    });

    await t.test('User lié — anonymisé, ne peut plus se connecter', async () => {
      const fresh = await User.findById(linkedUser._id).lean();
      assert.equal(fresh.nom, 'Patient anonymisé');
      assert.notEqual(fresh.email, patient.email);
      assert.equal(fresh.statut, 'inactif');
    });

    await t.test('8 collections en cascade — copies d\'identité scrubées, contenu clinique/financier intact, référence ObjectId préservée', async () => {
      const freshArchive = await ArchiveEntry.findById(archive._id).lean();
      assert.equal(freshArchive.patient_nom, undefined);
      assert.equal(freshArchive.patient.toString(), patient._id.toString(), 'la référence vers le patient ne doit pas être retirée');
      assert.equal(freshArchive.categorie, 'patient', 'le contenu métier doit rester intact');

      const freshDelivery = await Delivery.findById(delivery._id).lean();
      assert.equal(freshDelivery.patient_nom, undefined);
      assert.equal(freshDelivery.terme, 39, 'donnée clinique conservée');

      const freshChir = await DossierChirurgical.findById(dossierChir._id).lean();
      assert.equal(freshChir.patient_nom, undefined);
      assert.equal(freshChir.telephone, undefined);
      assert.equal(freshChir.date_naissance, undefined);
      assert.equal(freshChir.diagnostic_chirurgical, 'Appendicite', 'donnée clinique conservée');

      const freshImg = await ImagingResult.findById(imaging._id).lean();
      assert.equal(freshImg.patient_nom, undefined);
      assert.equal(freshImg.patient_dob, undefined);
      assert.equal(freshImg.telephone, undefined);
      assert.equal(freshImg.adresse, undefined);
      assert.equal(freshImg.compte_rendu, 'RAS', 'donnée clinique conservée');

      const freshInv = await Invoice.findById(invoice._id).lean();
      assert.equal(freshInv.patient_nom, undefined);
      assert.equal(freshInv.montant_ttc, 15000, 'donnée financière conservée — obligation comptable/légale');

      const freshLab = await LabResult.findById(lab._id).lean();
      assert.equal(freshLab.patient_nom, undefined);
      assert.equal(freshLab.telephone, undefined);
      assert.equal(freshLab.date_naissance, undefined);
      assert.deepEqual(freshLab.examens_demandes, ['glycemie'], 'donnée clinique conservée');

      const freshPreg = await Pregnancy.findById(pregnancy._id).lean();
      assert.equal(freshPreg.patient_nom, undefined);
      assert.equal(freshPreg.patient_prenom, undefined);
      assert.equal(freshPreg.telephone, undefined);
      assert.equal(freshPreg.date_naissance, undefined);
      assert.ok(freshPreg.ddr, 'donnée clinique conservée');

      const freshUrg = await Urgence.findById(urgence._id).lean();
      assert.equal(freshUrg.patient_nom, undefined);
      assert.equal(freshUrg.patient_tel, undefined);
      assert.equal(freshUrg.patient_dob, undefined);
      assert.equal(freshUrg.contact_urgence, undefined);
      assert.equal(freshUrg.tel_urgence, undefined);
      assert.equal(freshUrg.motif, 'Douleur thoracique', 'donnée clinique conservée');
    });

    await t.test('Consultation — aucune copie d\'identité dans ce modèle, document non touché', async () => {
      const freshConsult = await Consultation.findById(consult._id).lean();
      assert.equal(freshConsult.diagnostic, 'RAS');
      assert.equal(freshConsult.anamnese, 'Contrôle de routine');
      assert.equal(freshConsult.patient.toString(), patient._id.toString());
    });

    await t.test('une seconde anonymisation du même patient est rejetée', async () => {
      await assert.rejects(() => anonymizePatient(patient._id, { utilisateur: admin._id }), /déjà anonymisé/);
    });

    await t.test('l\'anonymisation est journalisée dans AuditLog', async () => {
      const log = await AuditLog.findOne({ action: 'ANONYMIZE', module: 'patients', entite_id: patient._id.toString() }).lean();
      assert.ok(log, 'une entrée ANONYMIZE doit exister dans le journal d\'audit');
      assert.equal(log.utilisateur.toString(), admin._id.toString());
    });
  } finally {
    for (const fn of cleanup) await fn();
    if (patientIdForCleanup) {
      await AuditLog.deleteMany({ action: 'ANONYMIZE', module: 'patients', entite_id: patientIdForCleanup.toString() });
    }
    await mongoose.disconnect();
  }
});
