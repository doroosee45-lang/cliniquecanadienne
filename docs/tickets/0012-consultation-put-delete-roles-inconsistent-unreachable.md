# Ticket 0012 — Rôles incohérents sur PUT/DELETE consultations, actuellement sans impact (endpoints non exposés côté UI)

**Statut :** Fermé sans correction — impact actuel nul, dette technique documentée. À rouvrir si un workflow d'édition/suppression/validation de consultation est introduit.
**Origine :** Audit de code frais (AUDIT-05), Phase 9
**Sévérité :** Faible — aucune route atteinte par un utilisateur réel aujourd'hui

## Constat

`backend/routes/consultations.routes.js` déclare trois listes de rôles différentes sur le même cycle de vie :

```js
router.post('/',      authorize('superadmin','medecin','infirmier'), consultC.create);
router.put('/:id',    authorize('superadmin','medecin'),             consultC.update);
router.delete('/:id', authorize('superadmin','adminclinique'),       consultC.remove);
```

`infirmier` peut créer une consultation mais pas la modifier ; `adminclinique` peut la supprimer sans jamais avoir pu la créer ni la modifier. `consultations.controller.js::update`/`::remove` n'ajoutent aucune vérification de propriété — seul le rôle de la route protège ces deux actions.

## Analyse du workflow réel (avant toute décision)

Vérifié directement, pas supposé : `updateConsultation` (thunk Redux, `PUT /consultations/:id`) est défini dans `frontend/src/store/slices/consultationsSlice.js` mais **n'est dispatché nulle part dans toute l'application** — `Consultations.jsx` n'importe que `fetchConsultations` et `createConsultation`. Aucune action de suppression de consultation n'existe même au niveau de la slice.

**Conséquence :** ni `PUT` ni `DELETE /consultations/:id` ne sont atteignables depuis l'interface actuelle, pour aucun rôle. L'incohérence des listes de rôles est réelle mais inerte — elle ne bloque aucun workflow existant, contrairement à l'hypothèse initiale de l'audit (« un infirmier ne peut pas corriger sa propre saisie »).

## Décision (utilisateur, Phase 9)

Ne pas modifier `authorize()` sur ces deux routes tant qu'aucun workflow réel ne les utilise — modifier des permissions sur du code mort par souci d'« harmonisation » serait un changement sans justification fonctionnelle vérifiable. Aucun fichier modifié.

## Objectif futur, si repris

À rouvrir explicitement si l'une de ces fonctionnalités est introduite (aucune ne l'est à ce jour) :
- Édition d'une consultation existante depuis l'UI.
- Suppression/annulation d'une consultation depuis l'UI.
- Correction d'une saisie infirmière a posteriori.
- Workflow de validation médicale d'une consultation créée par un infirmier.

Dans ce cas, les rôles `authorize()` de `PUT`/`DELETE` doivent être décidés à partir du workflow métier réel alors défini, pas repris tels quels de l'état actuel.
