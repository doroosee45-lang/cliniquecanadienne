# Ticket 0024 — Incohérence email/notification sur désactivation de compte utilisateur (CODE-004)

**Statut :** Corrigé.
**Origine :** Audit indépendant du 6 sept. 2026 (CODE-004), Phase 9.
**Sévérité :** Moyenne — aucune donnée corrompue, mais un utilisateur réellement désactivé via le seul chemin atteignable par l'UI n'était jamais informé, et l'autre chemin envoyait un email au libellé factuellement faux.

## Constat

Deux mécanismes distincts peuvent placer `User.statut = 'inactif'` :

1. **`PUT /settings/users/:id` → `settingsC.updateUser`** — seul chemin réellement atteint par l'UI, via le menu déroulant « Statut » du formulaire d'édition dans `Administration.jsx`. Sa logique de notification ne traitait comme cas particulier que la transition vers `'suspendu'` (notification `warning` + `sendAccountSuspendedEmail`) ; une transition vers `'inactif'` ne déclenchait qu'une notification `'info'` générique et **aucun email**.
2. **`DELETE /settings/users/:id` → `settingsC.deactivateUser`** — route orpheline, sans appelant frontend identifié (voir ticket 0023, point 6). Fixe `statut = 'inactif'` et appelait à tort `sendAccountSuspendedEmail`, un template dont le texte (« suspension… levée ») ne correspond pas à une désactivation.

Or `middleware/auth.js::protect` bloque `'inactif'` et `'suspendu'` de façon strictement identique (tout statut ≠ `'actif'` refuse la connexion). Rien ne justifie que seule la suspension prévienne l'utilisateur : la désactivation a le même impact réel (perte d'accès), et c'est justement la seule des deux qu'un utilisateur peut réellement subir en pratique aujourd'hui.

## Correction

- Ajout de `sendAccountDeactivatedEmail` dans `backend/utils/mail.js` — même structure HTML que `sendAccountSuspendedEmail`, texte corrigé (« Compte désactivé » / « Votre accès a été désactivé » / pas de mention de « suspension »).
- `settingsC.updateUser` : une transition vers `'inactif'` déclenche désormais la même sévérité (`type: 'warning'`, `priorite: 'haute'`) qu'une transition vers `'suspendu'`, et envoie le nouvel email de désactivation.
- `settingsC.deactivateUser` : appelle désormais `sendAccountDeactivatedEmail` au lieu de `sendAccountSuspendedEmail`.

Aucun changement de route, de schéma, ou de l'enum `User.statut`. La route `DELETE /settings/users/:id` elle-même reste orpheline (cf. ticket 0023) — hors périmètre de ce ticket, qui ne corrige que l'incohérence email/notification.

## Tests

- `backend/tests/auditA4NotifChangementRoleStatut.test.js` — nouveau sous-test dédié à la transition vers `'inactif'` via `updateUser` (notification `warning`/`haute`, email de désactivation réellement envoyé, email de suspension du sous-test précédent non ré-émis).
- `backend/tests/archivageAuditPointB.test.js` — stub d'email mis à jour pour cibler `sendAccountDeactivatedEmail` (suit le comportement corrigé, ne le contourne pas).
- Avant correction : reproduit la régression exacte (`'info' !== 'warning'`) en stashant temporairement le correctif et en relançant les tests contre le code d'origine.
- Après correction : 11/11 tests passent sur les deux fichiers combinés.

## Objectif futur si repris

Si `DELETE /settings/users/:id` est un jour réellement câblé à une UI, revérifier à ce moment que son comportement (déjà aligné sur `updateUser` par ce ticket) reste cohérent avec le mécanisme choisi côté frontend.
