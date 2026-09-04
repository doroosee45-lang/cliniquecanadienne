import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';

// AUDIT-C3 (ticket 0003, piste 3) — must_change_password était déjà
// positionné côté backend (hr.controller.js à la création d'un compte staff,
// case à cocher dans Administration.jsx pour settings.controller.js::
// createUser/updateUser) et déjà renvoyé par /auth/login et /auth/me, mais
// n'avait jusqu'ici aucun effet pratique côté personnel : contrairement au
// portail patient (Portal.jsx), rien ne bloquait la navigation tant que le
// mot de passe temporaire n'était pas changé. Monté une fois dans
// Layout.jsx — donc actif sur toutes les pages authentifiées du personnel,
// pas seulement une page dédiée. Non fermable tant que le flag est vrai,
// même principe que la modale de Portal.jsx.
export default function MustChangePasswordGate() {
  const { user, setUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirm, setConfirm]                 = useState('');
  const [error, setError]                     = useState('');
  const [saving, setSaving]                   = useState(false);

  if (!user?.must_change_password) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (newPassword.length < 6) { setError('Le nouveau mot de passe doit avoir au moins 6 caractères.'); return; }
    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setUser(u => ({ ...u, must_change_password: false }));
      toast.success('Mot de passe mis à jour.');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">🔒 Changement de mot de passe requis</h2>
        <p className="mt-1 text-sm text-gray-500">
          Votre compte a été créé avec un mot de passe temporaire. Définissez un nouveau mot de passe pour continuer.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Mot de passe actuel (temporaire)</label>
            <input type="password" required autoFocus value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nouveau mot de passe (min. 6 caractères)</label>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Confirmer le nouveau mot de passe</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={saving}
            className="mt-1 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'En cours...' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
