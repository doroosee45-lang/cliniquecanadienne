# Ticket 0007 — Isolation des tests : `getSalaires` interroge tout le personnel actif sans le scoper au test

**Statut :** Ouvert — **P2**, mitigé (pas corrigé). `npm test` embarque `--test-concurrency=1` depuis la clôture du ticket 0009, ce qui neutralise le symptôme pour l'invocation standard. La cause de fond (`getSalaires` non scopé) n'est **pas** corrigée — piste différée, pas abandonnée (voir « Résolution partielle » ci-dessous).
**Origine :** Phase 7, P7.7 — extension de `donnees_avant`/`donnees_apres`
**Sévérité :** Faible (n'affecte que la fiabilité de la suite de tests en exécution parallèle, aucun impact en production)

## Constat

`node --test tests/*.test.js` (mode par défaut, fichiers exécutés en parallèle) échoue de façon intermittente sur `financeDepensesSalairesAssurances.test.js` :

```
payerSalaire marque payé, refuse le double paiement
  404 !== 200
```

Confirmé que ce n'est **pas** une régression de code : `node --test --test-concurrency=1 tests/*.test.js` fait passer les 85 tests proprement, à chaque exécution.

## Cause probable

`finance.controller.js::getSalaires` fait `Staff.find({ statut: 'actif' })` sans filtre supplémentaire — il génère un bulletin de salaire pour **tout le personnel actif de la base**, pas seulement celui créé par le test en cours. Quand deux fichiers de test créent des `Staff`/`Salaire` en parallèle sur la même base réelle (pas de mock), l'un peut interférer avec l'état que l'autre suppose stable entre la génération du bulletin et son paiement.

`auditBeforeAfterExtended.test.js` (introduit dans ce même P7.7) ajoute de la charge concurrente sur ces mêmes collections, ce qui a rendu la course plus visible — mais la fragilité existait déjà avant.

## Pourquoi ce n'est pas traité maintenant

Signalé mais non bloquant pour la Phase 7 (décision explicite de l'utilisateur). Corriger proprement demande soit d'isoler chaque test sur ses propres données (préfixer/filtrer par un identifiant de run), soit de faire tourner la suite avec `--test-concurrency=1` en CI — un choix d'architecture de test à trancher, pas un correctif ponctuel.

## Résolution partielle (2026-08-16)

`backend/package.json`'s `"test"` script embarque désormais `--test-concurrency=1 --test-force-exit` (ticket 0009, commit `5d41d2a`) — la seconde piste listée ci-dessous est donc acquise pour quiconque lance `npm test`. Décision explicite de l'utilisateur : cette mitigation est jugée suffisante pour l'instant, reclassé en **P2**.

Important : ceci **neutralise le symptôme**, pas la cause. `getSalaires` interroge toujours tout le personnel actif sans le scoper au test qui l'appelle — un `node --test` invoqué directement sans passer par le script `npm test`, ou une future modification qui retirerait le flag, resterait vulnérable à la même course. La piste 1 ci-dessous (scoper `getSalaires`) reste **différée, pas abandonnée**.

## Objectif futur, si repris

- Scoper `getSalaires` (et tout endpoint similaire à état global) dans les tests via un filtre explicite sur les données créées par le test, plutôt que de compter sur l'absence de données concurrentes. — **différé (P2), pas abandonné.**
- ~~Ou : documenter/imposer `--test-concurrency=1` comme mode d'exécution standard de la suite~~ — fait, voir Résolution partielle ci-dessus.
