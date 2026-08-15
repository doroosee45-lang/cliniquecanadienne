# Décision 0001 — Fusion Echographie ↔ Radiology (ImagingResult)

**Statut :** À trancher (non décidé) — rédigé en Phase 2 §6.1, brief de continuation MediSync
**Décideur attendu :** responsable produit / métier (imagerie médicale)

## Contexte

Deux modules distincts couvrent aujourd'hui l'imagerie médicale :
- `Radiology.jsx` / `ImagingResult` — radiologie, scanner, IRM. Cycle de statuts : `programme → en_attente → realise → rapporte → valide → annule`. Lié au catalogue `ExamCatalogue`.
- `Echographie.jsx` / `Echographie` — échographies. Cycle de statuts propre : `en_attente → planifiee → realisee → validee → annulee`. Référence patient en partie libre (`patient_ref` facultatif, `patient` en texte). Non lié à `ExamCatalogue`.

Une échographie est, cliniquement, un type d'examen d'imagerie parmi d'autres — la duplication n'est pas justifiée par une différence de nature de l'acte, mais par l'historique de développement (deux écrans construits séparément).

## Coût d'une fusion

- Migration de données : convertir chaque document `Echographie` existant en `ImagingResult` (mapping des deux cycles de statuts, qui ne se correspondent pas terme à terme).
- Réécriture du contrôleur `echographieController.js` et de ses routes, remplacées par des cas d'usage de `radiology.controller.js`.
- Adaptation de `Echographie.jsx` pour consommer l'API `/radiology` (ou fusion des deux écrans en un seul avec filtre par type d'examen).
- Rattachement au catalogue `ExamCatalogue` — nécessite que les types d'échographie y soient référencés (aujourd'hui gérés en texte libre côté Echographie).
- Tests de non-régression sur les deux parcours existants.

Estimation : chantier de taille moyenne, pas un simple renommage — implique une migration de données en production.

## Bénéfice

- Fin de la duplication de cycle de vie et de modèle pour un même type d'acte médical.
- Vision unifiée de l'imagerie dans les tableaux de bord et l'archivage (actuellement, `archive.controller.js` traite les deux séparément).
- Un seul catalogue de référence (`ExamCatalogue`) pour la tarification et les délais, au lieu de deux sources.

## Option de statu quo

Ne rien changer. Coût : la duplication continue d'exister, mais aucune donnée n'est en risque et aucun parcours utilisateur n'est perturbé. Documenté comme dette technique connue depuis l'audit initial.

## Recommandation (non tranchée)

Ne pas fusionner sans un besoin métier concret exprimé (ex. un rapport transverse imagerie qui échoue aujourd'hui faute d'unification). En l'absence d'un tel besoin, le statu quo documenté est la voie la plus sûre à court terme.
