# Ticket 0023 — Routes backend fonctionnelles mais sans appelant frontend identifié (CODE-003)

**Statut :** Fermé sans suppression — chaque route vérifiée individuellement, toutes fonctionnelles et réellement testées, aucune supprimée par précaution (voir règle absolue de l'instruction : ne jamais supprimer une route sur la seule base de l'absence d'appelant frontend trouvé).
**Origine :** Audit indépendant du 6 sept. 2026 (CODE-003), Phase 9
**Sévérité :** Faible — aucune de ces routes n'est atteinte par un utilisateur réel aujourd'hui, mais aucune n'est cassée ni dangereuse non plus.

## Méthode

Pour chacune des routes signalées : recherche exhaustive de tout appelant frontend (`grep` sur le chemin exact dans `frontend/src/`), recherche de tout test backend qui l'exerce, vérification qu'il ne s'agit pas d'une API volontairement construite en avance d'une UI (ticket déjà existant).

## Constats, un par un

### 1. `PUT /ai/predictions/:id` (`ai.routes.js:12`, `aiC.updatePrediction`)
Aucun appel frontend trouvé (`aiSlice.js` n'utilise que `GET /ai/predictions`). Testée réellement (`auditA8AICoverage.test.js`, `auditBeforeAfterT93Group2.test.js`). Fonction backend complète et valide, jamais câblée à un bouton d'édition de prédiction côté `AI.jsx`. **Conservée** — construire ce bouton dépasserait le périmètre d'un audit de code mort.

### 2. `document.routes.js` (3 routes : `GET /`, `POST /`, `GET /:id`)
Déjà documenté et tranché explicitement — voir **ticket 0006** : décision utilisateur du 2026-08-16, périmètre backend volontairement minimal construit en avance d'une UI, aucune action supplémentaire ici.

### 3. `PUT /pediatrie/consultations/:id` (`pediatrie.routes.js:22`, `c.updateConsultation`)
Aucun appel frontend trouvé (`pediatrieSlice.js` n'utilise que `GET`/`POST /pediatrie/consultations`). Testée réellement (3 fichiers : `auditBeforeAfterT93Group2.test.js`, `auditP2-1MassAssignmentClinical.test.js`, `auditTrailCoverage.test.js`). **Conservée** — même raisonnement que le point 1 : fonctionnalité d'édition jamais construite côté `Pediatrie.jsx`, pas un oubli à corriger dans ce ticket.

### 4. Alias `/pharmacy/medicaments` (`GET`/`POST`, `pharmacy.routes.js:13-14`)
Pointent vers exactement les **mêmes fonctions contrôleur** que la route de base (`GET`/`POST /pharmacy`, ligne 32-33) — une duplication de routage à 100%, pas une fonctionnalité distincte. `pharmacySlice.js` n'utilise que la route de base. Commentaire du code (« Alias français ») indique une intention délibérée de bilinguisme d'API, pas un oubli. **Conservé tel quel** — même s'il s'agit du candidat le plus net à une suppression réelle (aucune logique unique, juste un routage dupliqué), la règle absolue de cette instruction est de ne jamais supprimer sur la seule base de l'absence d'appelant frontend ; un alias explicitement nommé comme tel peut viser un consommateur externe (script, future app mobile, collection Postman) non visible depuis ce dépôt.

### 5. `PUT /:id/rapport` (`radiology.routes.js:17`, `radioC.rapport`)
Aucun appel frontend trouvé — `Radiology.jsx` utilise exclusivement `PUT .../cr` puis `PUT .../validation` pour le flux compte-rendu → validation. Testée réellement (`t93UntestedAvantApres.test.js`). Probable ancienne étape du workflow, remplacée sans être retirée. **Conservée** — fonction toujours valide et testée, aucune preuve qu'elle soit réellement obsolète plutôt que simplement non utilisée par le flux actuel.

### 6. `DELETE /settings/users/:id` (désactivation utilisateur)
Traité séparément — voir **ticket 0024** (CODE-004), qui couvre spécifiquement la duplication réelle trouvée entre ce mécanisme et `PUT /settings/users/:id`.

## Décision

Aucun fichier de route modifié. Chaque route reste en place, fonctionnelle et testée. Ce ticket sert de point de référence si l'une de ces fonctionnalités est un jour réellement construite côté UI — à ce moment, revérifier que le comportement backend documenté ici correspond toujours au besoin réel avant de le réutiliser tel quel.
