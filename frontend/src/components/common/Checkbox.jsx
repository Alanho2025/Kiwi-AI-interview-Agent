import { cn } from '../../utils/formatters.js';

export function Checkbox({ className, label, ...props }) {
  return (
    <label className="flex items-center space-x-3 cursor-pointer">
      <input
        type="checkbox"
        className={cn(
          "h-5 w-5 rounded border-gray-300 text-[#2eb886] focus:ring-[#2eb886] transition duration-150 ease-in-out cursor-pointer",
          className
        )}
        {...props}
      />
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}
