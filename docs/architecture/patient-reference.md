# Patient — référentiel central — MediSync

**Statut :** Référence vivante (Phase 1). Ce document rassemble, à partir de `relationships.md` et `entities.md`, tout ce qui concerne le principe « Patient = source unique de vérité » posé par le plan directeur, et vérifie dans quelle mesure le code réel le respecte aujourd'hui.

## 1. Le principe

`Patient` (`backend/models/Patient.js`) porte les données démographiques et administratives d'un individu (identité, date de naissance, sexe, groupe sanguin, allergies, antécédents, assurances, médecin référent). Aucun autre module ne doit dupliquer ces champs comme **source faisant autorité** — un autre module peut les recopier pour affichage, mais `Patient` reste la référence en cas de divergence.

Confirmé par le code : `Patient` ne déclare **aucun champ `ObjectId`/`ref` sortant** vers un autre module (vérifié exhaustivement, voir `relationships.md`). C'est structurellement la feuille racine du graphe de références — jamais un consommateur d'un autre module.

## 2. Qui référence Patient (relation entrante réelle)

17 modèles référencent `Patient` par `ObjectId` : Appointment, Consultation, Prescription, LabResult, ImagingResult, Echographie (`patient_ref`), Urgence, Hospitalization, DossierChirurgical, Pregnancy, Delivery, Newborn, Child, Document, ArchiveEntry, Invoice, AIPrediction — plus `Room.lits[].patient_actuel` et `User.patient_id` (comptes portail). Détail complet dans `relationships.md`.

## 3. Le champ Patient est presque toujours optionnel — et c'est un choix assumé

Sur la majorité de ces modèles (`Urgence`, `Echographie`, `Pregnancy`, `Delivery`, `Newborn`, `Child`, `Document`, `ArchiveEntry`, `Invoice`, `AIPrediction`), la référence à `Patient` est **optionnelle**, avec un champ texte libre en repli (`patient_nom`, `patient_dossier`, `patient_dob`...). Ce n'est pas un défaut de modélisation : ça permet de saisir un cas réel (urgence avec identité inconnue à l'admission, facture sans dossier structuré, échographie prescrite en externe) sans bloquer le personnel en attendant la création d'un dossier `Patient` complet.

**Conséquence pour tout nouveau code** : ne jamais supposer que `patient` est renseigné sur ces modèles. Toujours lire le champ texte libre correspondant en repli (`patient_nom` etc.) plutôt que de faire planter une jointure sur `null`. C'est déjà le pattern systématique observé dans les contrôleurs existants (`normalize()` dans `urgencesController.js`, `normalizeHosp()`/`normalizeUrgence()` côté frontend).

Seuls `Appointment`, `Consultation`, `Prescription`, `LabResult`, `ImagingResult`, `Hospitalization` et `DossierChirurgical` (`patient_id`) déclarent `patient` **requis** — les modules où un dossier `Patient` structuré est une précondition métier réelle (on ne prend pas un RDV, ne consulte pas, ne prescrit pas, n'hospitalise pas, n'ouvre pas un dossier chirurgical pour un patient totalement anonyme).

## 4. Duplication de champs démographiques — état réel

Des champs comme `patient_nom`, `patient_dossier`, `patient_dob`, `patient_sexe`, `patient_tel` existent sur plusieurs modèles (`Urgence`, `DossierChirurgical`, `ImagingResult`, `LabResult`, `Echographie`, `Invoice`...). Ce ne sont **pas des sources de vérité concurrentes** : ce sont des caches d'affichage, alimentés à la création (souvent recopiés depuis `Patient` s'il existe, ou saisis directement sinon) pour éviter un `populate()` systématique sur des listes et pour rester utilisables quand aucun `Patient` n'est lié. Quand `patient`/`patient_id`/`patient_ref` est renseigné, c'est **toujours lui** qui fait autorité (voir `normalize()`/`normalizeHosp()` : le nom recalculé depuis le patient peuplé écrase le texte libre à l'affichage).

**Règle à respecter pour la suite du projet** : si un jour un champ démographique doit être corrigé en masse (ex. correction d'un nom), la correction se fait sur `Patient` uniquement — les champs texte libre des autres modules ne sont que des instantanés au moment de la saisie et ne doivent jamais être réécrits en masse pour « corriger » une donnée patient.

## 5. Écarts qui touchent indirectement ce principe

Aucun écart trouvé qui viole le principe lui-même (aucun module ne fait autorité sur une donnée démographique à la place de `Patient`). Les écarts documentés ailleurs (`Echographie`↔Consultation, `DossierChirurgical`↔Hospitalization, `ArchiveEntry` polymorphe) concernent des relations **intermodules**, pas la primauté de `Patient` — Patient reste correctement la seule source pour tout ce qui est démographique dans les 37 modèles revus.

## 6. Règle pour l'Agent IA et l'équipe (rappel du plan directeur)

- Ne jamais ajouter un champ démographique dupliqué comme source faisant autorité sur un autre modèle — un champ texte libre en repli est acceptable, une seconde source de vérité ne l'est pas.
- Avant de modifier `Patient.js`, évaluer l'impact sur les 17 modèles qui le référencent (liste en §2) — jamais une modification isolée sans cette vérification.
- Pour toute nouvelle relation vers `Patient`, préférer une référence optionnelle avec repli texte libre si le module doit rester utilisable sans dossier structuré (aligné sur l'existant), une référence requise seulement si c'est une vraie précondition métier (comme Appointment/Consultation/Prescription/LabResult/ImagingResult/Hospitalization).
