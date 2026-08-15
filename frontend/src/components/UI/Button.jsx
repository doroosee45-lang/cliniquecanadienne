import Spinner from './Spinner';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
};

const SPINNER_COLOR = {
  primary: 'white',
  danger: 'white',
  secondary: 'primary',
  ghost: 'primary',
  outline: 'primary',
};

const SIZES = {
  sm: 'text-xs px-3 py-1.5',
  md: '',
  lg: 'text-base px-6 py-3.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || ''} ${className}`}
      {...rest}
    >
      {loading
        ? <Spinner size="sm" color={SPINNER_COLOR[variant] || 'primary'} />
        : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
