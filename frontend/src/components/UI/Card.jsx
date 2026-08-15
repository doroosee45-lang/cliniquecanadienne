export default function Card({ children, stat = false, padding = true, className = '', ...rest }) {
  return (
    <div className={`${stat ? 'stat-card' : 'card'} ${padding && !stat ? 'p-6' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}
