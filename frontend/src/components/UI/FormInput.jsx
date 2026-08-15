import FieldShell from './FieldShell';

export default function FormInput({ label, id, required, hint, error, className = '', ...rest }) {
  return (
    <FieldShell label={label} htmlFor={id} required={required} hint={hint} error={error}>
      <input id={id} required={required} className={`form-input ${error ? 'error' : ''} ${className}`} {...rest} />
    </FieldShell>
  );
}
