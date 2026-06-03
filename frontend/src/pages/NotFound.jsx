import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: 'Poppins, sans-serif', background: '#f0f4f8' }}>
      <div className="text-center max-w-md px-6">
        <div className="text-8xl mb-6">🏥</div>
        <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
        <h2 className="text-xl font-bold text-gray-700 mb-3">Page introuvable</h2>
        <p className="text-gray-400 mb-8">La page que vous cherchez n'existe pas ou a été déplacée.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary">← Retour</button>
          <button onClick={() => navigate('/')} className="btn-primary">🏠 Tableau de bord</button>
        </div>
      </div>
    </div>
  );
}
