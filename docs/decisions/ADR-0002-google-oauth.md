# ADR-0002 — Authentification Google OAuth : vérification et création de dossier

**Statut :** Acceptée (T3.1 + T3.2, Phase 3).
**Contexte :** MediSync HIS, `backend/controllers/googleAuth.controller.js`.

## Décision 1 — Vérification du jeton (T3.2)

`googleAuth.controller.js` recevait un `access_token` du frontend et interrogeait directement `googleapis.com/oauth2/v2/userinfo` avec. Cela authentifie bien le jeton (Google répond 401 s'il est invalide) mais ne vérifie jamais son **audience** — un jeton Google valide émis pour n'importe quelle autre application tierce était accepté ici aussi.

**Décidé :** vérifier le jeton via `OAuth2Client.getTokenInfo()` (`google-auth-library`, déjà déclarée en dépendance, jamais utilisée avant cette tâche) avant tout appel à `userinfo`, et rejeter si `tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID`. Le variable `GOOGLE_CLIENT_ID` existait déjà côté serveur (`.env`) mais n'était pas documentée dans `.env.example` — corrigé au passage.

## Décision 2 — Création automatique du dossier Patient (T3.1)

Un compte Google auto-inscrit (`role:'patient'`) n'avait jusqu'ici aucun document `Patient` associé — chaque appel au portail échouait en 404 dès la première connexion (constat R-00b).

Deux options étaient sur la table : créer immédiatement un dossier minimal, ou rediriger vers un formulaire de complétion obligatoire avant tout accès. **Complication identifiée en cours de tâche** : `Patient.date_naissance` et `Patient.sexe` (enum strict `M`/`F`) sont `required`, et Google ne fournit ni l'un ni l'autre — les remplir avec une valeur par défaut aurait inséré une donnée clinique fictive dans un vrai dossier médical.

**Décidé** (validé explicitement) : créer le dossier immédiatement, avec ces deux champs rendus **conditionnellement optionnels** — `required` uniquement quand `profil_a_completer` (nouveau champ `Boolean`, défaut `false`) est faux. La création normale d'un dossier (réceptionniste, admin — `patients.controller.js`) n'est pas affectée : les deux champs y restent obligatoires comme avant, `profil_a_completer` n'y est jamais mis à `true`.

**Explicitement écarté :** remplir `sexe`/`date_naissance` avec une valeur arbitraire pour satisfaire le schéma tel quel — rejeté pour ne pas fabriquer de donnée clinique.

**Conséquence directe, ticketisée séparément :** aucun écran frontend n'affiche actuellement `profil_a_completer` — ni bannière côté portail, ni badge côté fiche patient pour le personnel. Voir `docs/tickets/0002-badge-profil-incomplet-frontend.md`, non traité dans cette phase (hors périmètre fichier de T3.1).

## Ce qui n'a pas changé

Le flux d'auto-inscription lui-même (compte créé automatiquement au premier login Google, rôle `patient`, statut `actif`, sans validation administrative) reste tel quel — **ce n'est pas, en soi, une faille de sécurité** une fois le contrôle d'accès par rôle correctement appliqué (vérifié et testé explicitement en Phase 2 : un compte Google auto-inscrit n'atteint aucune route professionnelle, `tests/googleAutoSignup.test.js`). Le risque réel corrigé par T3.1 est fonctionnel (portail cassé), pas une fuite de données.

## Fichiers concernés

`backend/controllers/googleAuth.controller.js`, `backend/models/Patient.js`, `backend/.env.example`.
