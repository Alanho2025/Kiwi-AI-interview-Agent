import { Link } from 'react-router-dom';
import { Bird } from 'lucide-react';

export function AppHeader({ children }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-4">
        <Link to="/analysis" className="flex items-center gap-2 text-gray-900 font-semibold text-lg shrink-0">
          <Bird className="w-6 h-6 text-[#2eb886]" />
          <span>Kiwi Voice Coach</span>
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </header>
  );
}
