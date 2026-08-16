# Ticket 0003 — `must_change_password` jamais positionné pour les comptes staff, aucun blocage UI équivalent côté interface professionnelle

**Statut :** Ouvert — non corrigé (constat de vérification §3.5, hors périmètre des tâches T3.1-T3.4)
**Origine :** Phase 3, §3.5(c) — vérification que `must_change_password` bloque effectivement la navigation
**Sévérité :** Ce ticket regroupe deux constats de sévérité distincte, à ne pas confondre :
- **`hr.controller.js::create` — Élevée (blocage fonctionnel à l'onboarding).** Ce n'est pas qu'une incohérence de sécurité : le mot de passe généré (`` `Clinique${crypto.randomBytes(4).toString('hex')}!` ``) n'est retourné nulle part (ni réponse HTTP, ni log, ni email) — **aucune personne ne peut le connaître**, pas même l'administrateur qui vient de créer le compte. Un compte staff créé via le module RH avec un email est donc **inutilisable dès sa création** tant qu'un administrateur ne passe pas explicitement par `PATCH /settings/users/:id` pour lui fixer un mot de passe connu. C'est un défaut opérationnel qui bloque l'arrivée de tout nouvel employé passant par ce flux, pas une simple absence de bonne pratique.
- **`settings.controller.js::createUser` et absence de blocage UI staff — Moyenne.** Ici le mot de passe est bien connu (saisi par l'admin dans le formulaire), donc le compte est utilisable ; le gap est que rien n'oblige à le changer à la première connexion, contrairement au portail patient. Hygiène de sécurité manquante, pas un blocage fonctionnel.

## Constat

Le champ `must_change_password` existe sur `User` et dispose d'une application **réelle et fonctionnelle**, mais **uniquement côté portail patient** :

- `controllers/patients.controller.js:108` le positionne à `true` lors de la création d'un dossier patient avec mot de passe temporaire par la réception.
- `frontend/src/pages/Portal.jsx` consomme le flag (`selectMustChangePassword` dans `portalSlice.js`) pour ouvrir une modale de changement de mot de passe **non fermable tant que le flag est vrai** (`onClose={() => !mustChangePwd && setModalChangePwd(false)}`, bouton Annuler masqué).

En revanche, `must_change_password` **n'est jamais positionné à `true` pour un compte staff** :

- `controllers/hr.controller.js:85-92` — création d'un compte `User` lié à une fiche RH (`Staff`), avec un mot de passe généré aléatoirement (`` `Clinique${crypto.randomBytes(4).toString('hex')}!` ``) mais **sans jamais définir `must_change_password`**. Pire : ce mot de passe généré n'est **ni retourné dans la réponse HTTP, ni journalisé, ni envoyé par email** — aucune trace de sa valeur nulle part après sa génération. En l'état, un compte staff créé via le module RH avec un email fourni est donc créé avec un mot de passe qu'aucune personne (ni l'administrateur qui a créé le compte, ni le nouvel employé) ne peut connaître, sauf réinitialisation ultérieure via `PATCH /settings/users/:id` (`settings.controller.js::updateUser`).
- `controllers/settings.controller.js:38-44` (`createUser`) — transmet `req.body` tel quel à `User.create()` ; le mot de passe est celui saisi par l'administrateur dans le formulaire `Administration.jsx`, et `must_change_password` n'est positionné que si le frontend le transmet explicitly (non constaté dans `administrationSlice.js`/`Administration.jsx`).

Côté frontend, **aucune occurrence** de `must_change_password` / `mustChangePassword` n'existe dans `App.jsx` ou tout composant de layout staff — il n'existe donc aucun mécanisme de blocage équivalent à la modale de `Portal.jsx` pour les comptes professionnels, même si le champ était positionné.

## Pourquoi ce n'est pas corrigé ici

Hors périmètre des tâches T3.1 à T3.4 (qui portent sur Google OAuth, exposition du mot de passe patient, et verrouillage de compte) ; découvert comme effet de la vérification §3.5 demandée par le brief Phase 3, qui demande explicitement de **documenter**, pas de corriger, les constats hors périmètre.

## Pistes pour correction future

1. `hr.controller.js::create` : positionner `must_change_password: true` sur le `User` créé, et transmettre le mot de passe généré à l'appelant (réponse HTTP, à charge pour l'admin de le communiquer de façon sécurisée) — cohérent avec le pattern déjà utilisé par `utils/create-user.js` (script CLI).
2. `settings.controller.js::createUser` : ajouter une case à cocher « forcer le changement de mot de passe à la première connexion » dans `Administration.jsx`, transmise au backend.
3. Ajouter, côté frontend staff (`App.jsx` ou un layout partagé), un mécanisme de blocage analogue à celui de `Portal.jsx` — actuellement le flag n'aurait aucun effet pratique même s'il était positionné pour un compte staff.
