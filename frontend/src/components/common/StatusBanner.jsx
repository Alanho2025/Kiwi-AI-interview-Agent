import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../utils/formatters.js';

const stylesByVariant = {
  info: {
    container: 'border-blue-200 bg-blue-50 text-blue-900',
    icon: Info,
  },
  success: {
    container: 'border-green-200 bg-green-50 text-green-900',
    icon: CheckCircle2,
  },
  error: {
    container: 'border-red-200 bg-red-50 text-red-900',
    icon: AlertCircle,
  },
};

export function StatusBanner({ variant = 'info', title, message, className, actions }) {
  const style = stylesByVariant[variant] || stylesByVariant.info;
  const Icon = style.icon;

  return (
    <div className={cn('rounded-xl border px-4 py-3', style.container, className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title && <p className="text-sm font-semibold">{title}</p>}
          {message && <p className="mt-1 text-sm">{message}</p>}
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
