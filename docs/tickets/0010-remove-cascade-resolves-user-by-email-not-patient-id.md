# Ticket 0010 — `patients.controller.js::remove()` retrouve le compte `User` lié par email, pas par `patient_id`

**Statut :** Ouvert — non corrigé
**Origine :** Vérification demandée avant clôture du ticket 0008, sur la mécanique exacte de suppression en cascade
**Sévérité :** Moyenne — c'est le mécanisme confirmé à l'origine des 3 comptes orphelins du ticket 0008 (pas une hypothèse théorique), et rien n'empêche une récidive sur un futur cas de désynchronisation email

## Constat

`backend/controllers/patients.controller.js::remove()` retrouve le `User` lié à un `Patient` par correspondance d'email, aux **deux** endroits où il agit sur ce compte :

```js
// ligne 373-375 — branche « désactivation » (patient avec historique)
if (patient.email) {
  await User.findOneAndUpdate({ email: patient.email, role: 'patient' }, { statut: 'inactif' });
}
```
```js
// ligne 387-389 — branche « suppression réelle » (aucun historique)
if (patient.email) {
  await User.deleteOne({ email: patient.email, role: 'patient' });
}
```

Aucune des deux ne passe par `User.patient_id` (référence `ObjectId` stable, introduite en T2.2 et déjà utilisée comme source de vérité prioritaire par `portal.controller.js` depuis R-07). Les deux résolvent par `patient.email`, qui :
- peut diverger de `user.email` si l'un des deux documents est modifié indépendamment de l'autre après la création (aucune contrainte de synchronisation entre les deux) ;
- ne matche silencieusement rien si l'email a divergé — `findOneAndUpdate`/`deleteOne` sur un filtre qui ne trouve aucun document ne lève aucune erreur, `remove()` continue normalement et répond `success: true` au staff, qui n'a aucune indication que le compte lié n'a pas été traité.

## Confirmation que ce n'est pas théorique

C'est le mécanisme confirmé (pas supposé) à l'origine des 3 comptes orphelins du ticket 0008 : l'investigation `AuditLog` a montré que les 3 dossiers `Patient` ont bien été supprimés via ce `remove()`, par un compte superadmin, sans erreur ni entrée d'échec journalisée — cohérent avec un `User.deleteOne({ email: patient.email, ... })` qui a matché zéro document à ce moment-là pour les 3, sans le signaler.

## Interaction avec la contrainte structurelle du ticket 0008 — ce qu'elle couvre, ce qu'elle ne couvre pas

Le hook `pre('findOneAndDelete')` ajouté sur `Patient` (ticket 0008) bloque la suppression d'un `Patient` tant qu'un `User` actif le référence **par `patient_id`** — une vérification indépendante de l'email, donc robuste à ce bug précis pour les comptes dont `patient_id` est bien peuplé. Concrètement :
- **Couvert** : un `Patient` dont l'email a divergé de son `User` lié, mais dont le `User` a toujours `patient_id` peuplé et `statut: 'actif'` → la suppression du `Patient` est bloquée par la contrainte, même si le `deleteOne` par email de `remove()` aurait, lui, échoué silencieusement.
- **Non couvert** : un `User` dont `patient_id` n'est **pas** peuplé (situation déjà documentée comme fréquente — 4 comptes sur 7 constatés lors de l'audit R-07) n'est jamais vu par la contrainte structurelle, puisqu'elle ne peut interroger que ce que `patient_id` référence. Pour ces comptes-là, la suppression du `Patient` passe sans blocage, et le nettoyage du `User` lié dépend entièrement de la correspondance email — exactement le chemin qui a produit les 3 orphelins du ticket 0008.

Autrement dit : la contrainte structurelle réduit le risque mais ne le ferme pas. Ce ticket porte sur la correction de la cascade elle-même, pas sur un doublon de 0008.

## Correctif proposé (non implémenté — ticket ouvert, décision différée)

Faire résoudre les deux branches par `patient_id` en priorité, avec repli sur l'email uniquement si `patient_id` n'est pas peuplé (même philosophie que la migration R-07 de `portal.controller.js`, pas une réinvention) :

```js
const linkedUser = await User.findOne({ patient_id: patient._id, role: 'patient' })
  || await User.findOne({ email: patient.email, role: 'patient' });
```

Points à trancher avant d'implémenter (pas encore fait, volontairement laissé à une passe dédiée) :
- Faut-il journaliser une anomalie (`DATA_ANOMALY`, même pattern que le repli de `portal.controller.js`) quand ni `patient_id` ni email ne résolvent, pour éviter de reproduire silencieusement un futur ticket 0008 ?
- Le même problème existe-t-il ailleurs dans le contrôleur (`activate`, `activateAdmin`, etc.) ou seulement dans `remove()` — pas vérifié dans cette passe, à auditer avant de corriger.
