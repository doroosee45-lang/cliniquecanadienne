# Checklist de baseline — 10 rôles × 23 modules

**Statut :** Reconstruction, pas une récupération. Recherche exhaustive menée dans tout le dépôt (code, `docs/`, historique de conversation) : aucun document correspondant à « checklist de baseline §1.2 » n'existe sous quelque nom que ce soit. Elle n'a donc jamais été formalisée comme livrable distinct — les vérifications de Phase 1 et 2 se sont bien appuyées sur des tests ad hoc (matrice d'accès HTTP réelle sur 14 modules en Phase 2, UAT sur 10 profils en amont), pas sur cette référence stable. Ce document comble ce manque, à partir de l'état réel du code **post Phase 2**, pour servir de référence à partir de la Phase 3.

**Rôle patient :** exclu de cette matrice — son modèle d'accès (portail uniquement, `/portal/*`, données scopées à son propre dossier via `req.user.email` puis bientôt `patient_id`) est structurellement différent des 10 rôles professionnels et a été vérifié séparément (36/36 scénarios UAT, matrice d'accès confirmant qu'aucune route professionnelle ne lui est accessible).

## Méthode et niveau de preuve

- **Live-testé** : à l'origine 13 des 23 modules (`tests/accessMatrix.test.js`, Phase 2, contre un serveur démarré à la main — 154 combinaisons, 0 écart). **Rejeu Phase 10.1** (`tests/baselineChecklistPhase10.test.js`) : les 10 modules restants sont passés à Live via un serveur isolé démarré/arrêté automatiquement par le test lui-même (`tests/helpers/isolatedServer.js` — jamais le cluster Atlas partagé, jamais dépendant d'un `npm run dev` oublié), avec 11 comptes de test (10 rôles professionnels + patient, patient inclus délibérément sur les 23 modules pour vérifier son exclusion). Les 13 modules déjà Live ont été re-confirmés dans la même exécution — aucune régression. **23/23 modules sont donc désormais Live-testés.**
- **Vérifié statiquement** : obsolète — plus aucun module dans cet état depuis le rejeu Phase 10.1 (voir tableau de rejeu en fin de document).
- **Légende** : `OK` = accès conforme à la fonction du rôle (pas nécessairement accès total — un accès en lecture seule pour un rôle consultatif est un `OK`, pas un `Partiel`). `Partiel` = accès réel mais notablement restreint par rapport à un rôle voisin, ou fonctionnalité du **module** elle-même incomplète indépendamment du rôle. `KO` = aucun accès — **par conception**, pas une anomalie, sauf mention contraire explicite.

## Regroupement des 23 modules

Aucune liste de 23 modules préexistante n'a été retrouvée. Regroupement construit à partir des frontières réelles de contrôleurs/routes du code (ex. Chirurgie+Bloc opératoire partagent `DossierChirurgical` ; Urgences+Ambulances partagent `urgencesController.js`) :

Patients · Rendez-vous · Consultations · Prescriptions · Pharmacie · Hospitalisation · Chirurgie & Bloc opératoire · Urgences & Ambulances · Maternité · Pédiatrie · Laboratoire · Imagerie/Radiologie · Échographie · Finance & Facturation · Ressources Humaines · Messagerie · Notifications · Tableau de bord · Intelligence Artificielle · Analytics · Journal d'audit · Archivage · Administration & Paramètres

## Matrice

Colonnes : **SA**=superadmin **AC**=adminclinique **ME**=médecin **IN**=infirmier **SF**=sage-femme **LA**=laborantin **RA**=radiologue **PH**=pharmacien **CO**=comptable **RE**=réceptionniste

| Module | SA | AC | ME | IN | SF | LA | RA | PH | CO | RE | Preuve |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Patients | OK | OK | OK | OK | Partiel¹ | Partiel¹ | Partiel¹ | Partiel¹ | Partiel¹ | OK | Live |
| Rendez-vous | OK | OK | OK | OK | KO | KO | KO | KO | KO | OK | Live |
| Consultations | OK | Partiel² | OK | OK | KO | KO | KO | KO | KO | KO | Live |
| Prescriptions | OK | Partiel² | OK | OK | KO | KO | KO | Partiel³ | KO | KO | Live |
| Pharmacie | OK | OK | Partiel³ | Partiel³ | KO | KO | KO | OK | KO | KO | Live |
| Hospitalisation | OK | OK | OK | OK | KO | KO | KO | KO | KO | KO | Live |
| Chirurgie & Bloc opératoire | OK | OK | OK | Partiel⁴ | KO | KO | KO | KO | KO | KO | Live |
| Urgences & Ambulances | OK | OK | OK | OK | OK | KO | KO | KO | KO | KO | Live (10.1) |
| Maternité | OK | OK | OK | OK | OK | KO | KO | KO | KO | KO | Live (10.1) |
| Pédiatrie | OK | OK | OK | OK | OK | KO | KO | KO | KO | KO | Live (10.1) |
| Laboratoire | OK | Partiel² | Partiel³ | Partiel³ | KO | OK | KO | KO | KO | KO | Live |
| Imagerie / Radiologie | OK | Partiel² | Partiel³ | Partiel³ | KO | KO | OK | KO | KO | KO | Live |
| Échographie | OK | OK | OK | OK | OK | KO | OK | KO | KO | KO | Live (10.1) |
| Finance & Facturation | OK | OK | KO | KO | KO | KO | KO | KO | OK | KO | Live |
| Ressources Humaines | OK | OK | Partiel⁵ | Partiel⁵ | Partiel⁵ | Partiel⁵ | Partiel⁵ | Partiel⁵ | Partiel⁵ | Partiel⁵ | Live |
| Messagerie | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | Live (10.1)⁶ |
| Notifications | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | Live (10.1)⁶ |
| Tableau de bord | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | Live |
| Intelligence Artificielle | OK | OK | OK | Partiel⁷ | KO | KO | KO | KO | KO | KO | Live (10.1) |
| Analytics | OK | OK | KO | KO | KO | KO | KO | KO | KO | KO | Live (10.1) |
| Journal d'audit | OK | OK¹¹ | KO | KO | KO | KO | KO | KO | KO | KO | Live (10.1)¹¹ |
| Archivage | OK⁸ | OK⁸ | KO | KO | KO | KO | KO | KO | KO | KO | Live (10.1) |
| Administration & Paramètres | OK | Partiel⁹ | Partiel¹⁰ | Partiel¹⁰ | Partiel¹⁰ | Partiel¹⁰ | Partiel¹⁰ | Partiel¹⁰ | Partiel¹⁰ | Partiel¹⁰ | Live (10.1) |

## Notes

1. **Patients** — lecture accordée à tout le personnel soignant/administratif (nécessaire pour identifier un patient dans son propre module) ; seuls SA/AC/ME/IN/RE peuvent créer ou modifier un dossier. `sage_femme` a un accès lecture mais pas écriture directe sur `/patients` (elle agit via ses propres modules Maternité/Pédiatrie).
2. **Adminclinique lecture seule** — Consultations/Prescriptions/Laboratoire/Imagerie : accès de supervision, pas d'écriture clinique (cohérent, l'adminclinique n'est pas soignant).
3. **Lecture seule fonctionnelle** — médecin/infirmier sur Pharmacie (vérifier disponibilité), pharmacien sur Prescriptions (savoir quoi dispenser), médecin/infirmier sur Laboratoire/Imagerie (suivre un résultat sans le valider) : accès délibérément restreint à la lecture, pas une anomalie.
4. **Infirmier sur Chirurgie** — lecture complète + ajout de bilan (`/bilan`), mais pas de création/modification du dossier principal ni des complications. Conforme à « bloc opératoire : lecture/participation », déjà vérifié explicitement par test en Phase 2.
5. **RH — tous les rôles sauf SA/AC** — `Partiel` signifie ici : peut soumettre sa propre demande de congé (`POST /hr/:id/conge`), pas d'accès à l'annuaire ni aux fiches d'autres employés. Le workflow d'approbation lui-même est incomplet (ticket ouvert, non lié à ce document).
6. **Messagerie/Notifications** — accès non restreint par rôle au niveau route ; la portée réelle (on ne voit que ses propres conversations/notifications) est appliquée au niveau contrôleur, vérifiée par lecture de code en Phase 1 (`membres: req.user._id`, `destinataire: req.user._id`) mais pas re-testée en HTTP dans ce document.
7. **Infirmier sur IA** — seul droit : traiter une prédiction déjà générée (`PUT /predictions/:id`) ; pas d'accès au diagnostic ni à la vérification d'interactions.
8. **Archivage — `OK` d'accès, mais module limité** — SA/AC ont un accès complet à ce qui existe ; la fonctionnalité elle-même n'est qu'un index de recherche, pas un vrai cycle chaud/froid (cf. ticket de décision 0001 sur ce sujet, distinct de ce document). Distinction volontaire : le rôle a un accès `OK`, c'est le **module** qui est `Partiel` fonctionnellement — non mélangé dans cette matrice pour ne pas fausser la lecture par rôle.
9. **Adminclinique sur Administration** — accès à tout sauf la création/modification des comptes utilisateurs, réservée à `superadmin` seul.
10. **Tous les autres rôles sur Administration** — lecture des données de référence uniquement (services, chambres, assurances), nécessaires à leurs propres formulaires métier ; aucun droit de gestion.
11. **Adminclinique sur Journal d'audit — ÉCART EXPLIQUÉ, laissé en l'état par décision utilisateur (clôture Phase 10.1).** Cette ligne affirmait `OK` pour `adminclinique` sans qu'aucun test live n'ait jamais exercé ce module (absent de `accessMatrix.test.js`, Phase 2 — vérifié directement dans son code source). Le rejeu Phase 10.1 confirme que `audit.routes.js` restreint en réalité les 5 routes à `superadmin` seul.
   **Origine confirmée** (vérification demandée explicitement par l'utilisateur avant la fusion de la branche T10.1, pour écarter l'hypothèse d'une décision Phase 7 actée puis jamais appliquée au code) : recherche exhaustive dans l'historique git — aucune tâche nommée « T7.3 » n'existe. En revanche, commit `1b02505` (`fix(audit): restrict access to superadmin only (R-01b, P7.1 decision)`, 16/08/2026), message : *« App.jsx's route guard only ever allowed superadmin onto the Audit page, but audit.routes.js's ADMIN list also accepted adminclinique at the API level... Decision from the user: align the backend down to superadmin-only rather than opening the frontend up. »* — une décision utilisateur réelle et explicite, distincte de « T7.3 », référencée `R-01b`/« P7.1 decision » (étiquetage interne incohérent : le corps du commit dit « P7.1 », le nom de branche `feature/P7.4-audit-superadmin-only` dit « P7.4 » — aucun des deux n'est « T7.3 »).
   **Ce commit est postérieur à la rédaction de ce document** (`e4cb3d5`, 15/08/2026 18:35, antérieur de plusieurs heures à `1b02505`, 16/08/2026 08:25) : la cellule `OK` ci-dessus n'est donc pas une régression de code non appliquée, mais une affirmation du document jamais mise à jour après une décision ultérieure et délibérée. Décision utilisateur (clôture Phase 10.1) : laisser la cellule en l'état pour l'instant plutôt que de corriger le document maintenant — dette documentée, pas reperdue.

## Écarts trouvés en construisant cette matrice

**Aucun.** Chaque cellule a été vérifiée contre le code réel (routes + contrôleurs) au moment de la rédaction, pas recopiée depuis un souvenir de phase antérieure. Aucun cas d'accès manquant pour un rôle qui en aurait légitimement besoin, aucun cas d'accès accordé à un rôle qui ne devrait pas l'avoir.

## Utilisation prévue à partir de la Phase 3

Toute modification touchant `authorize(...)` sur une route déjà couverte ici doit être comparée à cette matrice avant fusion — un écart entre le comportement avant/après et une cellule `OK`/`Partiel`/`KO` de ce document est le signal d'une régression à documenter explicitement, pas à corriger silencieusement.

## Rejeu — Phase 3 (Sécurité et authentification)

Rejeu demandé par le brief Phase 3 pour vérifier si les tâches T3.1-T3.4 changent une cellule de cette matrice.

**Résultat : aucune cellule modifiée.** Aucune des quatre tâches ne touche `authorize(...)` ni la liste de rôles d'une route :

- **T3.1** (dossier Patient auto-créé à l'inscription Google) — crée un `Patient` et lie `patient_id`, mais ne change ni le rôle attribué (`role: 'patient'`, inchangé) ni les routes accessibles à ce rôle. Le rôle `patient` reste hors de cette matrice (portail uniquement), comme avant.
- **T3.2** (vérification officielle du token Google) — durcit la validation de l'authenticité/audience du token en amont de la création de session ; ne touche à aucune règle `authorize(...)`.
- **T3.3** (suppression du mot de passe temporaire en clair de la réponse JSON) — modification de la forme de la réponse HTTP d'un endpoint déjà `authorize('receptionniste', ...)`, sans changement des rôles autorisés.
- **T3.4** (verrouillage de compte, complexité du mot de passe) — ajoute un nouvel état (compte temporairement verrouillé, HTTP 423) qui s'applique **avant** toute vérification de rôle, donc de façon strictement transversale à tous les rôles de la matrice — pas un changement de qui a accès à quoi, mais une nouvelle condition de refus temporaire identique pour tous.

**Écart résiduel signalé (pas une cellule de cette matrice, car hors modèle rôle × module) :** §3.5(c) documente que `must_change_password` — un mécanisme de blocage de navigation, pas de contrôle d'accès — n'est jamais activé pour les comptes staff, contrairement au portail patient. Voir [ticket 0003](../tickets/0003-must-change-password-non-applique-comptes-staff.md) et [T3.5-verifications-complementaires.md](T3.5-verifications-complementaires.md).

### Niveau de preuve des 10 modules « Vérifié statiquement » — confirmation explicite

Question posée en clôture de Phase 3 : ce rejeu a-t-il fait passer l'un de ces 10 modules de « Vérifié statiquement » à « Live-testé » ? **Non, aucun.** Le rejeu Phase 3 est un raisonnement de code (« T3.1-T3.4 touchent-elles `authorize(...)` ? ») et ne consiste en aucun appel HTTP réel. Aucun des quatre modules techniquement concernés par T3.1-T3.4 (authentification) ne recoupe d'ailleurs ces 10 modules métier. État inchangé, module par module :

| Module | Preuve avant ce rejeu | Preuve après ce rejeu |
|---|---|---|
| Urgences & Ambulances | Statique | Statique — inchangé |
| Maternité | Statique | Statique — inchangé |
| Pédiatrie | Statique | Statique — inchangé |
| Échographie | Statique | Statique — inchangé |
| Messagerie | Statique⁶ | Statique⁶ — inchangé |
| Notifications | Statique⁶ | Statique⁶ — inchangé |
| Intelligence Artificielle | Statique | Statique — inchangé |
| Analytics | Statique | Statique — inchangé |
| Archivage | Statique | Statique — inchangé |
| Administration & Paramètres | Statique | Statique — inchangé |

Ces 10 modules restent une dette de preuve ouverte (mentionnée dès la version initiale de ce document : « à faire si une preuve live est requise ») — non traitée en Phase 3, dont le périmètre ne portait pas sur ces modules.

## Rejeu — Phase 10.1 (dette de preuve soldée, 23/23 modules Live)

Rejeu demandé explicitement en clôture de Phase 9 : « la Phase 10.1 va rejouer la même checklist de baseline, autant repartir sur une base propre ». Exécuté via `tests/baselineChecklistPhase10.test.js`, sur un serveur + MongoDB isolés démarrés et arrêtés automatiquement par le test (`tests/helpers/isolatedServer.js`) — jamais le cluster Atlas partagé, contrairement à `accessMatrix.test.js` qui dépend d'un serveur démarré manuellement.

**Résultat : 27/27 sous-tests passent.** Les 10 modules « Vérifié statiquement » passent tous à Live ; les 13 déjà Live sont re-confirmés sans régression ; un sous-test dédié confirme qu'aucun des 21 modules professionnels stricts (hors Messagerie/Notifications, note 6) n'est accessible au rôle `patient`.

**Deux écarts détectés en construisant la table de test, tous deux documentés plutôt que résolus silencieusement :**

1. **Messagerie/Notifications — faux positif, résolu.** Le brouillon initial du test excluait `patient` de l'accès autorisé sur ces deux modules, en écho au principe général « le rôle patient ne doit jamais accéder à un module professionnel ». Le test a échoué (`patient` obtient bien 200). Vérification : ce comportement est **documenté et voulu** (note 6, déjà présente dans ce document avant Phase 10.1) — la portée est appliquée au niveau contrôleur (`membres`/`destinataire: req.user._id`), pas au niveau route. Le test a été corrigé pour refléter ce comportement documenté ; aucun changement de code.
2. **Journal d'audit / adminclinique — écart réel, expliqué, laissé en l'état par décision utilisateur.** Voir note 11 ci-dessus : `audit.routes.js` ne restreint qu'à `superadmin`, contrairement à la cellule `OK` affirmée pour `adminclinique` depuis la version initiale de ce document. Vérification demandée avant la fusion de la branche T10.1 (« T7.3 avait-il déjà tranché cette question sans que ce soit appliqué au code ? ») : aucune tâche « T7.3 » ne référence ce sujet, mais le commit `1b02505` (16/08/2026, `R-01b`/« P7.1 decision ») documente une décision utilisateur réelle et antérieure à ce jour de restreindre délibérément l'accès à `superadmin` seul — postérieure à la rédaction de ce document (15/08/2026), qui n'a simplement jamais été mis à jour depuis. Décision de clôture Phase 10.1 : cellule laissée en l'état pour l'instant (ni code ni document modifiés au-delà de cette note), dette documentée plutôt que reperdue.

**Constat complémentaire (hors modèle rôle × module, pas une cellule de cette matrice) :** aucun couplage applicatif réel n'existe entre Urgences et Hospitalisation malgré `Urgence.decision`/`Urgence.statut` suggérant le contraire — voir [ticket 0018](../tickets/0018-urgences-hospitalisation-no-coupling.md) et le test de verrouillage `tests/crossModuleUrgencesHospitalisationIsolationT101.test.js`.
