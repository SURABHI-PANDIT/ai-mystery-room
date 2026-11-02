export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;

  if (error?.code === 11000) {
    return response.status(409).json({
      success: false,
      message: 'An account with this email already exists.',
      error: { code: 'EMAIL_ALREADY_REGISTERED' },
    });
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return response.status(400).json({
      success: false,
      message: 'The submitted information is invalid.',
      error: { code: 'VALIDATION_ERROR' },
    });
  }

  console.error('Request failed:', error?.message || 'Unknown server error');
  return response.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    error: { code: 'INTERNAL_SERVER_ERROR' },
  });
}
