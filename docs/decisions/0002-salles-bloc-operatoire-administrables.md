# Décision 0002 — Rendre les salles de bloc opératoire administrables

**Statut :** À trancher (non décidé) — rédigé en Phase 2 §6.2, brief de continuation MediSync
**Décideur attendu :** responsable produit / métier (bloc opératoire)

## Contexte

`blocoperatoireController.js` définit une constante statique `SALLES_BLOC` (3 salles : chirurgie générale, orthopédie, urgences/polyvalent), codée en dur dans le contrôleur. Le référentiel `Room` (chambres d'hospitalisation, administrable depuis `Administration.jsx`/`Settings`) ne modélise pas de type "salle de bloc opératoire" — son enum `type` actuel est `commune/privee/vip/reanimation/pediatrie/maternite`.

## Coût d'une évolution vers un référentiel administrable

- Ajouter une valeur (ex. `bloc_operatoire`) à l'enum `Room.type`.
- Migrer les 3 salles actuelles en documents `Room` réels (script de migration ponctuel, même logique que les compteurs atomiques déjà mis en place).
- Réécrire `blocoperatoireController.js::getSalles` et les fonctions qui référencent `SALLES_BLOC` pour lire depuis `Room` au lieu de la constante.
- Étendre l'écran Administration pour permettre la création/modification d'une salle de bloc (formulaire déjà existant pour les chambres, à adapter).

Estimation : migration légère, changement de portée limitée — contrairement à la fusion Echographie/Radiology, aucun cycle de statut complexe n'est en jeu.

## Bénéfice

- Ajouter, fermer ou renommer une salle de bloc sans modification de code ni redéploiement.
- Cohérence avec le reste de l'application, où les chambres sont déjà administrables.

## Option de statu quo

Conserver la configuration statique. Tant qu'aucun besoin d'extension (nouvelle salle, salle temporairement fermée pour travaux) n'est exprimé, 3 salles fixes suffisent et ce n'était pas un point de la liste prioritaire de la Phase 1.

## Recommandation (non tranchée)

Faible priorité tant qu'aucune évolution du nombre ou de la configuration des salles n'est prévue à court terme. À reconsidérer si la clinique planifie une extension du bloc opératoire.
