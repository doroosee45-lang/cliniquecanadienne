# Ticket 0011 — Audit de sécurité des dépendances (T9.7) : risques acceptés et mise à jour différée

**Statut :** Ouvert — décisions actées, une action différée reste à planifier
**Origine :** T9.7 (Phase 9), suite à la mise en place de `npm audit` en CI (T9.6)
**Sévérité :** Faible pour les deux risques acceptés (non exploitables tels qu'utilisés dans ce code) ; la mise à jour différée (react-router) est un risque de régression fonctionnelle, pas une vulnérabilité active

## Contexte

`npm audit` (backend + frontend) a été passé en revue, avec correction de tout ce qui était non cassant :
- **Backend** : Mongoose (pollution de prototype via casting `update`, `GHSA-664h-wqgq-64gw`) — corrigé `8.24.0 → 8.24.1` (`^8.24.1`), vérifié explicitement contre le hook `pre('save')` d'`Invoice.js` (calcul `montant_paye`/`montant_restant`, génération `numero_facture`, correctif `date_echeance` de [[T5.2]]) et contre `sweepFullPayloadT52.test.js` en entier, avant et après la mise à jour — 198/198 tests toujours verts. `brace-expansion` et `morgan` corrigés via `npm audit fix` (non cassant).
- **Frontend** : `axios` (9 avis), `DOMPurify` (3), `form-data`, `nanoid`, `PostCSS`, `Socket.IO`, `launch-editor` — tous corrigés via `npm audit fix` (non cassant), build frontend confirmé propre après coup.

Quatre éléments ont nécessité un arbitrage plutôt qu'une correction automatique ; le premier (`nodemailer`) est depuis résolu par suppression pure et simple de la dépendance (migration Resend), les trois autres restent ouverts :

## 1. `nodemailer` (backend) — RÉSOLU (13 sept. 2026, migration Resend)

**Faille :** SSRF / lecture de fichier arbitraire via l'option `raw`, contournant `disableFileAccess`/`disableUrlAccess` (`GHSA-p6gq-j5cr-w38f`, sévérité haute).

**Résolution :** `nodemailer` n'est plus une dépendance de ce projet — `backend/utils/mail.js` a été entièrement migré vers l'API Resend (SDK officiel `resend`), qui ne présente pas cette faille. `npm audit` ne signale plus rien pour ce paquet, plus besoin d'un risque accepté. Le seuil `--audit-level` du job backend en CI (`.github/workflows/ci.yml`) a été resserré de `critical` à `high` en conséquence : la seule justification restante pour un seuil aussi permissif était cette faille haute, désormais disparue — le job frontend reste à `critical` (`xlsx`/`react-router-dom` ci-dessous, encore réels).

## 2. `xlsx` (frontend, SheetJS) — risque accepté, aucun correctif disponible

**Faille :** pollution de prototype (`GHSA-4r6h-8v6p-xvw6`) + ReDoS (`GHSA-5pgg-2g8v-p4x9`), sévérité haute. `npm audit` : **aucun correctif disponible**, y compris avec `--force` — limitation connue du paquet publié sur le registre npm lui-même.

**Usage dans le code :** exports Excel (`XLSX.utils.*`, `XLSX.writeFile`) dans plusieurs modules (HR, Finance, et probablement d'autres pages de reporting) — génération de classeurs à partir de données internes déjà chargées, pas de parsing de fichiers `.xlsx` fournis par un tiers non fiable à l'heure actuelle. Le vecteur d'exploitation réel (parsing d'un fichier malveillant) n'est donc pas non plus démontré dans l'usage actuel, mais n'a pas été audité exhaustivement module par module.

**Décision :** risque accepté et documenté ici, pas d'action immédiate. Remplacer la librairie (ex. `exceljs`) serait un chantier séparé, non traité dans ce ticket.

**À surveiller :** toute évolution de `xlsx` vers un correctif publié, ou tout nouvel usage qui parserait un fichier Excel fourni par un utilisateur (upload) — reconsidérer immédiatement si ce cas apparaît.

## 3. `react-router-dom` (frontend) — mise à jour différée, tâche dédiée à planifier

**Faille :** redirection ouverte via antislash dans `<Link>`/`useNavigate` (`GHSA-wrjc-x8rr-h8h6`) + injection de constructeur arbitraire via `deserializeErrors()` en hydratation SSR (`GHSA-337j-9hxr-rhxg`), sévérité modérée. Corrigé en `7.18.2` — saut majeur depuis `^6.30.4`.

**Décision :** ne pas forcer dans ce ticket. C'est la librairie de routage/navigation de toute l'application, y compris la protection de route par rôle (RBAC) déjà en place — un risque de régression plus élevé que les deux points précédents, et aucun outil de capture visuelle/navigateur n'est disponible dans cet environnement pour valider les flux de navigation après la migration.

**À planifier :** tâche dédiée, sur sa propre branche, avec validation manuelle des flux de navigation et de contrôle d'accès par rôle dans un vrai navigateur avant fusion.

## 4. `uuid`/`hyperid` (backend, transitif via `autocannon`) — risque accepté, devDependency de test uniquement

**Ajouté :** Phase 10.2 (`npm install --save-dev autocannon`, test de charge). `npm audit` signale `uuid <11.1.1` (défaut de vérification de limites de buffer quand un `buf` est fourni explicitement, `GHSA-w5hq-g745-h8pq`, sévérité modérée), tiré transitivement par `hyperid` → `autocannon`. Correctif disponible uniquement via `autocannon@2.0.1` (changement cassant).

**Décision :** risque accepté, pas de correctif forcé. `autocannon` est une `devDependency` (jamais publiée en production), utilisée uniquement pour générer de la charge HTTP contre le serveur isolé local de `tests/loadTestT102.test.js` — jamais exposée à une entrée utilisateur externe non fiable ; le code applicatif ne fournit jamais lui-même de `buf` à `uuid`, c'est un détail interne d'`autocannon`/`hyperid`.

## Liens

- [[T5.2]] — le correctif `date_echeance` d'`Invoice.js` vérifié pendant la mise à jour Mongoose
- T9.6 — pipeline CI où `npm audit` est maintenant câblé (voir `.github/workflows/ci.yml`)
