/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: PrivacyDetailsModal should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { ShieldCheck, X } from 'lucide-react';

const sections = [
  {
    title: '1. Authentication and Google Connection (IPP 1 & 3)',
    paragraphs: [
      'Transparent Authorization: When you sign in with your Google account, we only request access to your name and email address. This is designed to streamline the registration process and securely track your coaching progress.',
      'Connection Management: You can revoke your connection at any time in the app settings or through your Google Account Permissions page. Once revoked, we will stop collecting any new information through Google.',
    ],
  },
  {
    title: '2. Recording Processing and Security (IPP 5)',
    paragraphs: [
      'End-to-End Encryption: Your practice recordings are encrypted using industry-standard encryption technologies such as AES-256 during transmission from your device to our servers and storage.',
      'Storage Location: Data is stored on secure servers that meet New Zealand privacy standards. We have implemented strict physical and electronic security measures to prevent unauthorized access or disclosure.',
    ],
  },
  {
    title: '3. Voice Data and Biometric Compliance (Biometric Code 2025)',
    paragraphs: [
      'Processing Purpose: We analyze your voice to provide pronunciation feedback and assess interview performance.',
      'Biometric Compliance: In accordance with the Biometric Processing Privacy Code, effective November 2025, your voice templates are used only for your personal coaching services, never for identification, and never sold to third parties.',
      'Special Protection: Biometric data is treated as sensitive information and is subject to the highest level of access control.',
    ],
  },
  {
    title: '4. Data Retention and Deletion (IPP 9)',
    paragraphs: [
      'Retention Policy: We retain your recordings only while you remain an active user.',
      'Automatic Deletion: If an account is inactive for 12 consecutive months, we will automatically anonymize or permanently delete your voice data in accordance with New Zealand compliant retention policy.',
      'Immediate Deletion: You can manually delete specific practice recordings or request account cancellation at any time in your Privacy Settings.',
    ],
  },
  {
    title: '5. Your Rights (IPP 6 & 7)',
    paragraphs: [
      'Access and Correction: You have the right to request to view all personal information we hold about you and to request corrections of any inaccuracies.',
      'Indirect Collection Notification (IPP 3A): In accordance with the IPP 3A requirement to be enforced from May 1, 2026, if you use our services through a third-party platform, we clearly disclose the source and purpose of the relevant data.',
    ],
  },
];

/**
 * Purpose: Execute the main responsibility for PrivacyDetailsModal.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function PrivacyDetailsModal({ open, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close privacy details"
      />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:px-8">
          <div>
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">Privacy & Security</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Kiwi Voice Coach</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              This summary explains how Google sign-in, recording protection, biometric handling, retention, and user rights are treated in the current compliance draft.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-6 sm:px-8">
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="rounded-3xl border border-gray-100 bg-gray-50 px-5 py-5">
                <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-6 text-gray-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
