# ADR-0001 — Convention de nommage des routes et clés API

**Statut :** Acceptée (T2.5) — implémentation reportée à la Phase 7, comme demandé.
**Contexte :** MediSync HIS, backend MERN.

## Contexte

L'inventaire réel de `backend/routes/index.js` montre trois situations différentes coexistant sans règle unique :

1. **Modules à double préfixe** (anglais technique + alias français, tous deux actifs simultanément) :
   - `/hospitalization` + `/hospitalisations` + `/chambres` (ce dernier alias `/rooms`)
   - `/laboratory` + `/laboratoire`
   - `/radiology` + `/imagerie`
   - `/pharmacy` + `/pharmacie`
   - `/archive` + `/archives`
   - `/settings` + `/admin`
2. **Modules exclusivement en français, sans équivalent anglais** :
   - `/chirurgie`, `/maternite`, `/pediatrie`, `/urgences`, `/ambulances`, `/echographie`
3. **Modules déjà en anglais seul, sans alias** :
   - `/auth`, `/dashboard`, `/patients`, `/appointments`, `/consultations`, `/finance`, `/hr`, `/messages`, `/notifications`, `/analytics`, `/prescriptions`, `/portal`, `/ai`, `/recurring`

Cette incohérence a un coût réel, déjà rencontré pendant l'audit technique : chaque alias double la surface de routes à sécuriser identiquement (`authorize(...)` doit être dupliqué et maintenu en synchronisation sur les deux chemins), double la charge de test, et complique la lecture du code pour quiconque reprend le projet sans connaître l'historique des deux conventions.

## Décision

**Un seul préfixe technique par module, en anglais, sans alias.** La traduction en français reste uniquement l'affaire de l'interface (libellés, menus) — jamais de la route elle-même.

Règles précises :
- Chemin en anglais, `kebab-case` si multi-mots (ex. `/lab-results` plutôt que `/labresults`), toujours au pluriel pour une collection (`/patients`, `/appointments`).
- Les alias existants (français ou pluriel/singulier redondant) sont supprimés, pas conservés en repli silencieux — un chemin qui n'existe plus doit renvoyer une 404 claire, pas continuer à répondre indéfiniment par compatibilité.
- Les clés JSON de réponse suivent la même logique : un seul jeu de clés (recommandé : anglais technique, ex. `patients`, `total`), sans doublon `patients`/`patientsList` ou `factures`/`invoices` côté même endpoint. La traduction des libellés affichés reste uniquement du ressort du frontend (i18n ou simples chaînes françaises dans les composants), jamais de la forme de la réponse API.
- Correspondance suggérée pour les modules actuellement en français seul : `/chirurgie`→`/surgery`, `/maternite`→`/maternity`, `/pediatrie`→`/pediatrics`, `/urgences`→`/emergencies`, `/ambulances`→`/ambulances` (déjà conforme), `/echographie`→`/ultrasound`.
- Correspondance pour les doubles préfixes : conserver le nom anglais déjà en place (`/hospitalization`, `/laboratory`, `/radiology`, `/pharmacy`, `/archive`, `/settings`), supprimer l'alias français ou redondant.

## Alternatives considérées

- **Conserver les deux formes indéfiniment** (statu quo) — rejeté : le coût de maintenance (sécurité dupliquée, tests dupliqués) dépasse le confort ponctuel de compatibilité.
- **Basculer vers le français partout** — rejeté : le code (modèles, contrôleurs, variables) est déjà trituré en anglais technique (`Patient`, `Invoice`, `Hospitalization`…) ; franciser les routes créerait une deuxième incohérence, entre routes et modèles cette fois.
- **Versionner l'API (`/api/v2/...`) pour permettre une transition en douceur** — jugé disproportionné pour une application qui n'a pas de client tiers externe à ménager ; le frontend est développé et déployé dans le même dépôt.

## Conséquences

- **Phase 7** (implémentation effective) : mise à jour de `routes/index.js` (suppression des alias), du client API frontend (`src/api/*`, tout appel utilisant un chemin français ou un alias doit être corrigé), et des tests qui référencent explicitement un chemin (`tests/accessMatrix.test.js`, `tests/routes.authorize.test.js` notamment — ils devront être mis à jour en même temps que les routes, pas après).
- Changement cassant pour tout appelant externe hypothétique de l'API — sans objet ici, aucun consommateur tiers connu.
- Réduit de moitié la surface de routes à sécuriser pour les 6 modules à double préfixe.

## Ce qui n'est PAS fait par cet ADR

Aucune ligne de code n'a été modifiée pour appliquer cette décision — conformément au périmètre de la Phase 2 (T2.5 est un document d'architecture, l'implémentation est explicitement réservée à la Phase 7). Cet ADR est la référence à suivre lorsque cette phase démarrera.
