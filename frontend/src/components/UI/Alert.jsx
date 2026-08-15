import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const VARIANTS = {
  info:    { cls: 'info-alert',     Icon: Info,          iconColor: 'text-primary' },
  success: { cls: 'success-alert',  Icon: CheckCircle2,  iconColor: 'text-success' },
  warning: { cls: 'warning-alert',  Icon: AlertTriangle, iconColor: 'text-warning' },
  danger:  { cls: 'critical-alert', Icon: XCircle,       iconColor: 'text-danger' },
};

export default function Alert({ variant = 'info', title, children, className = '' }) {
  const { cls, Icon, iconColor } = VARIANTS[variant] || VARIANTS.info;
  return (
    <div className={`${cls} rounded-2xl p-4 flex gap-3 ${className}`}>
      <Icon size={20} className={`${iconColor} shrink-0 mt-0.5`} />
      <div className="text-sm text-gray-700">
        {title && <p className="font-semibold text-gray-900 mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  );
}
