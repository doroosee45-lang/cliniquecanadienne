import { RefreshCw } from 'lucide-react';

export default function Hero({
  icon: Icon,
  roleColor = 'var(--accent)',
  eyebrow = 'Bienvenue,',
  title,
  badge,        // { icon, label } — pilule de rôle ; omise si non fournie
  dateLabel,
  right,        // ReactNode — statut / actions propres à la page
  className = '',
}) {
  return (
    <div className={`hero ${className}`}>
      <div className="hero-content flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="hero-avatar" style={{ background: `${roleColor}22`, border: `2px solid ${roleColor}44` }}>
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
              {dateLabel && <span className="hero-date">· {dateLabel}</span>}
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

export function HeroRefreshButton({ onClick, label = 'Actualiser' }) {
  return (
    <button className="hero-btn-ghost" onClick={onClick}>
      <RefreshCw size={14} />
      {label}
    </button>
  );
}
