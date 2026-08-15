# Décision 0004 — Rôle `sage_femme` (T2.1)

**Statut :** Décidé — CONSERVER
**Décideur :** porteur métier (validé via l'agent de développement, faute d'accès direct)
**Date :** Phase 2, MediSync HIS

## Décision

Le rôle `sage_femme` est **conservé** dans l'énumération `User.role`. Aucune modification du modèle n'est nécessaire.

## Contexte — le constat R-00a du registre est obsolète

Le registre de constats utilisé pour bâtir cette phase (R-00a, volet données) décrit `sage_femme` comme un rôle référencé par le code métier (routes, menus) mais **absent** de l'énumération `User.role`, rendant le rôle inatteignable. C'était vrai au moment de l'audit technique initial de ce projet.

Ce n'est plus l'état du code : le rôle a été ajouté à l'énumération et propagé à l'ensemble des points qui le référencent lors d'une phase de correction antérieure à ce document. Vérification exhaustive refaite pour cette décision (et non simplement rappelée de mémoire) :

- **Modèle** : `backend/models/User.js` — `sage_femme` présent dans l'enum `role`.
- **Routes backend** (7 fichiers) : `dashboard`, `hr`, `settings`, `patients`, `maternity`, `pediatrie`, `echographie`, `urgences`, `ambulances` — toutes autorisent explicitement `sage_femme` là où c'est pertinent.
- **Contrôleurs** : `hr.controller.js` (table poste→rôle), `maternityController.js`, `dashboard.controller.js` (STAFF) — cohérents.
- **Frontend** (5 fichiers) : `App.jsx`, `Sidebar.jsx`, `Administration.jsx`, `Messages.jsx`, `Maternite.jsx` — badges, menus et permissions cohérents avec le rôle réel.
- **Tests** : couvert par `tests/accessMatrix.test.js` (accès Maternité/Pédiatrie autorisé, RH refusé), `tests/dashboard.fields.test.js` (présence dans l'enum), `tests/dataIntegrity.test.js` (création de compte).
- **Test de vérification de cette tâche** : création isolée d'un `User` avec `role:'sage_femme'` → succès, `u.role === 'sage_femme'` confirmé, compte nettoyé après coup.

**Aucun écart résiduel détecté.**

## Ce qui a été complété dans le cadre de cette tâche

`backend/utils/seed.js` ne comportait aucun compte de démonstration `sage_femme` — seul manque réel trouvé. Ajouté : un compte `User` (`sf.ngoyi@clinique-souanke.cg`) et sa fiche `Staff` correspondante (matricule `STAF-0014`, poste "Sage-femme", service Maternité), suivant exactement le patron des autres comptes de démonstration.

⚠️ Le script `seed.js` **vide entièrement la base de données** avant de la repeupler (`deleteMany()` sur toutes les collections). Il n'a **pas été exécuté** contre la base de développement actuelle dans le cadre de cette tâche — elle contient des données réelles accumulées sur plusieurs phases de travail, et l'exécuter les aurait détruites sans nécessité. Seule la syntaxe du script a été vérifiée (`node --check`). À exécuter volontairement par l'équipe lorsqu'une réinitialisation complète de l'environnement de démonstration sera souhaitée.

## Propagation Phases 6/7

Sans objet — la propagation aux routes (Phase 6) et au frontend (Phase 7) a déjà eu lieu, comme démontré ci-dessus. Rien à reporter à ces phases pour ce point.
