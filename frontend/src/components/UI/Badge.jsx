const VARIANTS = {
  blue: 'badge-blue', green: 'badge-green', yellow: 'badge-yellow',
  red: 'badge-red', purple: 'badge-purple', gray: 'badge-gray',
  cyan: 'badge-cyan', orange: 'badge-orange',
};

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`badge ${VARIANTS[variant] || 'badge-gray'} ${className}`}>
      {children}
    </span>
  );
}

export const StatusBadge = ({ statut }) => {
  const map = {
    actif: ['green','Actif'], inactif: ['gray','Inactif'], suspendu: ['red','Suspendu'],
    planifie: ['blue','Planifié'], confirme: ['green','Confirmé'], en_attente: ['yellow','En attente'],
    en_cours: ['blue','En cours'], termine: ['green','Terminé'], annule: ['red','Annulé'],
    absent: ['gray','Absent'], payee: ['green','Payée'], emise: ['yellow','Émise'],
    partiellement_payee: ['orange','Part. payée'], libre: ['green','Libre'],
    occupe: ['red','Occupé'], maintenance: ['yellow','Maintenance'],
    prescrit: ['blue','Prescrit'], valide: ['green','Validé'], active: ['green','Active'],
    disponible: ['green','Disponible'], rupture: ['red','Rupture'],
  };
  const [variant, label] = map[statut] || ['gray', statut];
  return <Badge variant={variant}>{label}</Badge>;
};
