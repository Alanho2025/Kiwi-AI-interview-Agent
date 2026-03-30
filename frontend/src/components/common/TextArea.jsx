import { cn } from '../../utils/formatters.js';

export function TextArea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2eb886] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}
