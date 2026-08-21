# Ticket 0021 — `DossierChirurgical.patient_id` incohérent avec la convention majoritaire `patient`

**Statut :** Résolu — voir ADR-0006
**Origine :** Phase 1 (cartographie), `docs/architecture/relationships.md`/`entities.md`/`patient-reference.md` — confirmé lors du démarrage de la Phase 2 (Patient comme référentiel unique)
**Sévérité :** Faible/informative — pas un bug (rien ne casse), écart de nommage entre modules

## Constat

18 des 37 modèles du projet portent un pointeur vers `Patient`, sous 3 noms de champ différents :

- `patient` (ObjectId) — 11 modèles : Appointment, Consultation, Prescription, LabResult, ImagingResult, Urgence, Hospitalization, Document, ArchiveEntry, Invoice, AIPrediction
- `patient_id` — 6 modèles : **DossierChirurgical**, Pregnancy, Delivery, Newborn, Child, User
- `patient_ref` — 1 modèle : Echographie

`DossierChirurgical.patient_id` (`backend/models/DossierChirurgical.js:6`) suit la convention minoritaire. Ce n'est pas un défaut fonctionnel — le champ est requis, indexé (AUDIT-B2) et correctement utilisé partout où il apparaît — mais une incohérence de nommage qui complique toute requête ou tout code transverse manipulant plusieurs modèles liés à `Patient`.

## Ce qui a été vérifié

Utilisation exhaustive de `patient_id` sur ce modèle, recherchée par grep :
- `backend/models/DossierChirurgical.js` — déclaration du champ + index composé (`{patient_id:1, created_at:-1}`)
- `backend/controllers/chirurgieController.js` — filtre de liste, création, populate, `DOSSIER_CHIR_BLOCKED_FIELDS`
- `backend/controllers/blocoperatoireController.js` — même modèle consulté depuis `/blocoperatoire` (création d'intervention depuis `patient_id` ou `dossier_id`, populate à 4 endroits)
- `frontend/src/pages/Chirurgie.jsx` et `frontend/src/pages/Blocoperatoire.jsx` — formulaires, affichage populate, navigation vers le dossier patient
- 10 fichiers de tests backend référencent `DossierChirurgical` + `patient_id`

Aucune autre relation (Pregnancy/Delivery/Newborn/Child/User) n'est traitée par ce ticket — normalisation incrémentale décidée avec l'utilisateur, module par module, `DossierChirurgical` choisi comme premier chantier.

## Pistes étudiées

1. **Ne rien faire** — documenter la convention comme assumée. Écarté pour ce module précis : l'utilisateur a explicitement demandé de démarrer la normalisation par `DossierChirurgical`.
2. **Tout renommer vers `patient_id`** (miner la convention majoritaire) — écarté, plus de travail que l'option 3 pour un résultat équivalent.
3. **Renommer `patient_id` → `patient`** (aligné sur la convention majoritaire, 11/18 modèles) — retenue, voir ADR-0006.

## Résolution

Voir `docs/decisions/ADR-0006-dossierchirurgical-patient-field-rename.md`.
