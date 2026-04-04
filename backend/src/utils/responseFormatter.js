export const formatSuccess = (message, data = {}) => ({
  success: true,
  message,
  data,
  error: null,
});

export const formatError = (message, code, details) => ({
  success: false,
  message,
  data: null,
  error: {
    code,
    details,
  },
});
