# Ticket 0013 — infirmier a un droit PUT sans droit GET sur les prédictions IA, action actuellement inutilisée par tous les rôles

**Statut :** Fermé sans correction — impact actuel nul, dette technique documentée. À rouvrir si un workflow de traitement des prédictions IA est ajouté à l'interface.
**Origine :** Audit de code frais (AUDIT-06), Phase 9
**Sévérité :** Faible — aucun rôle n'exerce cette route aujourd'hui

## Constat

`backend/routes/ai.routes.js` :

```js
const roles = ['superadmin', 'adminclinique', 'medecin'];
router.get('/predictions',     authorize(...roles),              aiC.getPredictions);
router.put('/predictions/:id', authorize(...roles, 'infirmier'), aiC.updatePrediction);
```

`infirmier` peut appeler `PUT /predictions/:id` (marquer une prédiction IA comme traitée/ignorée — `ai.controller.js::updatePrediction`) sans pouvoir lister les prédictions (`GET /predictions`). Constat technique réel, confirmé sur le code actuel.

## Analyse du workflow réel

- `frontend/src/App.jsx` — la page `/ai` est gardée par `ROLES.medecin = ['superadmin','medecin']` : `infirmier` n'y a de toute façon aucun accès.
- `frontend/src/store/slices/aiSlice.js` — seul appel API sur les prédictions : `GET /ai/predictions` (liste).
- Recherche exhaustive dans le frontend : **aucun appel `PUT /ai/predictions/:id` nulle part**, pour aucun rôle.

**`updatePrediction` n'est utilisé par personne**, pas seulement par `infirmier`. `AI.jsx` affiche la liste des prédictions mais ne propose aucune action pour les faire évoluer, même pour les rôles qui ont l'accès complet (superadmin/adminclinique/medecin).

## Décision (utilisateur, Phase 9)

Le problème n'est pas une permission spécifiquement inutilisable pour `infirmier` — c'est une action backend qu'aucun rôle n'exerce actuellement depuis l'interface. Ne pas modifier `authorize()`, ne pas ajouter de bouton « Traiter »/« Marquer comme traité » (créerait une fonctionnalité non demandée par cet audit). Aucun fichier modifié.

## Objectif futur, si repris

À rouvrir explicitement si une action de traitement des prédictions IA (accusé de réception, marquage traité/ignoré) est ajoutée à `AI.jsx`. Les rôles `authorize()` de `PUT /predictions/:id` — y compris la question de savoir si `infirmier` doit ou non y avoir accès — devront être décidés à partir de ce workflow réel, pas repris tels quels de l'état actuel.
