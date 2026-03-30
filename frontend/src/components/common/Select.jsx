import { cn } from '../../utils/formatters.js';

export function Select({ className, options = [], ...props }) {
  return (
    <select
      className={cn(
        "flex w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2eb886] focus:border-transparent appearance-none",
        className
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
