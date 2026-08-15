# Ticket 0001 — Le compte de démo patient@clinique-souanke.cg n'a aucun dossier Patient associé

**Statut :** Ouvert — non corrigé (hors périmètre de la tâche qui l'a découvert)
**Origine :** Phase 2, T2.2 (migration `patient_id`), effet de bord détecté en exécutant la migration sur la base réelle.
**Sévérité :** Moyenne — casse une démo/recette utilisant ce compte précis, sans impact sur un vrai patient.

## Constat

`utils/seed.js` crée un compte `User` de démonstration :
```js
User.create({ email:'patient@clinique-souanke.cg', ..., role:'patient', ... })
```
mais **aucun document `Patient` avec cet email n'est créé nulle part dans le script de seed**. Les 12 dossiers `Patient` du seed utilisent tous d'autres adresses (`jb.mboumba@gmail.com`, `fatou.ngoma@yahoo.fr`, etc.).

Conséquence directe, vérifiée sur la base de développement réelle lors de l'exécution de la migration T2.2 :
- Le lookup par email de `portal.controller.js::findPatient` échoue déjà aujourd'hui pour ce compte → 404 "Dossier patient introuvable" sur toutes les routes du portail.
- La migration `patient_id` (T2.2) ne peut évidemment pas le lier non plus — il n'y a rien à lier.

Si ce compte sert de compte de démonstration/recette pour le portail patient (son nom suggère que oui), **la démo échoue silencieusement dès la première connexion**, sans lien évident avec sa cause réelle pour quelqu'un qui découvrirait le problème plus tard (Phase 5 ou recette finale, comme signalé) sans le contexte de cette investigation.

## Pourquoi non corrigé maintenant

Découvert pendant T2.2 (migration de données), dont le périmètre explicite excluait toute modification de `portal.controller.js` ou de la logique applicative — et `seed.js` n'était pas non plus dans le périmètre de T2.2 au-delà de l'ajout du compte `sage_femme` demandé par T2.1.

## Correction recommandée (non appliquée)

Dans `utils/seed.js`, section 5 (PATIENTS) : ajouter un 13e patient avec `email: 'patient@clinique-souanke.cg'` (ou modifier l'email du compte `User` de démo pour qu'il corresponde à l'un des 12 patients déjà seedés — plus simple, un seul point à changer). La seconde option est recommandée : plus courte, ne change pas le nombre de patients de démo.

## Test de vérification proposé pour la correction

Après correctif, `GET /api/portal/me` avec une session authentifiée sous `patient@clinique-souanke.cg` doit renvoyer `200` avec un dossier patient, pas `404`.
