export default function FormCheckbox({ label, id, error, className = '', ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" id={id} className={`form-checkbox ${className}`} {...rest} />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
      {error && <p className="form-error-text">{error}</p>}
    </div>
  );
}
