# Décision 0003 — Réconciliation des saisies patient en texte libre

**Statut :** À trancher (non décidé) — rédigé en Phase 2 §6.3, brief de continuation MediSync
**Décideur attendu :** responsable produit / métier (dossier patient longitudinal)

## Contexte

Deux régimes de référencement patient coexistent dans l'application :
- Référence stricte (`ObjectId` vers `Patient`) — utilisée par Consultation, Hospitalization, Invoice, la majorité des modules.
- Texte libre (`patient_nom`, parfois `patient_ref` facultatif) — utilisée par Echographie et une partie des Urgences, pour permettre une saisie rapide sans dossier préexistant (contexte de soins urgents notamment).

Ce choix est délibéré et documenté depuis l'audit initial (pas un bug), mais fragmente la vision "dossier patient unique" : deux enregistrements concernant la même personne peuvent ne jamais être reliés si la saisie en texte libre n'est jamais rapprochée d'un dossier `Patient` existant.

## Mécanisme de réconciliation envisagé (non implémenté)

- À la saisie d'un `patient_nom` en texte libre, recherche automatique dans `Patient` (nom + prénom + date de naissance, même logique de détection de doublon que `patients.controller.js::create`).
- Si une correspondance forte est trouvée : suggestion à l'utilisateur ("Ce patient existe déjà — lier ce dossier ?"), pas de liaison automatique silencieuse (risque d'erreur d'identité en contexte d'urgence).
- Si acceptée : renseigner `patient_ref`/`patient` en plus du texte libre, sans supprimer la saisie d'origine.
- Un job de réconciliation différée pourrait aussi traiter les enregistrements déjà existants non liés.

## Coût

- Logique de recherche/correspondance à ajouter dans `echographieController.js` et `urgencesController.js`.
- Composant d'interface pour la suggestion de liaison (nouveau, pas de précédent dans le code actuel).
- Décision produit sur le seuil de correspondance (nom+prénom seul est un signal faible ; nom+prénom+date de naissance plus fiable mais peut manquer des cas).

## Bénéfice

- Vision longitudinale unique du patient à travers tous les modules, y compris ceux qui acceptent aujourd'hui la saisie rapide.
- Réduction du risque de doublons de dossier invisible entre Urgences/Echographie et le reste de l'application.

## Option de statu quo

Ne rien changer. La saisie rapide en texte libre reste utile en contexte d'urgence (pas de dossier préexistant, personnel non disponible pour créer un dossier complet dans l'instant) ; c'est un compromis assumé, pas un défaut.

## Recommandation (non tranchée)

Pertinent à traiter si un besoin réel de reporting transverse patient (ex. historique complet toutes spécialités confondues) se heurte concrètement à cette fragmentation. Pas de préconisation d'implémentation immédiate sans ce signal.
