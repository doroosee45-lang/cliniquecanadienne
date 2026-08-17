// Phase 10.1 — test de non-régression croisé Urgences↔Hospitalisation.
// Investigation (ticket 0018) : contrairement à Maternité→Pédiatrie ou
// Chirurgie→Journal d'audit, il n'existe AUCUN couplage réel en code entre
// ces deux modules malgré Urgence.decision qui accepte 'hospitalisation' et
// Urgence.statut qui accepte 'hospitalise' — ces valeurs ne déclenchent
// jamais la création d'un dossier Hospitalization. Décision explicite de
// l'utilisateur (Phase 10.1) : plutôt que d'inventer un test sur un flux qui
// n'existe pas, ce test verrouille l'absence actuelle de couplage, pour
// qu'une automatisation future non délibérée (ou une régression si un
// couplage est un jour ajouté puis cassé) soit détectée. Ne touche jamais
// urgencesController.js (hors périmètre, travail actif de l'utilisateur).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Urgences↔Hospitalisation — decision="hospitalisation"/statut="hospitalise" ne crée aucun dossier Hospitalization (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Urgence = require('../models/Urgence');
  const Hospitalization = require('../models/Hospitalization');
  const Patient = require('../models/Patient');

  const stamp = Date.now();
  let patient, urgenceId;

  try {
    patient = await Patient.create({ nom: `T101URGHOSP${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });

    await t.test('une Urgence avec decision="hospitalisation" et statut="hospitalise" ne produit aucun document Hospitalization référençant ce patient', async () => {
      const before = await Hospitalization.countDocuments({ patient: patient._id });
      assert.equal(before, 0, 'précondition : aucune hospitalisation ne doit préexister pour ce patient de test');

      const urgence = await Urgence.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        motif: 'T101 douleur thoracique', statut: 'hospitalise', decision: 'hospitalisation',
      });
      urgenceId = urgence._id;

      const after = await Hospitalization.countDocuments({ patient: patient._id });
      assert.equal(after, 0, 'aucun dossier Hospitalization ne doit être créé automatiquement — écart documenté, ticket 0018');
    });
  } finally {
    if (urgenceId) await Urgence.findByIdAndDelete(urgenceId);
    if (patient) await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
