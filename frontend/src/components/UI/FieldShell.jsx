export default function FieldShell({ label, htmlFor, required, hint, error, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="form-label">
          {label}{required && <span className="form-required">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="form-error-text">{error}</p> : hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}
