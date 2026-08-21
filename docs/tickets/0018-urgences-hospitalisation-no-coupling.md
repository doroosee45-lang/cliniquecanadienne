# Ticket 0018 — Aucun couplage réel entre Urgences et Hospitalisation malgré `Urgence.decision`

**Statut :** Résolu — supersédé par ADR-0005 (2026-08-21, même jour)
**Origine :** Phase 10.1, tests de non-régression croisés entre modules interdépendants (Urgences↔Hospitalisation attendu)
**Sévérité :** Faible/informative — pas un bug (rien ne casse), mais un écart entre ce que le schéma suggère et ce que le code fait réellement

## Constat

`backend/models/Urgence.js` déclare un champ `decision` (`enum: ['retour_domicile','hospitalisation','transfert','deces','']`) et un `statut` incluant la valeur `'hospitalise'`. Ces valeurs suggèrent qu'une décision d'hospitalisation prise depuis les urgences devrait produire — ou au moins référencer — un dossier `Hospitalization`.

En réalité, **aucun couplage n'existe** :

- `backend/models/Hospitalization.js` n'a pas de champ référençant `Urgence` (pas de `urgence_id` ou équivalent).
- `backend/controllers/urgencesController.js` ne `require`-t jamais `Hospitalization` — définir `decision:'hospitalisation'` ou `statut:'hospitalise'` sur une `Urgence` n'a aucun effet en dehors de l'`Urgence` elle-même.
- `backend/controllers/hospitalization.controller.js` ne `require`-t jamais `Urgence` — `create()` (`POST /hospitalization`) n'accepte que `patient`, `motif_entree`, `chambre`, etc., sans lien vers un éventuel passage aux urgences.

Ce sont donc actuellement deux modules indépendants qui partagent uniquement une référence à `Patient`, sans passerelle applicative entre eux. Un personnel qui admet un patient depuis les urgences doit re-saisir manuellement un dossier d'hospitalisation séparé, sans traçabilité du parcours Urgences→Hospitalisation.

## Ce qui a été vérifié

- Recherche exhaustive de références croisées entre les deux fichiers de contrôleurs et les deux modèles : aucune occurrence.
- Confirmé par lecture directe de `Urgence.decision`/`Urgence.statut` : ce sont de simples valeurs déclaratives, jamais lues pour déclencher une action.
- `backend/tests/crossModuleUrgencesHospitalisationIsolationT101.test.js` (nouveau, Phase 10.1) verrouille cette absence de couplage : crée une `Urgence` avec `decision:'hospitalisation'` et `statut:'hospitalise'`, confirme qu'aucun document `Hospitalization` n'est créé en conséquence — pour qu'une future automatisation accidentelle ou une régression soit détectée si ce comportement change sans décision explicite.
- Non corrigé ici : `urgencesController.js` est le travail actif de l'utilisateur, hors périmètre de cet audit.

## Pistes pour décision future (à trancher avec l'utilisateur avant d'y toucher)

1. **Ne rien faire** — les deux modules restent volontairement indépendants ; la re-saisie manuelle est acceptée comme processus métier actuel.
2. **Ajouter un champ de référence** (`Hospitalization.urgence_id`, optionnel) sans automatisme — permettrait de tracer manuellement le lien a posteriori sans changer le flux de saisie.
3. **Automatiser** : quand `Urgence.decision` passe à `'hospitalisation'`, proposer (pas forcer) la création d'un dossier `Hospitalization` pré-rempli avec les données déjà saisies aux urgences — réduirait la ressaisie, mais touche `urgencesController.js`, donc hors périmètre tant que l'utilisateur ne le débloque pas explicitement.

Aucune option n'est mise en œuvre ici — ce ticket documente l'écart pour décision, conformément au protocole établi pour ce type de constat (cf. tickets 0016, 0017).

## Résolution (historique — voir mise à jour ci-dessous)

Option 2 retenue une première fois (référence optionnelle, sans automatisme). Une proposition plus lourde (entité `Encounter` centrale) avait été envisagée puis écartée au profit de cette option, plus proportionnée au besoin exprimé (traçabilité a posteriori, pas de refonte du parcours de saisie).

Implémenté :
- `backend/models/Hospitalization.js` — nouveau champ `urgence_id` (`ObjectId`, `ref: 'Urgence'`, optionnel).
- `backend/controllers/hospitalization.controller.js::create` — accepte `req.body.urgence_id` si fourni, vérifie l'existence du dossier urgences référencé (400 explicite sinon), ne l'exige jamais.
- `backend/controllers/hospitalization.controller.js::update` — `urgence_id` n'est pas dans `HOSP_BLOCKED_FIELDS` : peut être renseigné a posteriori via l'édition générique, conformément à l'objectif de traçabilité différée de l'option 2.
- Aucune automatisation : `urgencesController.js` n'est pas modifié, une décision `Urgence.decision:'hospitalisation'` ne crée toujours rien automatiquement — le lien reste une saisie manuelle volontaire.
- Aucun changement du formulaire frontend d'admission n'a été fait (le champ est utilisable via l'API dès maintenant ; l'exposer dans l'UI de saisie reste une évolution frontend séparée, non traitée ici).

## Mise à jour — supersédé par ADR-0005 (même jour)

Le plan directeur MediSync (Phase 4, priorité critique) a explicitement demandé le workflow complet plutôt que l'option 2 ci-dessus. **Voir `docs/decisions/ADR-0005-urgences-hospitalisation-workflow.md`** pour la décision actuelle, qui conserve `urgence_id` (option 2) comme référence structurelle mais ajoute :
- `Urgence.admission_status` (suivi d'état : `non_requise/preparation/terminee/annulee`), géré automatiquement par `urgencesController.js::update` selon `decision` — toujours aucune création automatique d'hospitalisation.
- Protection contre la double admission (`hospitalization.controller.js::create` refuse une seconde hospitalisation active pour le même `urgence_id`).

`urgencesController.js` reste modifié uniquement pour la gestion de `admission_status` (transition d'état), jamais pour créer ou référencer `Hospitalization` directement — le couplage applicatif fort entre les deux modules reste évité, conformément à la limite déjà posée dans ce ticket.
