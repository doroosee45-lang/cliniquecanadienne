# Patient — référentiel central — MediSync

**Statut :** Référence vivante (Phase 1, mise à jour DATA-003 le 6 sept. 2026). Ce document rassemble, à partir de `relationships.md` et `entities.md`, tout ce qui concerne le principe « Patient = source unique de vérité » posé par le plan directeur, et vérifie dans quelle mesure le code réel le respecte aujourd'hui.

## 1. Le principe

`Patient` (`backend/models/Patient.js`) porte les données démographiques et administratives d'un individu (identité, date de naissance, sexe, groupe sanguin, allergies, antécédents, assurances, médecin référent). Aucun autre module ne doit dupliquer ces champs comme **source faisant autorité** — un autre module peut les recopier pour affichage, mais `Patient` reste la référence en cas de divergence.

Confirmé par le code : `Patient` ne déclare **aucun champ `ObjectId`/`ref` sortant** vers un autre module (vérifié exhaustivement, voir `relationships.md`). C'est structurellement la feuille racine du graphe de références — jamais un consommateur d'un autre module.

## 2. Qui référence Patient, et sous quel nom (3 conventions réelles)

**Revérifié exhaustivement le 6 sept. 2026** (DATA-003) sur les 49 fichiers de `backend/models/*.js` réels — pas recopié depuis un audit antérieur. **19 modèles** référencent `Patient` par un vrai champ `ObjectId`/`ref`, sous **3 noms de champ différents** :

| Convention | Modèles (19 au total) | Remarque |
|---|---|---|
| **`patient`** (13 modèles — majoritaire, convention cible) | AIPrediction, Appointment, ArchiveEntry, Consultation, Document, **DossierChirurgical**, **Echographie**, Hospitalization, ImagingResult, Invoice, LabResult, Prescription, Urgence | DossierChirurgical et Echographie ont chacun été renommés depuis une autre convention (voir ci-dessous) — la normalisation vers `patient` est un chantier déjà en cours, module par module, pas une intention non suivie d'effet. |
| **`patient_id`** (5 modèles) | Child, Delivery, Newborn, Pregnancy, User | Pas encore migrés vers `patient` — candidats naturels pour une prochaine étape du même chantier incrémental (voir §7), sur le modèle d'ADR-0006. |
| **`patient_actuel`** (1 modèle) | Room (`lits[].patient_actuel`) | **Pas une incohérence de nommage à corriger** : ce champ représente une occupation transitoire et mutable (quel patient occupe ce lit *en ce moment*), pas une relation d'appartenance/de propriété comme les 18 autres — un nom différent est ici sémantiquement justifié, pas un oubli. |

**`patient_ref` n'existe plus dans le code actuel.** Cette 3ᵉ convention historique (citée par l'audit initial et par ADR-0006 comme l'une des 3 conventions d'origine) a été éliminée : `Echographie.patient_ref` a été renommé en `patient` (commentaire de code « Correction 13, DATA-001 ») — le libellé texte associé est conservé séparément sous `patient_nom`, jamais perdu. Vérifié : aucune occurrence de `patient_ref` comme nom de champ réel dans `backend/models/*.js` au 6 sept. 2026 (seules 3 lignes de commentaire dans `Echographie.js` en gardent la trace historique).

Écart avec le chiffre « 43 modèles » cité par l'audit initial : non reproductible sur l'état actuel du code (49 fichiers modèles au total, 19 avec une vraie référence `ObjectId` vers Patient). Le chiffre de l'audit portait peut-être sur un état antérieur du code, une définition plus large de « référence » (incluant des liens texte libre), ou une erreur de comptage — non tranché ici, la donnée qui compte pour ce document est l'état réel vérifié.

## 3. Le champ Patient est presque toujours optionnel — et c'est un choix assumé

Sur la majorité de ces modèles (`Urgence`, `Pregnancy`, `Delivery`, `Newborn`, `Child`, `Document`, `ArchiveEntry`, `Invoice`, `AIPrediction`), la référence à `Patient` est **optionnelle**, avec un champ texte libre en repli (`patient_nom`, `patient_dossier`, `patient_dob`...). Ce n'est pas un défaut de modélisation : ça permet de saisir un cas réel (urgence avec identité inconnue à l'admission, facture sans dossier structuré) sans bloquer le personnel en attendant la création d'un dossier `Patient` complet.

**Conséquence pour tout nouveau code** : ne jamais supposer que `patient` est renseigné sur ces modèles. Toujours lire le champ texte libre correspondant en repli (`patient_nom` etc.) plutôt que de faire planter une jointure sur `null`. C'est déjà le pattern systématique observé dans les contrôleurs existants (`normalize()` dans `urgencesController.js`, `normalizeHosp()`/`normalizeUrgence()` côté frontend).

Seuls `Appointment`, `Consultation`, `Prescription`, `LabResult`, `ImagingResult`, `Hospitalization`, `DossierChirurgical` et **`Echographie`** déclarent `patient` **requis** (`required: true` vérifié dans le schéma) — les modules où un dossier `Patient` structuré est une précondition métier réelle (on ne prend pas un RDV, ne consulte pas, ne prescrit pas, n'hospitalise pas, n'ouvre pas un dossier chirurgical, ne réalise pas une échographie pour un patient totalement anonyme).

## 4. Duplication de champs démographiques — état réel

Des champs comme `patient_nom`, `patient_dossier`, `patient_dob`, `patient_sexe`, `patient_tel` existent sur plusieurs modèles (`Urgence`, `DossierChirurgical`, `ImagingResult`, `LabResult`, `Echographie`, `Invoice`...). Ce ne sont **pas des sources de vérité concurrentes** : ce sont des caches d'affichage, alimentés à la création (souvent recopiés depuis `Patient` s'il existe, ou saisis directement sinon) pour éviter un `populate()` systématique sur des listes et pour rester utilisables quand aucun `Patient` n'est lié. Quand `patient`/`patient_id` (selon le modèle — voir §2) est renseigné, c'est **toujours lui** qui fait autorité (voir `normalize()`/`normalizeHosp()` : le nom recalculé depuis le patient peuplé écrase le texte libre à l'affichage).

**Règle à respecter pour la suite du projet** : si un jour un champ démographique doit être corrigé en masse (ex. correction d'un nom), la correction se fait sur `Patient` uniquement — les champs texte libre des autres modules ne sont que des instantanés au moment de la saisie et ne doivent jamais être réécrits en masse pour « corriger » une donnée patient.

## 5. Écarts qui touchent indirectement ce principe

Aucun écart trouvé qui viole le principe lui-même (aucun module ne fait autorité sur une donnée démographique à la place de `Patient`). Les écarts documentés ailleurs (`Echographie`↔Consultation, `DossierChirurgical`↔Hospitalization, `ArchiveEntry` polymorphe) concernent des relations **intermodules**, pas la primauté de `Patient` — Patient reste correctement la seule source pour tout ce qui est démographique parmi les 19 modèles qui le référencent (§2). Note : le nombre total de fichiers modèles est passé à 49 depuis la revue exhaustive « 37 modèles » de Phase 1 (nouveaux modules ajoutés depuis) — seuls les 19 référençant `Patient` ont été revérifiés pour ce document (DATA-003), pas l'intégralité des 49.

## 6. Règle pour l'Agent IA et l'équipe (rappel du plan directeur)

- Ne jamais ajouter un champ démographique dupliqué comme source faisant autorité sur un autre modèle — un champ texte libre en repli est acceptable, une seconde source de vérité ne l'est pas.
- Avant de modifier `Patient.js`, évaluer l'impact sur les 19 modèles qui le référencent (liste en §2) — jamais une modification isolée sans cette vérification.
- Pour toute nouvelle relation vers `Patient`, utiliser le nom de champ `patient` (la convention cible, déjà majoritaire — voir §2), et préférer une référence optionnelle avec repli texte libre si le module doit rester utilisable sans dossier structuré (aligné sur l'existant), une référence requise seulement si c'est une vraie précondition métier (comme Appointment/Consultation/Prescription/LabResult/ImagingResult/Hospitalization/DossierChirurgical/Echographie).
- Ne jamais introduire un nouveau champ `patient_id` ou toute autre variante — cela ajouterait une 4ᵉ convention à un problème déjà identifié, pas une correction.

## 7. Chantier de normalisation en cours (incrémental, module par module)

Décision déjà actée (voir ADR-0006) : normaliser les 5 modèles restants en `patient_id` (Child, Delivery, Newborn, Pregnancy, User) vers `patient`, **un module à la fois**, jamais en un seul chantier — pour limiter le risque à chaque étape (migration des documents existants, mise à jour des contrôleurs/frontend/tests concernés). DossierChirurgical (ADR-0006) et Echographie (Correction 13/DATA-001) ont déjà été traités selon ce modèle ; il en reste 5.

**Point d'attention pour la prochaine étape** : `User.patient_id` est le plus sensible des 5 (lié à l'authentification des comptes portail patient — contrairement aux 4 autres, un renommage y touche potentiellement un chemin de connexion réel) ; à traiter en dernier et avec une vérification manuelle du parcours de connexion patient avant tout déploiement, cohérent avec le choix déjà fait d'avoir démarré par `DossierChirurgical` (le module le moins sensible) plutôt que par `User`.

Cette Sous-phase (DATA-003) ne renomme volontairement aucun des 5 champs restants — le risque d'un renommage large sur un projet déjà stabilisé, pour un bénéfice cosmétique, a été jugé disproportionné pour cette instruction. Ce document sert de point de référence pour la ou les prochaines étapes du chantier déjà engagé.
