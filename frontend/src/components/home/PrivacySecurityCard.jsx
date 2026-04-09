import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { PrivacyDetailsModal } from './PrivacyDetailsModal.jsx';

export function PrivacySecurityCard({ email = '', loginProvider = '' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);

  const providerLabel = loginProvider || 'Google';
  const isGoogleConnected = providerLabel.toLowerCase() === 'google';

  const handleOpenGooglePermissions = () => {
    window.open('https://myaccount.google.com/permissions', '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-gray-900">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Privacy & Security
        </h3>
        <p className="text-sm text-gray-600 leading-6">
          Google sign-in only uses your name and email. Practice recordings are encrypted in transit and storage, and voice data is used only for coaching under the current NZ compliance draft.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Google Connection</span>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Encrypted Recordings</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Biometric Protection</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">Retention & Deletion</span>
        </div>

        {showConnectionPanel ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <div className="text-xs leading-5 text-gray-600 min-w-0">
                  <p className="font-semibold text-gray-700">
                    {isGoogleConnected ? 'Connected with Google' : `Connected with ${providerLabel}`}
                  </p>
                  {email ? <p className="truncate">{email}</p> : null}
                  <p>
                    Sign out from the top-right menu to end this session. To revoke account access, manage permissions in your Google account.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-gray-300 px-3 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-100"
                onClick={handleOpenGooglePermissions}
              >
                Open Google Permissions
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-full border border-gray-300 py-2 text-xs font-semibold transition hover:bg-gray-50"
            onClick={() => setShowConnectionPanel((value) => !value)}
          >
            Manage Connection
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-[#20B2AA] py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1c9c95]"
            onClick={() => setIsModalOpen(true)}
          >
            Privacy Details
          </button>
        </div>
      </div>

      <PrivacyDetailsModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
