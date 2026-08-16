# Ticket 0014 — notifications.controller.js::markRead inutilisé par le frontend

**Statut :** Fermé sans correction — impact actuel nul, dette technique documentée. À rouvrir lorsqu'une interaction de lecture individuelle sera réellement exposée dans l'interface.
**Origine :** Audit de code frais (AUDIT-07), Phase 9
**Sévérité :** Faible — aucun clic n'atteint cette route aujourd'hui

## Constat

`markRead` existe côté backend (`PUT /notifications/:id/read`, `notifications.controller.js`) mais aucun workflow frontend actuel ne l'appelle. Aucun impact observable actuellement.

Vérifié : `frontend/src/components/Layout/Header.jsx` rend chaque notification avec `cursor-pointer` mais sans `onClick` — cliquer sur une notification individuelle ne déclenche rien, ni navigation ni marquage de lecture. Seul `markAllRead` (« tout marquer comme lu ») est utilisé.

## Décision (utilisateur, Phase 9)

Même traitement qu'AUDIT-05 et AUDIT-06 : capacité backend réelle, zéro branchement frontend, zéro impact actuel. Aucun code modifié.

## Objectif futur, si repris

À rouvrir lorsqu'une interaction de lecture individuelle (clic sur une notification pour la marquer lue, éventuellement combiné à une navigation vers son `lien`) sera réellement exposée dans l'interface.
