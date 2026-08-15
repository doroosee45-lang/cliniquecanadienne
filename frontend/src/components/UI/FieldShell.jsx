import { cloneElement, useId } from 'react';

export default function FieldShell({ label, htmlFor, required, hint, error, children }) {
  const descId = useId();
  const showError = Boolean(error);
  const showHint = !showError && Boolean(hint);
  const describedBy = showError || showHint ? descId : undefined;

  // Relie le champ à son message d'erreur/aide — sans ça un lecteur d'écran
  // ne lit ni l'un ni l'autre, seulement le champ lui-même.
  const field = cloneElement(children, {
    'aria-describedby': describedBy,
    'aria-invalid': showError ? true : undefined,
  });

  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="form-label">
          {label}{required && <span className="form-required">*</span>}
        </label>
      )}
      {field}
      {showError
        ? <p id={descId} className="form-error-text">{error}</p>
        : showHint
          ? <p id={descId} className="form-hint">{hint}</p>
          : null}
    </div>
  );
}
