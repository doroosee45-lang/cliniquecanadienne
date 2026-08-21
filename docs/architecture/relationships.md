# Relations intermodules — MediSync

**Statut :** Référence vivante (Phase 1). Matrice exhaustive des relations `ref:` Mongoose réelles entre les 37 modèles (source : `backend/models/*.js`, revue exhaustive au 21/08/2026). Complète `cartographie-modules.md` (vue narrative par module) avec une vue tabulaire complète.

**Lecture :** « Références (sortantes) » = champs `ObjectId`/`ref` déclarés sur le modèle lui-même. « Référencé par (entrantes) » = modèles qui pointent vers celui-ci. Un champ marqué *(opt.)* est optionnel dans le schéma — sa relation peut être absente sur un document réel.

| Modèle | Références sortantes | Référencé par (entrantes) |
|---|---|---|
| **Patient** | — (aucune) | Appointment, Consultation, Prescription, LabResult, ImagingResult, Echographie (`patient_ref`, opt.), Urgence (opt.), Hospitalization, DossierChirurgical, Pregnancy (opt.), Delivery (opt.), Newborn (opt.), Child (opt.), Document (opt.), ArchiveEntry (opt.), Invoice (opt.), AIPrediction (opt.), Room.lits[] (`patient_actuel`, opt.), User (`patient_id`, opt.) |
| **User** | Patient (`patient_id`, opt.) | Patient (`medecin_referent`, `cree_par`, `anonymise_par`), Appointment (`medecin`, `created_by`), Consultation (`medecin`), Prescription (`medecin`, `dispensee_par`, `publie_par`), LabResult (`medecin_prescripteur`, `technicien`, `validateur`, `acquitte_par`), ImagingResult (`medecin_prescripteur`, `radiologue`), Urgence (`medecin_responsable`), Hospitalization (`medecin_responsable`), DossierChirurgical (`chirurgien_id`), Room.lits *(non — Room ne référence pas User)*, Staff (`utilisateur`, `conges[].approuve_par`), Salaire (`paye_par`), Service (`chef_service`), Medication.mouvements[] (`utilisateur`), Commande (`cree_par`), Depense (`enregistre_par`), Document (`created_by`), ArchiveEntry (`archive_par`, `restaure_par`), AIPrediction (`traite_par`), Child (`created_by`), Pregnancy (`created_by`), Delivery (`created_by`), Newborn (`created_by`), PediatricConsultation (`created_by`), RecurringProtocol (`medecin`, `created_by`), Conversation (`membres[]`, `messages[].expediteur`, `messages[].lu_par[]`, `created_by`), Notification (`destinataire`), AuditLog (`utilisateur`), Invoice (`enregistre_par`, `created_by`) |
| **Appointment** | Patient, User (`medecin`), Service (opt.) | Consultation (`appointment`, opt.) |
| **Consultation** | Patient, User (`medecin`), Appointment (opt.) | Prescription (`consultation`, opt.) |
| **Prescription** | Patient, User (`medecin`, `dispensee_par`, `publie_par`), Consultation (opt.), Medication (`lignes[].medicament`, opt.) | — (aucune) |
| **LabResult** | Patient, User (`medecin_prescripteur`, `technicien`, `validateur`, `acquitte_par`), ExamCatalogue (opt.) | — (aucune) |
| **ImagingResult** | Patient, User (`medecin_prescripteur`, `radiologue`), ExamCatalogue (opt.) | — (aucune) |
| **Echographie** | Patient (`patient_ref`, opt.) | — (aucune) |
| **ExamCatalogue** | — (aucune) | LabResult (`examen`, opt.), ImagingResult (`examen`, opt.) |
| **Urgence** | Patient (opt.), User (`medecin_responsable`) | Hospitalization (`urgence_id`, opt.) |
| **Hospitalization** | Patient, Urgence (opt.), Room (`chambre`, opt.), Service (opt.), User (`medecin_responsable`) | — (aucune — **pas DossierChirurgical**, voir écart §6 de `cartographie-modules.md`) |
| **Room** | Service (opt.) | Hospitalization (`chambre`, opt.) |
| **DossierChirurgical** | Patient (`patient_id`), User (`chirurgien_id`, opt.) | Complication, Bilan, SuiviPostop (tous `dossier_chirurgical_id`, requis) |
| **Complication / Bilan / SuiviPostop** | DossierChirurgical (`dossier_chirurgical_id`, requis) | — (aucune) |
| **Pregnancy** | Patient (opt.), User (`created_by`, opt.) | Delivery (`grossesse_id`, opt.), Newborn (`grossesse_id`, opt.) |
| **Delivery** | Pregnancy (opt.), Patient (opt.), User (`created_by`, opt.) | Newborn (`accouchement_id`, opt.) |
| **Newborn** | Delivery (opt.), Pregnancy (opt.), Patient (opt.), Child (opt.), User (`created_by`, opt.) | — (aucune) |
| **Child** | Patient (opt.), User (`created_by`, opt.) | Newborn (`child_id`, opt.), PediatricConsultation (`child_id`, requis) |
| **PediatricConsultation** | Child (requis), User (`created_by`, opt.) | — (aucune) |
| **Medication** | — (aucune) | Prescription (`lignes[].medicament`, opt.), Commande (`lignes[].medicament`, opt.) |
| **Commande** | Medication (opt.), User (`cree_par`) | — (aucune) |
| **Invoice** | Patient (opt.), User (`enregistre_par`, `created_by`) | — (aucune) |
| **Depense** | User (`enregistre_par`) | — (aucune) |
| **Document** | Patient (opt.), User (`created_by`) | — (aucune) |
| **ArchiveEntry** | Patient (opt.), User (`archive_par`, `restaure_par`) ; `source_id`/`source_model` = référence polymorphe non typée | — (aucune) |
| **AIPrediction** | Patient (opt.), User (`traite_par`) | — (aucune) |
| **Staff** | User (`utilisateur`, opt.), User (`conges[].approuve_par`) | Salaire (`staff`, requis) |
| **Salaire** | Staff (requis), User (`paye_par`) | — (aucune) |
| **Service** | User (`chef_service`, opt.) | Appointment (`service`, opt.), Room (`service`, opt.), Hospitalization (`service`, opt.) |
| **Conversation** | User (`membres[]`, `messages[].expediteur`, `messages[].lu_par[]`, `created_by`) | — (aucune) |
| **Notification** | User (`destinataire`, requis) | — (aucune) |
| **AuditLog** | User (`utilisateur`, opt.) | — (aucune) |
| **RecurringProtocol** | User (`medecin`, `created_by`) | — (aucune) |
| **Insurance** | — (aucune) | Aucune — référencée par **nom** dans `Patient.assurances[]`, pas par `ObjectId` |
| **Ambulance** | — (aucune) | — (aucune) |
| **Setting / Counter** | — (aucune) | — (aucune) |

## Constats transverses

1. **User est le nœud le plus référencé du graphe**, loin devant Patient — cohérent avec son rôle de traçabilité (`created_by`/`enregistre_par`/`traite_par`/`approuve_par` sur quasiment tous les modules), pas un signe de couplage excessif.
2. **Trois modèles n'ont aucune relation `ObjectId` sortante ni entrante** : `Ambulance`, `Setting`, `Counter` — confirmé autonomes, aucune dépendance intermodule à surveiller.
3. **Un seul modèle utilise une référence polymorphe non typée** : `ArchiveEntry.source_model`/`source_id` (String + ObjectId, résolu manuellement par le contrôleur selon la valeur de `source_model`) — pattern différent de tout le reste du projet, qui utilise systématiquement `ref:` Mongoose. À connaître avant d'ajouter une nouvelle catégorie d'archive. Reporté à la **Phase 21** du plan directeur.
4. **Deux modules cliniques indépendants du reste** : `Consultation.examens_complementaires[]` et `Consultation.prescriptions[]` sont des sous-documents **texte libre**, jamais des références vers `LabResult`/`ImagingResult`/`Prescription` — la consultation ne « sait » pas quels documents réels ont été générés à partir d'elle (seule `Prescription.consultation` fait le lien, dans l'autre sens, et seulement pour les ordonnances). Voir `workflows.md` pour le détail du parcours réel. Reporté à la **Phase 6** du plan directeur.
5. **Comparable à Urgences avant l'ADR-0005** : `DossierChirurgical` (chirurgie) n'a aucun lien vers `Hospitalization`, malgré un champ `decision` incluant `'hospitalisation'` — écart déjà noté dans `cartographie-modules.md`, reporté à la Phase 9.
