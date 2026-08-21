# Entités (modèles Mongoose) — MediSync

**Statut :** Référence vivante (Phase 1). Complète `cartographie-modules.md` (relations) avec le détail des 37 modèles réels du backend (`backend/models/`). Champs listés = ceux qui structurent le modèle (identité, statut, relations) — pas un dump exhaustif du schéma.

## Dossier patient et référentiel central

- **Patient** (`Patient.js`) — `numero_dossier`, `nom/prenom`, `date_naissance`, `sexe`, `groupe_sanguin`, `allergies[]`, `antecedents_*[]`, `maladies_chroniques[]`, `medecin_referent`→User, `assurances[]` (nom, pas de ref Insurance), `statut` (actif/inactif/decede), `actif` (compte portail activé), `anonymise`. Aucune référence sortante vers un autre module.
- **User** (`User.js`) — compte de connexion (staff + patients). `email`, `password` (optionnel, comptes Google), `role` (11 valeurs, dont `patient`), `specialite`, `service` (texte libre), `statut` (actif/inactif/suspendu), `patient_id`→Patient (comptes patient uniquement), `googleId`.

## Parcours clinique

- **Appointment** (RDV) — `patient`, `medecin`→User, `service`→Service (optionnel), `date_heure`, `type`, `statut` (10 valeurs), index unique anti-double-réservation (médecin+créneau).
- **Consultation** — `patient`, `medecin`→User, `appointment`→Appointment (optionnel), `signes_vitaux{}`, `diagnostic`, `prescriptions[]` (texte libre, pas une ref Prescription), `examens_complementaires[]` (**texte libre — pas une ref LabResult/ImagingResult**, voir `workflows.md` — écart reporté à la **Phase 6**), `decision`, `ia_suggestions[]`.
- **Prescription** (Ordonnances) — `patient`, `medecin`→User, `consultation`→Consultation (optionnel), `lignes[].medicament`→Medication (optionnel, `medicament_nom` texte libre en repli), `statut` (brouillon→active→publiee→dispensee/expiree/annulee), `dispensee_par`/`publie_par`→User.
- **LabResult** (Laboratoire) — `patient`, `medecin_prescripteur`/`technicien`/`validateur`/`acquitte_par`→User, `examen`→ExamCatalogue (optionnel), `est_critique`, `statut` (7 valeurs).
- **ImagingResult** (Imagerie) — `patient`, `medecin_prescripteur`/`radiologue`→User, `examen`→ExamCatalogue (optionnel), `ia_anomalie`, `statut` (6 valeurs).
- **Echographie** — `patient` (texte libre) + `patient_ref`→Patient (optionnel). Pas de lien à Consultation (écart documenté, décision 0003).
- **ExamCatalogue** — catalogue commun labo/imagerie (`nom`, `code`, `type`, `prix`, `delai_rendu_h`). Référencé par LabResult/ImagingResult, jamais l'inverse.

## Urgences, Hospitalisation, Chirurgie

- **Urgence** — `patient`→Patient (optionnel, `patient_nom` texte libre en repli), `medecin_responsable`→User, `niveau_triage`, `statut` (9 valeurs), `decision`, `admission_status` (ADR-0005 : non_requise/preparation/terminee/annulee — jamais réassignable par le client), `soins[]`/`prescriptions[]`/`examens[]`/`timeline[]` (sous-documents, texte libre).
- **Hospitalization** — `patient`→Patient, `urgence_id`→Urgence (optionnel, ADR-0005), `chambre`→Room (optionnel), `service`→Service (optionnel), `medecin_responsable`→User, `statut` (en_cours/sorti/transfere/decede), sous-ressources dossier de séjour (`constantes[]`, `traitements[]`, `examens[]`, `visites[]`, `prescriptions_sejour[]`).
- **Room** (Chambres & Lits) — `service`→Service, `lits[]` **sous-document embarqué** (pas une collection séparée), `lits[].patient_actuel`→Patient, `lits[].statut` (libre/occupe/maintenance/reserve).
- **DossierChirurgical** (Chirurgie + Bloc opératoire, même modèle) — `patient_id`→Patient, `chirurgien_id`→User, `statut` (consultation→preoperatoire→opere→suivi_postop→cloture), `decision` (inclut `'hospitalisation'` — **non relié à Hospitalization**, voir écart), `salle_prevue`/`date_intervention_prev` (programmation bloc, index unique anti-conflit), `ia_risque_score/niveau`.
- **Complication** / **Bilan** / **SuiviPostop** — tous `dossier_chirurgical_id`→DossierChirurgical (requis). Sous-dossiers réels du parcours chirurgical (complications post-opératoires, bilans pré-op, suivi post-op).

## Maternité et Pédiatrie

- **Pregnancy** (Grossesse) — `patient_id`→Patient (optionnel), `statut` (active/accouchee/suivi_postnatal/cloturee/a_risque), `cpns[]` (consultations prénatales, sous-documents), `echographies[]`, `salle_travail{}`.
- **Delivery** (Accouchement) — `grossesse_id`→Pregnancy, `patient_id`→Patient, `type_accouchement` (voie_basse/cesarienne/forceps/ventouse).
- **Newborn** (Nouveau-né) — `accouchement_id`→Delivery, `grossesse_id`→Pregnancy, `patient_id`→Patient (optionnel), `child_id`→Child (optionnel, posé uniquement sur action explicite du personnel — jamais de création automatique de dossier Child).
- **Child** (Dossier enfant, Pédiatrie) — `patient_id`→Patient (optionnel), `vaccinations[]`, `mesures_croissance[]`, `maladies_chroniques[]`, `statut` (normal/surveillance/a_risque/chronique).
- **PediatricConsultation** — `child_id`→Child (requis, **pas de lien direct à Patient**), signes vitaux, `diagnostic`, `gravite`.

## Pharmacie

- **Medication** — autonome (aucune ref Patient). `stock_actuel/minimum`, `seuil_alerte`, `statut` (disponible/rupture/suspendu/perime), `mouvements[]` (entree/sortie/dispensation/retour/perte/peremption, `utilisateur`→User).
- **Commande** (bon de commande fournisseur) — `lignes[].medicament`→Medication (optionnel), `statut` (brouillon→...→recu/annule), `cree_par`→User.

## Facturation, Documents, Archivage, IA

- **Invoice** (Facture) — `patient`→Patient (optionnel, `patient_nom` en repli), `lignes[]` (catégorie/montant — **`categorie` est un enum texte, aucune référence vers le document clinique d'origine**, voir `workflows.md` §6 — écart reporté à la **Phase 3**), `paiements[]` (sous-documents), `statut` recalculé automatiquement (`pre('save')`) selon `montant_paye`/`montant_ttc`.
- **Depense** — autonome. `categorie` (Salaires/Médicaments/.../Autre), `montant`, `statut` (paye/en_attente), `enregistre_par`→User. Source réelle des dépenses (dashboard/analytics), pas une estimation.
- **Document** — `patient`→Patient (optionnel), `lifecycle_statut` (actif→archive_chaud→archive_froid→purge_planifiee), `hash_integrite`, `version`.
- **ArchiveEntry** (Archivage) — `patient`→Patient (optionnel), `source_model` (String) + `source_id` (ObjectId) — **référence polymorphe par convention, pas un `ref` Mongoose typé** (seul modèle du projet à utiliser ce pattern — écart reporté à la **Phase 21**). `categorie` (patient/consultation/laboratoire/imagerie/hospitalisation/chirurgie/financier/document), `statut` (archive/restauré/purge_planifiee).
- **AIPrediction** — `patient`→Patient (optionnel), `type` (diagnostic/anomalie_labo/anomalie_imagerie/interaction_medicament), `traite_par`→User.

## Ressources humaines

- **Staff** — `utilisateur`→User (optionnel, sparse — un employé peut exister sans compte de connexion), `poste`, `type_contrat`, `planning[]`, `conges[]` (`approuve_par`→User), `matricule` auto-généré.
- **Salaire** — un bulletin par `staff`→Staff et par `mois` (index unique composé), `net` recalculé automatiquement, `paye_par`→User.
- **Service** (Département/Service hospitalier) — `chef_service`→User. Référencé par Appointment, Room, Hospitalization.

## Communication et système

- **Conversation** (Messagerie) — `membres[]`→User, `messages[].expediteur`→User, `messages[].lu_par[]`→User. Jamais de référence Patient (relie des comptes, pas des dossiers cliniques).
- **Notification** — `destinataire`→User (requis), `type` (info/warning/critical/success/ai_alert/rappel/alert), `lu`, `priorite`.
- **AuditLog** — `utilisateur`→User (optionnel), `action`/`module`/`entite_id` (String, pas une ref typée), `donnees_avant/apres` (Mixed), `statut` (succes/echec).
- **RecurringProtocol** (Protocoles récurrents) — `medecin`→User (requis), `frequence`, `prochaine_date`. Ne référence aucun patient individuel (protocole générique).

## Référentiels autonomes

- **Insurance** (Assurances) — aucune relation `ObjectId` ; référencée par **nom** dans `Patient.assurances[]`, pas par ref typé.
- **Ambulance** — `missions[]` en sous-documents texte libre, aucune ref Patient/Urgence.
- **Setting** (Paramètres) / **Counter** (compteurs séquentiels atomiques : `patient-2026`, `invoice-2026`...) — infrastructure technique, aucune relation métier.
