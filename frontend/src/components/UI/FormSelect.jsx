import FieldShell from './FieldShell';

export default function FormSelect({ label, id, required, hint, error, options, placeholder, children, className = '', ...rest }) {
  return (
    <FieldShell label={label} htmlFor={id} required={required} hint={hint} error={error}>
      <select id={id} required={required} className={`form-input ${error ? 'error' : ''} ${className}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))
          : children}
      </select>
    </FieldShell>
  );
}
