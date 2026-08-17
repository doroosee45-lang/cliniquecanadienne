# Ticket 0017 — un `.save()` sur un dossier `Urgence` déjà anonymisé échoue (contrainte `required` sur `patient_nom`)

**Statut :** Ouvert — non corrigé
**Origine :** Vérification demandée par l'utilisateur avant la fusion de T9.13 ("un flux existant pourrait-il un jour redéclencher un `.save()` sur un document `Urgence` déjà anonymisé ?")
**Sévérité :** Moyenne — pas un bug actif à ce jour (aucun cas réel constaté), mais un chemin de code réellement atteignable, pas une hypothèse théorique

## Constat

`backend/utils/patientAnonymization.js` (T9.13) scrube `Urgence.patient_nom` via `updateMany({...}, {$unset:{patient_nom:1}})` — une opération qui **ne déclenche pas les validateurs Mongoose** (comportement par défaut de `updateMany`), alors que le schéma déclare ce champ `required: true`. Le retrait réussit donc silencieusement, laissant en base un document `Urgence` dont un champ obligatoire est absent.

`backend/controllers/urgencesController.js` (hors périmètre de correction — travail actif de l'utilisateur, jamais modifié) expose 4 fonctions qui rechargent un document `Urgence` par `findById` puis appellent `.save()` **sans aucune vérification de statut ni d'anonymisation préalable** :
- `exports.update` (`PUT /urgences/:id`, ligne ~143-169)
- `exports.addSoin` (`POST /urgences/:id/soins`, ligne ~181-196)
- `exports.addPrescription` (`POST /urgences/:id/prescriptions`, ligne ~208-218)
- `exports.addExamen` (`POST /urgences/:id/examens`, ligne ~230-240)

Contrairement à `updateMany`, `.save()` déclenche la validation complète du document. Si l'une de ces 4 fonctions est appelée sur un dossier `Urgence` dont le patient lié a été anonymisé (donc `patient_nom` absent), Mongoose lève une `ValidationError` (« Path `patient_nom` is required ») et la requête échoue en 400 — un dossier d'urgence légitimement historique, qui devrait rester consultable, devient impossible à modifier (même pour un ajout de soin tardif, une correction de statut, etc.), sans rapport avec la raison réelle de l'échec pour quelqu'un qui découvre ce comportement sans connaître l'anonymisation.

## Ce qui a été vérifié

- **Aucun test existant ne couvre ce scénario.** `backend/tests/patientAnonymizationT913.test.js` (T9.13) teste uniquement l'opération d'anonymisation elle-même (via `updateMany`), jamais un `.save()` subséquent sur le document anonymisé.
- Confirmé par lecture directe des 4 fonctions ci-dessus : aucune ne vérifie `statut` (l'`Urgence` pourrait être `sorti`/`transfere`/`decede` depuis longtemps, ce qui rendrait ce cas plus probable en pratique) ni un éventuel indicateur d'anonymisation avant d'appeler `.save()`.
- Non corrigé ici : `urgencesController.js` est le travail actif de l'utilisateur, jamais modifié dans le cadre de cet audit (cf. contrainte rappelée à plusieurs reprises tout au long de la session).

## Pistes pour correction future (à trancher avec l'utilisateur avant d'y toucher)

1. **Retirer `required: true`** sur `Urgence.patient_nom` (et les autres champs scrubés par l'anonymisation qui pourraient être dans le même cas) — le plus simple, mais change une contrainte de schéma qui s'applique aussi à la création normale d'urgences.
2. **Garde explicite** dans les 4 fonctions concernées : si le `Patient` lié est `anonymise:true`, refuser la modification avec un message clair (« Ce dossier est anonymisé, modification impossible ») plutôt que de laisser Mongoose échouer avec un message technique sans rapport.
3. **Pré-remplir `patient_nom`** avec un libellé neutre (ex. `"Patient anonymisé"`) au lieu de le retirer complètement — satisfait la contrainte `required` sans réintroduire de donnée identifiante, cohérent avec ce que fait déjà `patientAnonymization.js` sur le `Patient` lui-même (`nom: 'Patient anonymisé'` plutôt qu'un champ vide).

Option 3 semble la plus cohérente avec le principe déjà appliqué ailleurs dans T9.13, mais implique de revoir `CASCADE_TARGETS` (remplacer plutôt que retirer certains champs) — à valider avant implémentation, pas supposé ici.
