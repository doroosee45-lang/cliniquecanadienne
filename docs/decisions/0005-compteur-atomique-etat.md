# État — Compteur atomique (T2.3)

**Statut :** Déjà en place, vérifié pour cette tâche — aucun changement de code nécessaire.

## Constat

`backend/models/Counter.js` (`{ _id: <nom_sequence>, seq: Number }`) et `backend/utils/counter.js` (`nextSequence(key)`, `findOneAndUpdate` + `$inc` + `upsert`, atomique par construction) existent déjà et sont branchés sur les hooks `pre('save')` — ou l'équivalent en fonction de génération de numéro — des modèles suivants :

| Modèle | Préfixe | Fichier |
|---|---|---|
| Patient | `CLIN-YYYY-NNNNN` | `models/Patient.js` |
| Prescription | `RX-YYYY-NNNNN` | `models/Prescription.js` |
| Invoice | `INV-YYYY-NNNNN` | `models/Invoice.js` |
| Staff | `STAF-NNNN` | `models/Staff.js` |
| Urgence | `URG-YYYY-NNNN` | `models/Urgence.js` |
| Echographie | `ECH-YYYY-NNNN` | `models/Echographie.js` |
| Pregnancy | `MAT-YYYY-NNNN` | `models/Pregnancy.js` |
| Delivery | `ACC-YYYY-NNNN` | `models/Delivery.js` |
| Newborn | `NB-YYYY-NNNN` | `models/Newborn.js` |
| Child | `PED-YYYY-NNNN` | `models/Child.js` |
| PediatricConsultation | `CPED-YYYY-NNNN` | `models/PediatricConsultation.js` |
| DossierChirurgical (chirurgie) | `CHIR-YYYY-NNNN` | `controllers/chirurgieController.js::generateNumero` |
| DossierChirurgical (bloc) | `BLOC-YYYY-NNNN` | `controllers/blocoperatoireController.js::generateNumeroBloc` |

Soit 11 modèles + 2 fonctions de contrôleur (chirurgie et bloc partagent le modèle `DossierChirurgical` mais utilisent des clés de séquence distinctes `chirurgie-${year}`/`bloc-${year}`, donc pas de risque de collision entre les deux malgré le modèle commun) — couvre les "12 modèles à numérotation automatique" visés par cette tâche.

## Migration des compteurs sur base déjà peuplée

`backend/utils/migrate-init-counters.js` initialise chaque compteur au maximum réellement déjà utilisé (pas à zéro), pour éviter qu'un compteur redémarrant à 0 sur une base déjà peuplée ne réutilise des numéros déjà pris. Déjà exécuté sur la base de développement actuelle.

## Test de vérification (T2.3)

`tests/counterConcurrency.test.js` — 20 créations strictement simultanées (`Promise.all`, pas de boucle séquentielle) par modèle, sur les trois les plus sollicités comme demandé (Patient, Prescription, Invoice) : **0 doublon sur 60 créations concurrentes au total**, vérifié contre la base réelle, données de test nettoyées après coup.

```
✔ 20 Patient créés en parallèle → 20 numero_dossier distincts
✔ 20 Prescription créées en parallèle → 20 numero_rx distincts
✔ 20 Invoice créées en parallèle → 20 numero_facture distincts
```

## Conclusion

T2.3 est déjà satisfait par l'état actuel du code. Aucune action de développement requise pour cette tâche au-delà de l'ajout du test explicite ci-dessus, qui n'existait pas sous cette forme (l'ancien test `dataIntegrity.test.js` ne couvrait que 2 créations concurrentes).
