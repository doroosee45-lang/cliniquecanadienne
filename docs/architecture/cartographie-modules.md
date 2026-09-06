# Cartographie des modules et relations intermodules — MediSync

**Statut :** Référence vivante (Phase 1 du plan directeur, 21/08/2026).
**Portée :** Décrit les relations **réellement modélisées** (`ref:` Mongoose) entre les 37 modèles du backend, telles que constatées dans le code au moment de la rédaction — pas une architecture cible ni une intention. Chaque écart entre la structure attendue et la structure réelle est signalé explicitement plutôt que lissé.

**Méthode :** Un seul modèle documente une relation réelle : la présence d'un champ `{ type: ObjectId, ref: 'Autre' }` dans le schéma Mongoose. Une relation évoquée par un nom de module, un commentaire ou une page frontend, mais absente du schéma, est marquée **« non modélisée »**.

## 1. Vue d'ensemble

```
Patient (référentiel central)
│
├── Appointment (RDV)              — patient, medecin, service
├── Consultation                   — patient, medecin, appointment
│   └── Prescription               — patient, medecin, consultation, lignes[].medicament
├── LabResult (Laboratoire)        — patient, medecin_prescripteur, technicien, validateur, examen
├── ImagingResult (Imagerie)       — patient, medecin_prescripteur, radiologue, examen
├── Echographie                    — patient (requis — renommé depuis patient_ref, DATA-003)  [voir écart §3.5]
├── Urgence                        — patient, medecin_responsable
│   └── Hospitalization            — patient, urgence_id, chambre (Room), service, medecin_responsable
├── DossierChirurgical (Chirurgie / Bloc opératoire) — patient (requis — renommé depuis patient_id, ADR-0006), chirurgien_id  [voir écart §3.7]
│   ├── Complication                — dossier_chirurgical_id
│   ├── Bilan                       — dossier_chirurgical_id
│   └── SuiviPostop                 — dossier_chirurgical_id
├── Pregnancy (Maternité)          — patient_id
│   └── Delivery (Accouchement)    — grossesse_id, patient_id
│       └── Newborn                 — accouchement_id, grossesse_id, patient_id, child_id
├── Child (Pédiatrie)              — patient_id
│   └── PediatricConsultation       — child_id  [pas de lien direct à Patient, voir §3.8]
├── Document                        — patient
├── ArchiveEntry (Archivage)        — patient
├── Invoice (Facturation)           — patient
└── AIPrediction (IA)               — patient

Transverses (hors branche Patient) :
User ← référencé par presque tous les modules (medecin, chirurgien_id, created_by, cree_par...)
Room (Lit)      — service ; lits[] embarqué (patient_actuel) — pas un modèle séparé
Service         — chef_service (User)
Staff / Salaire — utilisateur (User) ; Salaire.staff
Medication (Pharmacie) — Commande.medicament, Prescription.lignes[].medicament
Conversation / Notification / AuditLog — utilisateur/destinataire (User)
ExamCatalogue   — référencé par LabResult.examen et ImagingResult.examen
Insurance, Ambulance, Setting, Counter — autonomes, aucune relation ObjectId vers un autre module
Analytics       — aucun modèle propre ; agrège les collections ci-dessus (voir analytics.controller.js)
```

## 2. Patient — référentiel central

`models/Patient.js`. Champs clés : `numero_dossier`, `nom/prenom`, `medecin_referent` (→ User), `statut`, `actif`, `anonymise`.

**Référencé par** (relations entrantes réelles, revérifiées DATA-003 le 6 sept. 2026) : Appointment, Consultation, Prescription, LabResult, ImagingResult, Echographie, Urgence, Hospitalization, DossierChirurgical, Pregnancy (`patient_id`), Delivery (`patient_id`), Newborn (`patient_id`), Child (`patient_id`), Document, ArchiveEntry, Invoice, AIPrediction, User (`patient_id`, compte portail), Room.lits[] (`patient_actuel`). Détail des 3 conventions de nommage réelles (`patient`/`patient_id`/`patient_actuel` — `patient_ref` n'existe plus) : `patient-reference.md` §2.

Patient ne référence lui-même **aucun** autre module (pas de champ `ObjectId` sortant) — confirme qu'il est bien la source unique de vérité démographique, jamais un consommateur d'un autre module.

## 3. Parcours clinique

### 3.1 Rendez-vous — `Appointment`
`patient`, `medecin` (User), `service` (Service, optionnel), `created_by`.
Référencé par : Consultation (`appointment`, optionnel).

### 3.2 Consultation
`patient`, `medecin` (User, requis), `appointment` (optionnel — une consultation peut exister sans RDV préalable, ex. urgence).
Référencé par : Prescription (`consultation`, optionnel).

### 3.3 Prescription (Ordonnances)
`patient`, `medecin`, `consultation` (optionnel), `lignes[].medicament` (→ Medication, optionnel — une ligne peut être en texte libre `medicament_nom` sans lien catalogue), `dispensee_par` / `publie_par` (User).

### 3.4 Laboratoire (`LabResult`) et Imagerie (`ImagingResult`)
Tous deux : `patient` (requis), `medecin_prescripteur` (User), `examen` (→ ExamCatalogue, optionnel — champs texte libre en repli). `ImagingResult` ajoute `radiologue` (User). `LabResult` ajoute `technicien`, `validateur`, `acquitte_par`.

### 3.5 Échographie — **écart réel**
`Echographie.js` ne référence que `patient` (→ Patient, requis — renommé depuis `patient_ref`, DATA-003). **Aucun champ ne la relie à `Consultation`**, contrairement à la place qu'elle occupe dans l'arborescence attendue (`Consultation → Échographie`). Décision 0003 (déjà actée avant cette phase) : cet écart est connu et volontairement non corrigé pour l'instant. Documenté ici pour que la cartographie reste honnête plutôt que de faire apparaître un lien qui n'existe pas en base.

### 3.6 Urgences → Hospitalisation
Cf. ADR-0005 (Phase 4, ce même plan). `Hospitalization.urgence_id` (optionnel, ref Urgence) est le seul lien structurel, posé uniquement par une action humaine explicite — jamais de création automatique. `Hospitalization` référence en plus `chambre` (Room), `service` (Service), `medecin_responsable` (User).

### 3.7 Chirurgie / Bloc opératoire — **écart réel**
Il n'existe **pas de modèle « Bloc opératoire » séparé**. `DossierChirurgical` porte à la fois le dossier chirurgical et la programmation au bloc (`salle_prevue`, `date_intervention_prev`, index unique anti-conflit de créneau) — « Bloc opératoire » est une vue/contrôleur (`blocoperatoireController.js`) sur cette même collection, pas un module distinct.

Plus important : **`DossierChirurgical` ne référence pas `Hospitalization`** (aucun champ `hospitalization_id`, vérifié dans les deux sens). Les deux modules ne partagent qu'une référence commune à `Patient`. Signal supplémentaire : `DossierChirurgical.decision` a un enum incluant `'hospitalisation'` — exactement le même symptôme que `Urgence.decision` avant l'ADR-0005 (une valeur qui suggère un couplage sans qu'aucun champ ne le concrétise) — sauf qu'ici, **aucune décision n'a encore été prise** sur ce couplage. Ce document se contente de le constater ; toute automatisation ou champ de liaison devrait suivre le même processus de décision que l'ADR-0005 (option légère d'abord, jamais un nouveau modèle central).

> **Point d'attention reporté à la Phase 9** (Hospitalisation → Chirurgie → Bloc, selon l'ordre de priorité du plan directeur) : cet écart n'est délibérément pas traité maintenant. Il ne doit être corrigé qu'au moment de cette phase, avec la même rigueur de décision que l'ADR-0005 (jamais un nouveau modèle central, jamais une automatisation silencieuse).

`DossierChirurgical` est le parent réel de `Complication`, `Bilan`, `SuiviPostop` (tous via `dossier_chirurgical_id`, requis).

### 3.8 Maternité et Pédiatrie
`Pregnancy.patient_id` → `Delivery.grossesse_id/patient_id` → `Newborn.accouchement_id/grossesse_id/patient_id/child_id`. Un nouveau-né peut donc être relié simultanément à l'accouchement, à la grossesse, à son propre dossier `Patient` (s'il en existe un) et à un dossier `Child` — les quatre références sont indépendantes et toutes optionnelles, pas une chaîne stricte.

`Child.patient_id` (optionnel) → `PediatricConsultation.child_id` (requis). **Écart réel** : `PediatricConsultation` référence `Child`, jamais directement `Patient` — cohérent avec l'arborescence attendue (Pédiatrie est bien un sous-dossier de l'enfant, pas un doublon du dossier Patient), mais à garder en tête si une requête doit un jour remonter une consultation pédiatrique jusqu'au Patient : il faut passer par `Child.patient_id`, la jointure n'est pas directe.

## 4. Pharmacie, Documents, Archivage, Facturation, IA

- **Pharmacie** : `Medication` est autonome (pas de FK vers Patient) ; `Commande.medicament` (→ Medication) modélise les bons de commande fournisseur ; `Prescription.lignes[].medicament` est le seul lien Patient→Médicament (via la prescription).
- **Documents** (`Document`) : `patient` (optionnel), `created_by` (User).
- **Archivage** (`ArchiveEntry`) : `patient` (optionnel), `archive_par`/`restaure_par` (User).
- **Facturation** (`Invoice`) : `patient` (optionnel — une facture peut exister sans patient structuré, `patient_nom` en repli), `enregistre_par`/`created_by` (User).
- **IA** (`AIPrediction`) : `patient` (optionnel), `traite_par` (User).
- **Analytics** : aucun modèle dédié — `analytics.controller.js` agrège directement Patient/Appointment/Consultation/Invoice/Depense/... Aucune donnée propre à archiver ou faire évoluer ici.

## 5. Modules transverses (hors branche Patient)

| Module | Modèle(s) | Relations réelles |
|---|---|---|
| Utilisateurs / RH | `User`, `Staff`, `Salaire` | `Staff.utilisateur`→User ; `Salaire.staff`→Staff, `Salaire.paye_par`→User |
| Chambres & Lits | `Room` | `service`→Service ; `lits[]` **embarqué** (sous-document, pas une collection séparée), `lits[].patient_actuel`→Patient |
| Services | `Service` | `chef_service`→User |
| Messagerie | `Conversation`, `Notification` | membres/expediteur/lu_par/destinataire → User (jamais Patient — la messagerie relie des comptes User, pas des dossiers cliniques) |
| Audit | `AuditLog` | `utilisateur`→User |
| Ambulances | `Ambulance` | aucune (mission en sous-document texte libre, pas de FK Patient/Urgence) |
| Assurances | `Insurance` | aucune (référencée par nom dans `Patient.assurances`, pas par ObjectId) |
| Catalogue examens | `ExamCatalogue` | référencé par `LabResult.examen` et `ImagingResult.examen` |
| Paramètres / Compteurs | `Setting`, `Counter` | aucune — infrastructure technique |

## 6. Écarts identifiés (résumé)

| # | Écart | Statut |
|---|---|---|
| 1 | `Echographie` non reliée à `Consultation` (seulement à Patient) | Connu, décision 0003, non corrigé (choix délibéré) |
| 2 | `DossierChirurgical` non relié à `Hospitalization` | **Nouvellement constaté ici** — reporté à la **Phase 9** (Hospitalisation → Chirurgie → Bloc) du plan directeur, à traiter alors comme l'a été Urgences→Hospitalisation (ticket 0018 → ADR-0005) |
| 3 | Pas de modèle « Bloc opératoire » séparé — c'est `DossierChirurgical` lui-même | Architecture existante assumée, pas un défaut — à ne pas « corriger » en créant un modèle superflu |
| 4 | `PediatricConsultation` ne remonte au Patient que via `Child.patient_id` (pas de raccourci direct) | Cohérent avec le modèle, à connaître pour toute requête transverse |
| 5 | `Consultation` ne référence pas les `Prescription`/`LabResult`/`ImagingResult` réellement créés à partir d'elle (sous-documents texte libre) | Reporté à la **Phase 6** du plan directeur (voir `workflows.md` §2-3, `relationships.md` constat #4) |
| 6 | `Invoice` n'a aucune référence vers le document clinique d'origine (catégorie = enum texte, pas un `ref`) | Reporté à la **Phase 3** du plan directeur (voir `workflows.md` §6) |
| 7 | `ArchiveEntry` utilise une référence polymorphe non typée (`source_model`/`source_id`) au lieu d'un `ref` Mongoose | Reporté à la **Phase 21** du plan directeur (voir `workflows.md` §9, `relationships.md` constat #3) |

**Aucune modification de code n'a été effectuée pour produire ce document** — Phase 1 est une cartographie, pas une correction. Seul l'écart #2 constitue une décision réellement ouverte ; il est à soumettre avant tout code, conformément à la règle établie en Phase 4 (ne jamais introduire une relation structurante ou un nouveau modèle sans validation préalable). Les écarts #1, #3 et #4 sont déjà tranchés ou n'appellent aucune action — listés ici pour que la cartographie reste complète, pas comme des tâches en attente.
