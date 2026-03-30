export const formatSuccess = (message, data = {}) => {
  return {
    success: true,
    message,
    data,
    error: null
  };
};

export const formatError = (message, code, details) => {
  return {
    success: false,
    message,
    data: null,
    error: {
      code,
      details
    }
  };
};
