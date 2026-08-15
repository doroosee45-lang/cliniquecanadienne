export default function FormRadio({ label, id, error, className = '', ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
        <input type="radio" id={id} className={`form-radio ${className}`} {...rest} />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
      {error && <p className="form-error-text">{error}</p>}
    </div>
  );
}
