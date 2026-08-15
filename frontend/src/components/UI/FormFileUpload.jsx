import { Upload } from 'lucide-react';
import FieldShell from './FieldShell';

export default function FormFileUpload({ label, id, required, hint, error, fileName, accept, className = '', ...rest }) {
  return (
    <FieldShell label={label} htmlFor={id} required={required} hint={hint} error={error}>
      <label htmlFor={id} className={`form-file flex flex-col items-center gap-2 ${className}`}>
        <Upload size={20} className="text-muted" />
        <span className="text-xs text-muted">{fileName || 'Cliquer pour choisir un fichier'}</span>
        <input type="file" id={id} accept={accept} className="hidden" {...rest} />
      </label>
    </FieldShell>
  );
}
