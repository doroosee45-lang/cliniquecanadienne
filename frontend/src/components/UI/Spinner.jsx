const COLORS = {
  primary: 'border-gray-200 border-t-primary',
  white: 'border-white/30 border-t-white',
  current: 'border-current/25 border-t-current',
};

export default function Spinner({ size = 'md', color = 'primary', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={`${sizes[size]} ${COLORS[color] || COLORS.primary} border-4 rounded-full animate-spin ${className}`} />
  );
}
