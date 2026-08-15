const SHAPES = {
  line: 'h-4 rounded-lg',
  card: 'h-32 rounded-card',
  circle: 'rounded-full',
  row: 'h-10 rounded-lg',
};

export default function Skeleton({ variant = 'line', width, height, count = 1, className = '' }) {
  const shape = SHAPES[variant] || SHAPES.line;
  const style = { width, height };
  if (count === 1) return <div className={`skeleton ${shape} ${className}`} style={style} />;
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${shape} ${className}`} style={style} />
      ))}
    </div>
  );
}
