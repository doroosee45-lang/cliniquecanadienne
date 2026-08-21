# ADR-0006 — Renommage `DossierChirurgical.patient_id` → `patient`

**Statut :** Acceptée et implémentée (2026-08-21).
**Contexte :** Plan directeur MediSync (26 phases), Phase 2 — Patient comme référentiel unique, premier chantier de normalisation incrémentale.
**Lié à :** Ticket 0021.

## Contexte

La Phase 1 (cartographie) a confirmé que 18 des 37 modèles référencent `Patient`, sous 3 noms de champ différents (`patient`, `patient_id`, `patient_ref`) — voir `docs/architecture/patient-reference.md`. La Phase 2 vise à normaliser cette incohérence, **module par module**, pour limiter le risque à chaque étape plutôt que de traiter les 18 modèles en un seul chantier. `DossierChirurgical` a été choisi comme premier module (décision utilisateur explicite) : il n'est ni auth-sensible (contrairement à `User.patient_id`) ni engagé dans une chaîne de modèles interdépendants (contrairement à Pregnancy→Delivery→Newborn).

## Problème

`DossierChirurgical.patient_id` suit la convention minoritaire (6/18 modèles) au lieu de la convention majoritaire `patient` (11/18 modèles). Fonctionnellement correct, mais un frein à tout code transverse (ex. agrégations analytics, recherche patient croisant plusieurs modules) qui doit connaître le nom de champ exact par modèle.

## Options étudiées

1. **Ne rien faire** — écarté, l'utilisateur a explicitement choisi ce module pour démarrer la Phase 2.
2. **Ajouter `patient` comme alias en plus de `patient_id`** (double champ, synchronisé) — écarté : introduit une seconde source de vérité pour la même relation, contraire au principe déjà posé dans `patient-reference.md` §6 ("jamais une seconde source de vérité").
3. **Renommer `patient_id` → `patient`, avec migration des documents existants** — retenue.

## Décision

Renommer le champ dans le schéma, migrer les documents existants (dev + Atlas) par un script idempotent (`$rename`, sur le modèle de `backend/utils/migrate-link-patient-id.js`), et mettre à jour tout le code qui lit/écrit ce champ en une seule fois (pas de période de compatibilité double-champ, jugée inutile pour un module non exposé au portail patient et à faible volume de documents).

### Portée exacte du changement

- `backend/models/DossierChirurgical.js` — `patient_id` → `patient` (déclaration + index composé).
- `backend/controllers/chirurgieController.js` — filtre de liste, création, populate, `DOSSIER_CHIR_BLOCKED_FIELDS`.
- `backend/controllers/blocoperatoireController.js` — création d'intervention, populate (4 occurrences) — même modèle, contrôleur distinct.
- `frontend/src/pages/Chirurgie.jsx` et `frontend/src/pages/Blocoperatoire.jsx` — formulaires, affichage, navigation.
- 10 fichiers de tests backend référençant `DossierChirurgical.patient_id`.
- Script de migration ponctuel : `backend/utils/migrate-rename-dossierchirurgical-patient.js` (idempotent, non destructif — ne fait que renommer un champ existant, ne supprime aucune donnée).

### Ce qui ne change pas

- Aucun autre modèle (`Pregnancy`, `Delivery`, `Newborn`, `Child`, `User`, `Echographie`) n'est touché par cette décision — chacun fera l'objet de sa propre mini-ADR quand son tour viendra.
- `Complication`/`Bilan`/`SuiviPostop` référencent `DossierChirurgical` par `dossier_chirurgical_id` — champ distinct, hors périmètre.
- Aucun changement de comportement métier : le champ reste requis, indexé, avec la même relation vers `Patient`.

## Conséquences

- Documents `DossierChirurgical` déjà persistés (dev + Atlas) migrés via script ponctuel avant tout déploiement du nouveau code.
- Les 10 tests backend concernés mis à jour pour utiliser `patient` au lieu de `patient_id`.
- Vérification manuelle des pages Chirurgie et Bloc opératoire dans un navigateur réel avant commit (formulaire de création, liste, populate, navigation vers le dossier patient).
