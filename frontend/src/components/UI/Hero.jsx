import { RefreshCw } from 'lucide-react';

export default function Hero({
  icon: Icon,
  roleColor = 'var(--accent)',
  eyebrow = null, // pas de texte par défaut : "Bienvenue," n'a de sens que
                   // pour un vrai bandeau d'accueil personnel (Dashboard) —
                   // toutes les autres pages sont des titres de module et
                   // doivent le passer explicitement si elles en veulent un.
  title,
  badge,        // { icon, label } — pilule de rôle ; omise si non fournie
  dateLabel,
  pulseIcon = false, // avatar en respiration douce (ex. icône IA "vivante")
  right,        // ReactNode — statut / actions propres à la page
  className = '',
}) {
  return (
    <div className={`hero ${className}`}>
      <div className="hero-content flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className={`hero-avatar ${pulseIcon ? 'pulse' : ''}`} style={{ background: `${roleColor}22`, border: `2px solid ${roleColor}44` }}>
              <Icon size={28} style={{ color: roleColor }} />
            </div>
          )}
          <div>
            {eyebrow && <div className="hero-eyebrow">{eyebrow}</div>}
            <div className="hero-title">{title}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {badge && (
                <span className="hero-badge" style={{ background: `linear-gradient(135deg, ${roleColor}, ${roleColor}99)` }}>
                  {badge.icon && <badge.icon size={12} />} {badge.label}
                </span>
              )}
              {/* Le point ne sépare que badge et date — pas de préfixe orphelin
                  quand dateLabel est utilisé seul comme sous-titre de page. */}
              {dateLabel && <span className="hero-date">{badge ? '· ' : ''}{dateLabel}</span>}
            </div>
          </div>
        </div>
        {right && <div className="flex items-center gap-3 flex-wrap">{right}</div>}
      </div>
    </div>
  );
}

export function HeroStatus({ connected, connectedLabel = 'Temps réel actif', idleLabel = 'Actualisation auto', icon: Icon }) {
  return (
    <div className={`hero-status ${connected ? 'is-connected' : ''}`}>
      {Icon ? <Icon size={14} /> : <span className="hero-status-dot" />}
      <span>{connected ? connectedLabel : idleLabel}</span>
    </div>
  );
}

export function HeroButton({ icon: Icon = RefreshCw, label, onClick }) {
  return (
    <button className="hero-btn-ghost" onClick={onClick}>
      <Icon size={14} />
      {label}
    </button>
  );
}

// Raccourci pour le cas Dashboard exact (icône + libellé par défaut) —
// HeroButton reste le nom générique pour toute autre action (imprimer,
// filtrer, exporter...) posée sur un Hero.
export function HeroRefreshButton({ onClick, label = 'Actualiser' }) {
  return <HeroButton icon={RefreshCw} label={label} onClick={onClick} />;
}
