# Ticket 0002 — Indicateur frontend « profil incomplet » pour les dossiers Google

**Statut :** Ouvert — non corrigé (hors périmètre de T3.1, backend uniquement)
**Origine :** Phase 3, T3.1 (création automatique du dossier Patient à l'inscription Google)
**Sévérité :** Faible — fonctionnel, pas de risque de sécurité ou d'intégrité.

## Constat

Depuis T3.1, un dossier `Patient` créé automatiquement à la première connexion Google porte `profil_a_completer: true` et n'a ni `date_naissance` ni `sexe` renseignés (ces deux champs deviennent optionnels uniquement dans ce cas précis — voir `models/Patient.js` et l'ADR Google OAuth de la Phase 3).

Le backend expose cette information (`patient.profil_a_completer`) mais **aucun écran frontend ne l'affiche actuellement** :
- Le portail patient (`Portal.jsx`) ne montre aucun message ni badge invitant le patient à compléter son profil.
- Les écrans internes (`Patients.jsx`, `PatientDetail.jsx`) ne signalent pas non plus qu'un dossier est incomplet — un(e) réceptionniste ou soignant consultant ce dossier ne voit rien d'anormal alors que des champs cliniques de base manquent.

## Pourquoi non traité dans T3.1

T3.1 est explicitement scopé au backend (`backend/controllers/googleAuth.controller.js`, modèle `User`/`Patient`) — aucune modification frontend n'était dans son périmètre.

## Correction recommandée (non appliquée)

1. **Portail patient** : bannière ou modal bloquant(e) invitant à renseigner date de naissance/sexe (et idéalement les autres champs utiles : téléphone, adresse) tant que `profil_a_completer` est vrai — probablement au même endroit que le flux `must_change_password` déjà existant, dont le mécanisme de blocage de navigation peut servir de modèle.
2. **Écrans internes** (`Patients.jsx`, `PatientDetail.jsx`) : badge visuel (ex. pastille orange « Profil à compléter ») sur la fiche patient concernée, pour que le personnel d'accueil sache qu'il doit compléter le dossier au prochain contact avec ce patient.

## Test de vérification proposé pour la correction

- Un compte créé via Google Auth affiche la bannière de complétion à la connexion suivante sur le portail, et celle-ci disparaît une fois `date_naissance`/`sexe` renseignés (`profil_a_completer` repassé à `false` côté backend, à prévoir dans le même lot que la correction frontend).
- La fiche patient correspondante affiche le badge « Profil à compléter » dans `Patients.jsx`/`PatientDetail.jsx`.
