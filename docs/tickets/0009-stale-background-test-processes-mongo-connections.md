# Ticket 0009 — Processus `node --test` qui ne se terminent pas : connexions MongoDB fantômes

**Statut :** Ouvert — non traité (nettoyage réactif effectué à plusieurs reprises, cause structurelle non corrigée)
**Origine :** Constaté à plusieurs reprises pendant les Phases 7-8 (dont une nouvelle récidive en direct pendant la validation du ticket 0006 / P8.1)
**Sévérité :** Moyenne — ne touche que la fiabilité de la suite de tests (base réelle, non mockée), aucun impact en production ; mais source de faux échecs difficiles à diagnostiquer (collisions de données `409` attribuées à tort à une régression de code)

## Constat

Des exécutions de `node --test` (suite complète ou fichier isolé) laissent parfois un **processus Node vivant après la fin de la suite** — la sortie TAP finale (`ℹ tests N ... ℹ duration_ms ...`) s'affiche bien, mais le processus OS ne se termine pas et reste visible dans `ps aux` plusieurs minutes après, tenant toujours sa connexion MongoDB (Atlas, base réelle) ouverte. Deux occurrences concrètes :

1. **Nettoyage antérieur (Phases 7-8, avant ce ticket)** : plusieurs collisions `409 !== 201`/`404 !== 200` sur des exécutions complètes de la suite, d'abord attribuées à tort à des reliquats de session interactive. Diagnostiquées via `ps aux` (PID MSYS/git-bash) croisé avec `ps -W` (PID Windows natif) et `/proc/$pid/cmdline`, tuées via `kill -9` en couche POSIX git-bash (`taskkill`/`Stop-Process` natifs ne trouvaient pas les mêmes processus — a priori un problème de correspondance d'espace de PID entre les deux couches shell).
2. **Récidive en direct, pendant la préparation de ce ticket** : une exécution complète de la suite lancée au premier plan (pas en arrière-plan) pour valider le merge de `feature/P8.1-document-upload-hash` a affiché son résumé final (117 tests, 2 échecs) puis **n'a pas rendu la main** — le PID est resté actif dans `ps aux` plusieurs minutes après, encore relié à MongoDB. Un des deux échecs de cette exécution (`patientSelfActivation.test.js`, `409 !== 201`) provenait d'un document `Patient` `T08b` laissé par une exécution antérieure du jour, confirmant que ce processus fantôme (ou un de ses prédécesseurs) avait bien continué à écrire dans la base réelle après que je pensais l'exécution terminée. Une seconde récidive, indépendante, est arrivée **pendant l'investigation de ce même ticket** : une notification de tâche d'arrière-plan (`matrice d'accès route × rôle`) provenant d'une exécution lancée avant une compaction de contexte antérieure dans cette session est remontée seulement à ce moment-là — preuve qu'elle était restée active, invisible, depuis bien plus longtemps.

## Cause racine exacte

`node --test` (testé ici en Node v24.11.1) **attend que la boucle d'événements se vide naturellement avant de terminer le processus**, sauf si le flag `--test-force-exit` est passé explicitement. `backend/package.json` ne définit aucun script `"test"` et aucune des invocations utilisées jusqu'ici dans ce projet ne passe ce flag. Conséquence : si ne serait-ce qu'**un seul** descripteur actif (connexion MongoDB non fermée, timer, socket) subsiste après que tous les tests ont rapporté leur résultat — pour n'importe quelle raison, y compris une simple lenteur de fermeture de connexion ou une exception qui contourne un `finally` — le processus Node reste vivant indéfiniment, qu'il ait été lancé au premier plan ou en arrière-plan.

Vérifié positivement : relancer la suite complète avec `node --test --test-concurrency=1 --test-force-exit tests/*.test.js` (après nettoyage du reliquat `T08b`) a produit une exécution propre — 117/117 tests passés, **et le processus s'est terminé immédiatement après l'affichage du résumé**, confirmant que `--test-force-exit` empêche concrètement la persistance.

En revanche, je n'ai **pas isolé le descripteur exact ni le fichier de test précis** responsable de la persistance quand le flag est absent — une vérification systématique (grep du nombre d'appels `mongoose.connect()`/`mongoose.disconnect()` par fichier) n'a montré aucun déséquilibre évident sur les 25 fichiers de test actuels. La cause peut donc varier d'une exécution à l'autre (ex. une connexion dont la fermeture prend plus de temps que prévu, un test dont l'ordre d'exécution en parallèle partiel expose une fenêtre de course) plutôt que tenir à un unique fichier fautif identifiable.

## Pourquoi ce n'est pas corrigé maintenant

Documentation demandée explicitement à la place d'un correctif immédiat. Le nettoyage réactif (identification + `kill -9` des PID fantômes, suppression des documents de test orphelins) a été refait plusieurs fois au cours des Phases 7-8 et vient d'être refait une nouvelle fois pendant ce ticket — **ce n'est donc pas réglé, seulement assaini ponctuellement à chaque récidive**. Rien n'empêche structurellement une future exécution de laisser à nouveau un processus vivant.

## Objectif futur, si repris

- Ajouter `--test-force-exit` à l'invocation standard de la suite (script `"test"` à créer dans `backend/package.json`, actuellement absent) — piste vérifiée efficace ci-dessus, la plus simple à adopter.
- En complément, auditer systématiquement les blocs `try/finally` des fichiers de test pour confirmer qu'aucune connexion/handle n'est ouvert en dehors d'un chemin garanti de fermeture (le comptage `connect`/`disconnect` par fichier ne suffit pas à le prouver — seule une inspection de `process._getActiveHandles()` juste avant une sortie bloquée le confirmerait précisément).
- Adopter une discipline de vérification systématique (`ps aux` avant de faire confiance à un état de base "propre", en particulier avant d'attribuer un échec de test à une régression de code plutôt qu'à un reliquat) — pertinent tant que la cause structurelle ci-dessus n'est pas corrigée.
- Lié à [[0007]] (isolation des tests en exécution parallèle) : les deux tickets partagent le même symptôme de fond (tests contre une base réelle partagée, sans isolation stricte par exécution) mais des causes distinctes — 0007 est une course entre exécutions *simultanées volontaires*, 0009 est une exécution *censée être terminée* qui ne l'est pas.
