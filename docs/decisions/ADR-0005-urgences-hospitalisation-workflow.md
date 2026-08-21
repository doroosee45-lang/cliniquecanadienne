# ADR-0005 — Workflow Urgences → Hospitalisation

**Statut :** Acceptée et implémentée (2026-08-21).
**Contexte :** Plan directeur MediSync (26 phases), Phase 4 — priorité critique.
**Supersède :** Ticket 0018 (option 2, référence `urgence_id` optionnelle sans automatisme), implémentée le même jour puis remplacée par la présente décision sur demande explicite, avant tout usage réel en dehors des tests.

## Contexte

`backend/models/Urgence.js` déclare un champ `decision` (`enum: ['retour_domicile','hospitalisation','transfert','deces','']`) et un `statut` incluant `'hospitalise'`. Ces valeurs suggèrent qu'une décision d'hospitalisation prise depuis les urgences devrait produire — ou au moins tracer explicitement — un passage vers un dossier `Hospitalization`. Jusqu'ici (ticket 0018), aucun couplage n'existait : deux modules strictement indépendants, ne partageant qu'une référence à `Patient`.

## Problème

Un patient admis aux urgences puis hospitalisé doit être ressaisi intégralement dans le module Hospitalisation, sans lien tracé vers son passage aux urgences, sans visibilité côté urgences sur l'avancement de cette admission, et sans protection contre une double création (deux membres du personnel, ou un double clic, créant deux dossiers d'hospitalisation pour le même épisode).

## Options étudiées

1. **Ne rien faire** — statu quo, ressaisie manuelle intégrale. Écarté : ne répond pas à la priorité critique du plan directeur.
2. **Référence optionnelle simple** (`Hospitalization.urgence_id`, sans automatisme ni suivi d'état) — implémentée une première fois (ticket 0018), proportionnée à un besoin de simple traçabilité a posteriori, mais ne modélise pas le workflow métier réel (décision → préparation → admission) ni ne protège contre une double admission.
3. **Workflow complet avec validation humaine explicite à chaque étape** — retenue. Modélise l'état réel du parcours (`Urgence.admission_status`), sans jamais automatiser la création de l'hospitalisation elle-même.

## Décision

Le couplage reste **piloté par une action humaine à chaque étape** — aucune hospitalisation n'est jamais créée automatiquement à la seule pose de `decision:'hospitalisation'`. Le workflow modélisé :

```
Urgences → Évaluation → Décision médicale (Urgence.decision='hospitalisation')
   → Hospitalisation demandée (Urgence.admission_status='preparation', automatique)
   → Préparation admission (action humaine — hors périmètre de ce correctif, voir "Ce qui n'est pas fait")
   → Réservation lit (hospitalization.controller.js::create, déjà atomique — AUDIT-P7-5)
   → Création hospitalisation (Urgence.admission_status='terminee', automatique)
   → Admission
```

### Quand créer l'hospitalisation

Jamais automatiquement. Seulement quand un membre du personnel autorisé soumet le formulaire d'admission (`POST /hospitalization`) avec `urgence_id` renseigné.

### Qui peut la créer / qui la valide

Aucun nouveau rôle introduit — les permissions déjà en place sur `POST /hospitalization` (`superadmin, adminclinique, medecin, infirmier` — `hospitalization.routes.js`) s'appliquent inchangées. La "validation" est l'acte de soumission du formulaire d'admission lui-même par un rôle déjà autorisé ; aucune double validation séparée n'est ajoutée (jugé disproportionné : cela dupliquerait un contrôle déjà exercé par le RBAC existant).

### Comment elle est liée aux urgences

`Hospitalization.urgence_id` (`ObjectId`, `ref: 'Urgence'`, optionnel — ticket 0018) reste la seule référence structurelle. `Urgence.admission_status` (nouveau champ, cf. modèle) reflète l'avancement côté dossier urgences, pour affichage/suivi, sans dupliquer l'identifiant lui-même.

### Que faire si aucun lit n'est disponible

Comportement inchangé et déjà correct : `hospitalization.controller.js::create` retourne 409 (lit non disponible) ou 404 (chambre/lit introuvable) — l'échec de réservation ne modifie ni `Urgence.decision` ni `admission_status`, qui reste `'preparation'` : le personnel peut réessayer avec une autre chambre sans perdre l'état d'avancement.

### Comment l'annuler

Si la décision d'hospitaliser est retirée (`decision` changé vers une autre valeur) **avant** toute création réelle, `admission_status` repasse automatiquement à `'annulee'` (`urgencesController.js::update`). Une fois `admission_status:'terminee'` (hospitalisation réellement créée), plus aucune transition automatique n'a lieu : annuler une hospitalisation réelle relève du module Hospitalisation lui-même (sortie, transfert), pas de ce workflow de préparation.

### Comment tracer l'opération

`logAction` existant sur `hospitalization.controller.js::create` (action `CREATE`, module `hospitalization`) couvre déjà la création ; le champ `urgence_id` dans le document créé permet de retrouver le passage aux urgences d'origine à tout moment (`Hospitalization.findOne({urgence_id})`), sans duplication d'ID contraire au principe "une donnée maître = une seule source de vérité" du plan directeur.

## Conséquences

- `backend/models/Urgence.js` — nouveau champ `admission_status` (enum, défaut `'non_requise'`).
- `backend/controllers/urgencesController.js::update` — gère les transitions automatiques `non_requise ↔ preparation ↔ annulee` ; `admission_status` retiré des champs modifiables directement par le client (même traitement que `soins/prescriptions/examens/timeline`).
- `backend/controllers/hospitalization.controller.js::create` — refuse une seconde hospitalisation active pour le même `urgence_id` (409) ; marque `admission_status:'terminee'` sur succès.
- Aucune automatisation de la création elle-même : `urgencesController.js` ne référence jamais `Hospitalization`, conformément au principe déjà établi (éviter le couplage fort entre modules cliniques indépendants).

## Ce qui n'est PAS fait par cette décision

Le déclencheur humain ("bouton Préparer l'admission" dans l'interface Urgences, pré-remplissage du formulaire d'hospitalisation depuis le dossier urgences) n'est **pas implémenté** : `frontend/src/pages/Urgences.jsx` est un fichier explicitement hors périmètre (travail actif de l'utilisateur — cf. ticket 0019). L'API et le modèle de données sont prêts à recevoir ce déclencheur dès que ce fichier redevient modifiable ; en attendant, le personnel navigue manuellement vers le module Hospitalisation et renseigne `urgence_id` lui-même (déjà possible, testé).
