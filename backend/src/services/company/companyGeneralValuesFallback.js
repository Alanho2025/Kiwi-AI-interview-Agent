export const buildGeneralCompanyValuesFallback = ({
  companyName = '',
  reason = 'company_values_unavailable',
} = {}) => ({
  status: 'fallback',
  source: 'general_fallback',
  companyName,
  confidence: 0.5,
  fallbackReason: reason,
  values: [
    {
      id: 'company_research_signal',
      label: 'Company research signal',
      description: 'Shows effort to understand the company beyond a generic application.',
      confidence: 0.5,
    },
    {
      id: 'role_motivation',
      label: 'Role motivation',
      description: 'Shows clear interest in the responsibilities and purpose of the role.',
      confidence: 0.5,
    },
    {
      id: 'customer_or_user_impact',
      label: 'Customer or user impact',
      description: 'Connects motivation to real users, customers, or business outcomes.',
      confidence: 0.5,
    },
    {
      id: 'collaboration',
      label: 'Collaboration',
      description: 'Connects motivation to teamwork and shared outcomes.',
      confidence: 0.5,
    },
    {
      id: 'learning_mindset',
      label: 'Learning mindset',
      description: 'Shows curiosity, adaptability, and interest in improving.',
      confidence: 0.5,
    },
  ],
});
