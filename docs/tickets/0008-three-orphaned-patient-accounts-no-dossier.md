# Ticket 0008 — Trois comptes patient réels sans aucun dossier `Patient` associé

**Statut :** Partiellement traité — contrainte structurelle livrée (empêche toute récidive). Décision suppression/recréation pour les 3 comptes existants toujours en attente de l'utilisateur.
**Origine :** Phase 7, P7.8 — comptage `patient_id` avant migration de `portal.controller.js`
**Sévérité :** Moyenne — ces comptes sont actuellement inutilisables sur le portail patient (404 sur toutes les routes), aucun impact sur un vrai parcours patient actif

## Constat

En comptant les comptes `role: 'patient'` sans `patient_id` peuplé (4 sur 7, 57 % du total), une vérification croisée par email a montré que ces 4 comptes échouent **aussi** la résolution par email — `Patient.findOne({ email })` ne trouve rien pour aucun d'eux. Un seul de ces quatre (`patient@clinique-souanke.cg`) était déjà connu et documenté (ticket 0001 — compte de démo du seed jamais lié). Les trois autres sont une découverte nouvelle :

| Email | Créé le | Statut | must_change_password |
|---|---|---|---|
| `redreseaux3@gmail.com` | 2026-06-08 | inactif | true |
| `mersematondo86@gmail.com` | 2026-06-08 | inactif | true |
| `meyaosee915@gmail.com` | 2026-06-08 | inactif | true |

Contrairement au compte de démo (jamais lié dès l'origine), ces trois portent les marqueurs d'une création via le flux normal (`patients.controller.js::create` : `statut: inactif`, `must_change_password: true`, pas de `googleId`) — l'hypothèse la plus probable est qu'un dossier `Patient` a été créé puis supprimé après coup (test, doublon nettoyé…), laissant le compte `User` lié orphelin, sans qu'aucun mécanisme ne supprime ou ne signale le compte devenu orphelin.

## Pourquoi non corrigé immédiatement (à l'origine)

Découvert pendant l'étape de vérification préalable de R-07 (comptage `patient_id` avant migration de `portal.controller.js`) — corriger des comptes de test orphelins n'est pas le périmètre de R-07, qui porte sur l'ordre de résolution `patient_id`/email, pas sur la présence d'un dossier. Décision explicite de l'utilisateur : ticket séparé, pas de correctif dans cette passe.

## Investigation AuditLog (2026-08-16)

Demande explicite avant de trancher suppression vs recréation : chercher une entrée `DELETE` sur `Patient` correspondant à chacun des 3 comptes, autour de leur date de création (2026-06-08). Recherche faite par correspondance nom/prénom (le log `DELETE` ne capture pas l'email, seulement `Suppression : {nom} {prenom}` — voir limite ci-dessous) sur une fenêtre `module: 'patients', action: 'DELETE'` du 2026-05-09 au 2026-07-08.

**Résultat : les 3 comptes ont bien une entrée `DELETE` correspondante — confirmé pour chacun, pas une hypothèse.**

| Email | Dossier créé le | Entrée DELETE trouvée | Supprimé le | Par |
|---|---|---|---|---|
| `mersematondo86@gmail.com` | 2026-06-08 | "Suppression : matondo merse" | 2026-06-14T16:48:53.642Z | `oseedoro@gmail.com` (superadmin) |
| `meyaosee915@gmail.com` | 2026-06-08 | "Suppression : DORODORO sergine" | 2026-06-14T16:48:44.211Z | `oseedoro@gmail.com` (superadmin) |
| `redreseaux3@gmail.com` | 2026-06-08 | "Suppression : Meya Osée" | 2026-06-14T17:04:55.848Z | `oseedoro@gmail.com` (superadmin) |

Les 3 suppressions sont regroupées dans une fenêtre de 17 minutes (16:48:44 → 17:05:23), avec **2 entrées `DELETE` supplémentaires** dans la même fenêtre, portant des noms très proches ("meya osee", "DORODORO osee") mais ne correspondant à aucun des 3 comptes orphelins actuels — cohérent avec un nettoyage manuel groupé de données de test/démo par le même compte superadmin, plutôt qu'un incident isolé par compte.

**Ce que ça confirme :** les 3 dossiers `Patient` ont bien été supprimés via le flux applicatif normal (`patients.controller.js::remove()`, qui journalise correctement l'action), pas via une intervention hors application. **Ce que ça n'explique pas complètement :** `remove()` supprime aussi le `User` lié dans la foulée (`User.deleteOne({ email: patient.email, role: 'patient' })`, ligne 388) quand le dossier n'a aucun historique clinique/financier — si cette suppression avait fonctionné, ces 3 comptes ne seraient pas orphelins aujourd'hui. Hypothèse la plus probable, non vérifiée formellement : une divergence entre `patient.email` et `user.email` au moment de la suppression (casse, espace, ou autre) a fait que `deleteOne({ email: patient.email, ... })` n'a matché aucun document — silencieusement, sans erreur.

**Limite de cette recherche** : la correspondance repose sur nom/prénom, pas sur un identifiant stable (le log `DELETE` ne capture ni email ni `donnees_avant`, contrairement aux contrôleurs étendus en Phase 7 P7.7 — R-17). Une collision de nom/prénom avec un tiers non lié à ce ticket est possible en théorie, mais peu probable ici vu la correspondance exacte à la casse près et le regroupement temporel serré avec les 2 autres suppressions de la même session.

## Contrainte structurelle — livrée (indépendamment de la décision sur les 3 comptes)

`backend/models/Patient.js` : hook `pre('findOneAndDelete')` (couvre `findByIdAndDelete`) qui refuse désormais la suppression d'un `Patient` tant qu'un `User` actif (`role: 'patient', statut: 'actif'`) le référence par `patient_id` — réponse 409 avec message explicite. S'applique à tout appelant, pas seulement `patients.controller.js::remove()`. Ne couvre pas `deleteMany` (utilisé par `utils/seed.js` pour une réinitialisation complète de la base — doit rester libre).

Testé dans `backend/tests/patientDeletionGuard.test.js` (3 sous-tests : blocage effectif, autorisé si le `User` lié est inactif, autorisé si aucun `User` ne référence le dossier). Suite complète (121 tests) verte après le changement — deux tests existants ont dû être ajustés pour respecter le nouvel invariant : `portalPatientIdResolution.test.js` (ordre de nettoyage User-avant-Patient dans un cas, contournement volontaire via le driver Mongo brut dans l'autre — ce dernier simule justement un état déjà cassé, antérieur à cette contrainte) et `patientIdLink.test.js` (même réordonnancement). Branche `feature/T0008-prevent-orphan-patient-deletion`, pas encore mergée.

Ceci empêche toute **récidive** du symptôme de ce ticket, mais ne change rien à l'état actuel des 3 comptes déjà orphelins — ils prédatent la contrainte.

## Décision requise (en attente)

Pour chacun des 3 comptes, au cas par cas :
- **Supprimer** le compte `User` orphelin (cohérent avec l'hypothèse « nettoyage de données de test/démo » ci-dessus — les 3 emails et le regroupement temporel avec 2 autres suppressions similaires le suggèrent), **ou**
- **Recréer** un dossier `Patient` minimal (`profil_a_completer: true`, même mécanisme que T3.1 pour les inscriptions Google) si l'un d'eux doit rester utilisable.

Piste complémentaire, non bloquante : un script d'audit périodique détectant les comptes patient orphelins (même requête que celle utilisée pour le constat initial), pour rattraper toute donnée déjà corrompue avant la contrainte structurelle.
