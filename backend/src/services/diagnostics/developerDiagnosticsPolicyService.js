import { forbidden } from '../../utils/appError.js';

export const assertDeveloperDiagnosticsAvailable = () => {
  if (process.env.NODE_ENV === 'production') {
    throw forbidden('Developer diagnostics are disabled in production.');
  }
};
