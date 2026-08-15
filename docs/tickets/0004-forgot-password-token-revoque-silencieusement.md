# Ticket 0004 — `forgot-password` révoque silencieusement le token si l'envoi de l'email échoue, tout en répondant « succès »

**Statut :** Ouvert — non corrigé (constat de vérification §3.5(a), hors périmètre des tâches T3.1-T3.4)
**Origine :** Phase 3, §3.5(a) — test de non-régression `backend/tests/passwordReset.test.js`
**Sévérité :** Moyenne — pas une faille de sécurité (le choix de ne pas distinguer les deux cas dans la réponse HTTP est volontaire et correct : éviter l'énumération de comptes). C'est un défaut de fiabilité fonctionnelle : l'utilisateur reçoit un message de succès alors qu'aucun lien de réinitialisation fonctionnel n'existe.

## Constat

`controllers/auth.controller.js::forgotPassword` (lignes 49-61) :

```js
const token  = crypto.randomBytes(32).toString('hex');
user.reset_password_token  = token;
user.reset_password_expire = new Date(Date.now() + 60 * 60 * 1000); // 1 h
await user.save({ validateBeforeSave: false });

try {
  await sendPasswordResetEmail({ email: user.email, prenom: user.prenom, nom: user.nom, token });
} catch (mailErr) {
  user.reset_password_token  = undefined;
  user.reset_password_expire = undefined;
  await user.save({ validateBeforeSave: false });
  console.error('[MAIL] Erreur envoi reset password:', mailErr.message);
}
```

Le token est généré et posé en DB, **puis retiré silencieusement** si `sendPasswordResetEmail` échoue (SMTP indisponible, domaine destinataire rejeté, etc.). Dans les deux cas — succès ou échec d'envoi — la réponse HTTP renvoyée au client est identique :

```js
const MSG = 'Si cet email existe, un lien de réinitialisation a été envoyé.';
res.json({ success: true, message: MSG });
```

Constaté empiriquement pendant la rédaction de `tests/passwordReset.test.js` (Phase 3, §3.5a) : un email de test sur un domaine non livrable (`_test.local`) déclenche systématiquement l'échec SMTP réel, et donc la révocation du token — obligeant le test à simuler l'état « token posé avec succès » directement en base plutôt que de dépendre de l'appel HTTP réel pour cette partie du scénario.

## Pourquoi ce n'est pas corrigé ici

Hors périmètre des tâches T3.1 à T3.4 ; découvert comme effet de bord du test de non-régression écrit pour §3.5(a), qui demande de documenter, pas de corriger, les constats hors périmètre.

## Pistes pour correction future

Le choix de ne jamais révéler dans la réponse HTTP si l'email existe ou si l'envoi a échoué est correct et à conserver (anti-énumération). La correction porte uniquement sur l'observabilité côté exploitant, pas sur le comportement perçu par l'utilisateur :

1. Journaliser l'échec via `logAction` (module `auth`, statut `echec`), pas seulement `console.error` — actuellement invisible dans le journal d'audit applicatif.
2. Envisager une alerte opérationnelle (ex. seuil d'échecs SMTP consécutifs) plutôt qu'un changement de la réponse HTTP, pour ne pas réintroduire de fuite d'information.
