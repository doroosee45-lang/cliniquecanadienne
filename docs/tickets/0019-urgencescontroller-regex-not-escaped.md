# Ticket 0019 — `urgencesController.js` : recherche `$regex` non échappée sur entrée utilisateur (ReDoS)

**Statut :** Fermé — corrigé
**Origine :** Audit complet post-Phase 10, section sécurité §9 (constat S2), généralisé en Vague 1 (`fix/audit11-regex-escape-generalization`)
**Sévérité :** Moyenne — même nature que les 7 occurrences corrigées ailleurs dans la même branche

## Clôture

Ouvert initialement par erreur de périmètre : exclu par analogie avec `frontend/src/pages/Urgences.jsx` (hors limites, travail actif de l'utilisateur), en confondant ce fichier avec le contrôleur backend `urgencesController.js` — deux fichiers distincts. L'utilisateur a précisé explicitement que seul `Urgences.jsx` (frontend) est hors périmètre ; `urgencesController.js` (backend) ne l'est pas. Corrigé dans la foulée, même branche, même pattern que les 7 autres contrôleurs — voir commit correspondant.

## Constat

`backend/controllers/urgencesController.js` (lignes ~80-82) construit un filtre de recherche à partir de `req.query.q` sans échapper les métacaractères regex :

```js
{ patient_nom: { $regex: q, $options: 'i' } },
{ numero:      { $regex: q, $options: 'i' } },
{ motif:       { $regex: q, $options: 'i' } },
```

C'était exactement le même défaut que celui déjà corrigé dans 7 autres contrôleurs (`archive.controller.js`, `blocoperatoireController.js`, `chirurgieController.js`, `finance.controller.js`, `maternityController.js`, `pediatrieController.js`, `pharmacy.controller.js`) via l'utilitaire partagé `escapeRegex()` (`backend/utils/helpers.js`) : un terme de recherche construit comme un motif regex pathologique (ex. `(a+)+$`) peut dégrader les performances du serveur (ReDoS applicatif), et des métacaractères comme `.`/`|` produisent des correspondances non voulues.

## Correctif appliqué

Identique au pattern des 7 autres contrôleurs :

```js
const { logAction, escapeRegex } = require('../utils/helpers');
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
