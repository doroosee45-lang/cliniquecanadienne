# Ticket 0006 — Le modèle `Document` est orphelin, aucun endpoint d'upload n'existe

**Statut :** Résolu et clos — Option A retenue (endpoint minimal), commits `2122c47` + `ef57cdc`, mergé dans `develop` via `72a8401`.
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

## Résolution — Option A (décision explicite de l'utilisateur, 2026-08-16)

Périmètre volontairement minimal, tel que décidé : upload, hash, consultation, statut par défaut `actif`. **Pas** les transitions de cycle de vie (`archive_chaud`, `archive_froid`, `purge_planifiee`) — resteraient un ticket séparé si le besoin se confirme à l'usage.

- `backend/middleware/upload.js` — `uploadDocument` (nouveau), même pattern Multer que `uploadPatientPhoto`/`uploadMedPhoto` : liste blanche `.pdf/.jpg/.jpeg/.png/.doc/.docx`, limite 20 Mo, 1 fichier.
- `backend/controllers/document.controller.js` (nouveau) — `create`/`getAll`/`getOne`. `hash_integrite` (SHA-256) calculé à la réception, avant toute autre écriture — ce que R-10b constatait comme jamais fait.
- `backend/routes/document.routes.js` (nouveau) — `protect` + `authorize('superadmin', 'adminclinique')` sur les 3 routes, réponse `{ success, ... }`, `logAction()` sur la création — conforme à la convention §18.4.
- Testé dans `backend/tests/documentUploadHash.test.js` : hash SHA-256 réel vérifié, rejet sans fichier, liste/consultation, **403 réel** sur un rôle non autorisé, rejet réel d'une extension hors liste blanche et d'un fichier > 20 Mo (ces 3 derniers ajoutés après une demande explicite de vérification avant validation du merge).
- Commits `2122c47` (implémentation) + `ef57cdc` (tests de rejet ajoutés), mergé dans `develop` via `72a8401`.
