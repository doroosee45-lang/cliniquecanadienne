# Ticket 0006 — Le modèle `Document` est orphelin, aucun endpoint d'upload n'existe

**Statut :** Ouvert — non traité (R-10b reporté, décision explicite de l'utilisateur)
**Origine :** Phase 7, P7.6 — tentative de correction de R-10b (hash d'intégrité jamais calculé)
**Sévérité :** Faible en l'état (le module n'est utilisé nulle part, donc aucun risque actif) — deviendrait pertinent dès qu'un vrai flux d'upload de documents serait construit

## Constat

Le registre original (R-10b) décrivait `Document.hash_integrite` comme "jamais calculé", ce qui laissait supposer un endpoint d'upload existant auquel il suffirait d'ajouter le calcul du hash. En creusant pendant P7.6, ce n'est pas le cas : le modèle `backend/models/Document.js` (cycle de vie documentaire : `actif → archive_chaud → archive_froid → purge_planifiee`, hash d'intégrité, versionnement) n'est importé **nulle part** dans le backend — aucun contrôleur, aucune route ne le référence. Recherche exhaustive :

```
grep -rn "models/Document" backend/ --include="*.js"
→ aucun résultat, même pas une auto-référence côté modèle en dehors de sa propre définition
```

Il n'existe donc aucun endpoint d'upload de document du tout — ni générique, ni spécifique à un module. `Archive.jsx` (frontend) n'a pas non plus d'UI d'upload de document.

## Pourquoi ce n'est pas traité maintenant

Construire un endpoint d'upload de documents (Multer, validation de type/taille, stockage, calcul de hash à la réception, intégration au cycle de vie archivistique déjà modélisé) est un chantier plus large qu'un correctif de hash manquant — c'est une fonctionnalité complète à concevoir, pas une ligne à ajouter à un endpoint existant. Décision explicite de l'utilisateur : reporter, documenter la découverte.

## Objectif futur, si ce chantier est repris

- Décider où l'upload de documents doit vivre fonctionnellement (Archive ? Dossier patient ? Un nouveau module dédié ?) avant de coder — le modèle `Document` existe déjà et couvre un vrai besoin (versionnement, cycle de vie, hash), il manque juste le point d'entrée.
- Réutiliser le pattern Multer déjà en place pour les photos patients/médicaments (`middleware/upload.js`) comme référence.
- Calculer `hash_integrite` (SHA-256 du contenu) à la réception du fichier, avant écriture sur disque — pas après coup.
- Vérifier si le frontend a un besoin réel avant de construire l'endpoint : `Archive.jsx` n'a actuellement aucune UI d'upload à brancher dessus.
