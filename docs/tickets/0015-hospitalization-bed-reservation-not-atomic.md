# Ticket 0015 — Réservation de lit non atomique dans `hospitalization.controller.js::create`

**Statut :** Ouvert — non corrigé
**Origine :** Constaté en marge de la correction P7-1/P7-2 (audit Phases 2-9, branche `fix/audit2-9-p7-1-2-hospitalisation`), explicitement hors périmètre de cette branche
**Sévérité :** Élevée — condition de course réelle sur une ressource physique (lit), pas une hypothèse théorique ; aucun test de concurrence n'existe pour ce chemin

## Constat

`backend/controllers/hospitalization.controller.js::create` réserve un lit en trois étapes non atomiques :

```js
const room = await Room.findById(req.body.chambre);
const bed  = room.lits.find(l => l.numero === req.body.lit_numero);
if (bed.statut !== 'libre') return res.status(400)...;
bed.statut = 'occupe';
bed.patient_actuel = ...;
await room.save();
```

Entre la lecture (`findById`) et l'écriture (`save()`), rien n'empêche une seconde requête concurrente de lire le même document `Room` avant que la première ait sauvegardé — les deux passeraient la vérification `bed.statut !== 'libre'` (toujours `'libre'` au moment de leur lecture respective), et la seconde écriture écraserait silencieusement la première. Deux admissions simultanées sur le même lit peuvent donc toutes deux réussir côté application, avec un seul `save()` faisant réellement foi en base.

Aucun verrou optimiste, aucune transaction, aucun `findOneAndUpdate` avec filtre positionnel sur le sous-document `lits`.

## Pourquoi ce n'est pas une hypothèse théorique

Le même type de risque (compteur/ressource partagée mise à jour par lecture-puis-écriture non atomique) a déjà été confirmé exploitable sur ce projet pour `numero_dossier`/`numero_rx` (T2.3), corrigé par un compteur atomique et verrouillé par un test réel à 20 accès concurrents. Aucun correctif ni test équivalent n'existe pour la réservation de lit — le mécanisme est structurellement identique (lecture d'un état partagé, décision, écriture différée), donc le même risque s'applique tant qu'il n'est pas testé et corrigé de la même manière.

## Pourquoi ce n'est pas traité ici

Découvert en marge de P7-1/P7-2 (routage `PUT /:id`/`discharge`, sous-ressources du dossier de séjour) — hors du périmètre strict demandé pour cette branche, qui portait sur le routage et non sur la logique d'admission elle-même.

## Piste de correction

Remplacer la séquence lecture-décision-écriture par une mise à jour atomique avec filtre positionnel, sur le modèle déjà validé pour `numero_dossier` :

```js
const room = await Room.findOneAndUpdate(
  { _id: req.body.chambre, 'lits.numero': req.body.lit_numero, 'lits.statut': 'libre' },
  { $set: { 'lits.$.statut': 'occupe', 'lits.$.patient_actuel': patient._id } },
  { new: true }
);
if (!room) return res.status(409).json({ success:false, message:'Ce lit n'est plus disponible.' });
```

Un `0` document modifié (filtre qui ne matche plus parce qu'un autre process a déjà pris le lit) doit être traité comme un échec explicite (409), pas comme un cas silencieusement absorbé.

À couvrir par un test de concurrence réelle (plusieurs admissions simultanées sur le même lit, une seule doit réussir), sur le même principe que `backend/tests/` pour T2.3.
