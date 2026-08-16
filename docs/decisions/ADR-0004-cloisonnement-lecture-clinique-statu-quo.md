# ADR-0004 — Cloisonnement de la lecture clinique (T9.1 / R-08a) : statu quo confirmé

**Statut :** Décidé — pas de changement de code.
**Contexte :** Phase 9, T9.1. Le brief demandait d'évaluer si la lecture des données cliniques sensibles doit être cloisonnée par profession sur `patients`, `hospitalization`, `laboratory`, `pharmacy`, `prescriptions`.

## Constat (vérifié dans le code au moment de la rédaction, pas recopié d'un audit antérieur)

| Fichier | `authorize()` en lecture | Comptable / Réceptionniste |
|---|---|---|
| `hospitalization.routes.js` | `superadmin, adminclinique, medecin, infirmier` (`CAN_WRITE`, utilisé aussi pour les GET) | Aucun accès |
| `laboratory.routes.js` | `superadmin, adminclinique, medecin, infirmier, laborantin` (`CAN_READ`) | Aucun accès |
| `pharmacy.routes.js` | `superadmin, adminclinique, pharmacien, medecin, infirmier` (`CAN_READ`) | Aucun accès |
| `prescriptions.routes.js` | `superadmin, adminclinique, medecin, infirmier, pharmacien` (`canRead`) | Aucun accès |
| `patients.routes.js` | Les 10 rôles professionnels (`CAN_READ`) | Accès à la route, mais **filtré par champ** côté contrôleur (`RESTRICTED_FIELDS`) |

Quatre des cinq fichiers excluent déjà comptable et réceptionniste de toute lecture, y compris consultative, au niveau route. Le cinquième (`patients.routes.js`) leur donne accès à la route par nécessité opérationnelle (identifier un patient pour la facturation ou l'accueil), mais le contrôleur ne renvoie que les champs démographiques et les assurances/contact d'urgence — aucun champ clinique (`antecedents_medicaux`, `antecedents_familiaux`, `notes`, `groupe_sanguin`, `allergies` restent absents de la réponse pour ces deux rôles, pas seulement masqués côté UI).

## Vérification (rejouée, pas seulement retrouvée dans le code)

`backend/tests/patientFieldAccess.test.js` rejoué le 2026-08-16 sur l'état actuel du dépôt : 7/7 sous-tests passent, dont le scénario exact demandé par le critère de sortie de T9.1 (*« comptable : démographique + assurances, aucun champ clinique »*).

## Décision

**Statu quo.** Aucun cloisonnement supplémentaire n'est nécessaire :
- Le filtrage par champ sur `patients.routes.js` répond déjà à l'objectif (accès minimal nécessaire à la facturation/accueil, sans détail clinique).
- Les quatre autres modules excluent déjà comptable/réceptionniste au niveau route — il n'y a rien à restreindre de plus sans casser un besoin métier légitime.

Décision prise par l'utilisateur après présentation de cet état des lieux, sans qu'une consultation formelle d'un porteur métier distinct n'ait été jugée nécessaire vu l'absence d'écart constaté.

## Conséquence

Ticket T9.1 clos sans changement de code. Si un besoin de cloisonnement plus strict apparaît à l'usage (ex. restreindre davantage `patients.routes.js`), rouvrir cette décision plutôt que la modifier silencieusement — cohérent avec la convention déjà en place pour `baseline-checklist-10x23.md`.
