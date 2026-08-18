# Ticket 0019 — `urgencesController.js` : recherche `$regex` non échappée sur entrée utilisateur (ReDoS)

**Statut :** Ouvert — non corrigé (hors périmètre)
**Origine :** Audit complet post-Phase 10, section sécurité §9 (constat S2), généralisé en Vague 1 (`fix/audit11-regex-escape-generalization`)
**Sévérité :** Moyenne — même nature que les 7 occurrences corrigées ailleurs dans cette même branche, mais ce fichier n'a pas été touché

## Constat

`backend/controllers/urgencesController.js` (lignes ~80-82) construit un filtre de recherche à partir de `req.query.q` sans échapper les métacaractères regex :

```js
{ patient_nom: { $regex: q, $options: 'i' } },
{ numero:      { $regex: q, $options: 'i' } },
{ motif:       { $regex: q, $options: 'i' } },
```

C'est exactement le même défaut que celui corrigé dans 7 autres contrôleurs (`archive.controller.js`, `blocoperatoireController.js`, `chirurgieController.js`, `finance.controller.js`, `maternityController.js`, `pediatrieController.js`, `pharmacy.controller.js`) via un nouvel utilitaire partagé `escapeRegex()` (`backend/utils/helpers.js`) : un terme de recherche construit comme un motif regex pathologique (ex. `(a+)+$`) peut dégrader les performances du serveur (ReDoS applicatif), et des métacaractères comme `.`/`|` produisent des correspondances non voulues.

## Pourquoi non corrigé ici

`urgencesController.js` est le travail actif de l'utilisateur — contrainte permanente rappelée à plusieurs reprises tout au long de ce projet : ce fichier n'est jamais modifié dans le cadre des corrections d'audit, les constats y sont uniquement tracés en ticket.

## Correctif à appliquer (une fois débloqué)

Import déjà prêt à réutiliser tel quel :

```js
const { escapeRegex } = require('../utils/helpers');
// ...
if (q) {
  const qRe = escapeRegex(q);
  filter.$or = [
    { patient_nom: { $regex: qRe, $options: 'i' } },
    { numero:      { $regex: qRe, $options: 'i' } },
    { motif:       { $regex: qRe, $options: 'i' } },
  ];
}
```

Identique au pattern déjà appliqué aux 7 autres contrôleurs — voir leur diff pour référence exacte.
