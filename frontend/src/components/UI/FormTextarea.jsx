import FieldShell from './FieldShell';

export default function FormTextarea({ label, id, required, hint, error, rows = 4, className = '', ...rest }) {
  return (
    <FieldShell label={label} htmlFor={id} required={required} hint={hint} error={error}>
      <textarea id={id} rows={rows} className={`form-input ${error ? 'error' : ''} ${className}`} {...rest} />
    </FieldShell>
  );
}
