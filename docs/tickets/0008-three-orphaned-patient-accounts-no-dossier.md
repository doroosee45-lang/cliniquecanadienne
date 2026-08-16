# Ticket 0008 — Trois comptes patient réels sans aucun dossier `Patient` associé

**Statut :** Ouvert — non corrigé (hors périmètre de R-07, qui l'a découvert)
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

## Pourquoi non corrigé maintenant

Découvert pendant l'étape de vérification préalable de R-07 (comptage `patient_id` avant migration de `portal.controller.js`) — corriger des comptes de test orphelins n'est pas le périmètre de R-07, qui porte sur l'ordre de résolution `patient_id`/email, pas sur la présence d'un dossier. Décision explicite de l'utilisateur : ticket séparé, pas de correctif dans cette passe.

## Pistes pour une correction future

- Décider au cas par cas : supprimer ces comptes `User` orphelins (s'ils sont bien des artefacts de test), ou leur créer un dossier `Patient` minimal (`profil_a_completer: true`, même mécanisme que T3.1 pour les inscriptions Google) s'ils doivent rester utilisables.
- Plus largement : envisager une contrainte structurelle empêchant la suppression d'un `Patient` tant qu'un `User` actif (`role: 'patient'`) le référence encore par `patient_id` — ou au minimum, un script d'audit périodique détectant les comptes patient orphelins (même requête que celle utilisée pour ce constat, à réutiliser telle quelle).
