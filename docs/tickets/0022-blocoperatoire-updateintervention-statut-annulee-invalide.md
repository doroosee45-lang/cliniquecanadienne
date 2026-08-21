# Ticket 0022 — `blocoperatoireController.updateIntervention` rejette `statut:'annulee'` (enum invalide)

**Statut :** Ouvert — non corrigé, hors périmètre de la tâche en cours (ADR-0006)
**Origine :** Vérification navigateur réel de l'ADR-0006 (nettoyage d'un dossier de test)
**Sévérité :** Moyenne — bloque une action UI légitime (annuler une intervention programmée)

## Constat

Le formulaire d'édition d'une intervention (`frontend/src/pages/Blocoperatoire.jsx:1058-1065`, section "Informations générales") propose un statut `annulee` dans le `<select>` :

```
<option value="programmee">📅 Programmée</option>
<option value="preparation">🔧 En préparation</option>
<option value="en_cours">🔪 En cours</option>
<option value="reveil">💊 Salle de réveil</option>
<option value="terminee">✅ Terminée</option>
<option value="annulee">❌ Annulée</option>
```

Sélectionner "Annulée" puis "Enregistrer" échoue systématiquement :

```
400 { "success": false, "message": "`annulee` is not a valid enum value for path `statut`." }
```

## Cause

`backend/controllers/blocoperatoireController.js::createIntervention` traduit le vocabulaire UI vers l'enum réel du modèle via `toModelStatut()` (`{ programmee:'preoperatoire', en_cours:'opere', terminee:'opere', reveil:'suivi_postop', annulee:'consultation' }`) avant d'écrire `dossier.statut`.

`updateIntervention` (`PUT /blocoperatoire/planning/:id`) ne fait pas cette traduction : il applique directement `req.body.statut` (une valeur du vocabulaire UI) via `findByIdAndUpdate`, alors que `DossierChirurgical.statut` n'accepte que `['consultation','preoperatoire','opere','suivi_postop','cloture']` (aucune valeur `annulee`, `programmee`, `en_cours`, `reveil`, `terminee` n'existe dans cet enum). Toute valeur UI qui ne coïncide pas déjà avec l'enum réel (`programmee`, `en_cours`, `reveil`, `terminee`, `annulee`) échoue silencieusement côté formulaire avec un 400.

## Ce qui a été vérifié

Reproduit en base réelle (dev, via navigateur) lors du nettoyage d'un dossier de test créé pour l'ADR-0006 : sélection "Annulée" dans l'édition d'une intervention existante → 400 confirmé par la réponse API. Contournement utilisé pour ce nettoyage précis : passer par le module Chirurgie (`chirurgieController.updateDossier`, qui n'a pas ce problème de traduction) pour positionner `statut:'cloture'` directement sur le même document `DossierChirurgical`.

## Pistes pour décision future

1. Appliquer `toModelStatut()` dans `updateIntervention` avant l'écriture, comme déjà fait dans `createIntervention` — correction la plus proportionnée, cohérente avec le code existant.
2. Étendre l'enum `DossierChirurgical.statut` pour accepter directement le vocabulaire UI du bloc — écarté a priori : réintroduirait une divergence entre le vocabulaire "métier" (consultation/preoperatoire/opere/suivi_postop/cloture, utilisé aussi par le module Chirurgie) et le vocabulaire bloc, l'inverse de ce que `toModelStatut()` cherche à unifier.

Non corrigé ici — hors périmètre de l'ADR-0006 (renommage de champ), qui ne touche pas à la logique de transition de statut. À traiter séparément.
