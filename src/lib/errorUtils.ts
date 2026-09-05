/**
 * Error sanitization utility to prevent database schema exposure
 * Maps Supabase/PostgreSQL error codes to user-friendly messages
 */

interface PostgresError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

// Map of PostgreSQL error codes to user-friendly messages
const ERROR_CODE_MAP: Record<string, string> = {
  // Unique constraint violations
  '23505': 'This item already exists. Please use a different name or identifier.',
  
  // Foreign key violations
  '23503': 'Cannot complete this action. The item is still in use elsewhere.',
  
  // RLS policy violations
  '42501': "You don't have permission to perform this action.",
  
  // Not null violations
  '23502': 'Required information is missing. Please fill in all required fields.',
  
  // Check constraint violations
  '23514': 'The provided value is not valid. Please check your input.',
  
  // Data type errors
  '22P02': 'Invalid input format. Please check your data.',
  
  // Numeric value out of range
  '22003': 'Number is too large or too small.',
  
  // String too long
  '22001': 'Text is too long. Please shorten your input.',
  
  // PostgREST errors
  'PGRST116': 'No matching record found.',
  'PGRST301': 'Row not found.',
  'PGRST204': 'No content returned.',
  
  // Auth errors
  'invalid_credentials': 'Invalid email or password.',
  'email_not_confirmed': 'Please confirm your email address.',
  'user_already_exists': 'An account with this email already exists.',
  'weak_password': 'Password is too weak. Please use a stronger password.',
  'invalid_email': 'Please enter a valid email address.',
};

// HTTP status code mapping
const HTTP_STATUS_MAP: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Please sign in to continue.',
  403: "You don't have permission to perform this action.",
  404: 'The requested item was not found.',
  409: 'Conflict: This item may already exist.',
  422: 'The provided data is invalid.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
};

/**
 * Sanitizes database errors to prevent schema exposure
 * Returns user-friendly error messages in production
 * Returns detailed errors in development mode for debugging
 */
export function sanitizeError(error: unknown): string {
  const isDev = import.meta.env.DEV;
  
  // Log full error in development for debugging
  if (isDev) {
    console.error('Full error details:', error);
  }
  
  // Handle null/undefined
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    // In dev mode, show the string error
    if (isDev) return error;
    // In production, return generic message unless it's a known safe message
    return 'An error occurred. Please try again.';
  }
  
  // Handle Error objects and Supabase errors
  const errorObj = error as PostgresError & { status?: number; statusCode?: number };
  
  // Check for PostgreSQL error codes
  if (errorObj.code && ERROR_CODE_MAP[errorObj.code]) {
    return ERROR_CODE_MAP[errorObj.code];
  }
  
  // Check for HTTP status codes
  const status = errorObj.status || errorObj.statusCode;
  if (status && HTTP_STATUS_MAP[status]) {
    return HTTP_STATUS_MAP[status];
  }
  
  // Check for auth-specific error codes in message
  if (errorObj.message) {
    const lowerMessage = errorObj.message.toLowerCase();
    
    // Check for known auth error patterns
    if (lowerMessage.includes('invalid login credentials')) {
      return 'Invalid email or password.';
    }
    if (lowerMessage.includes('email not confirmed')) {
      return 'Please confirm your email address before signing in.';
    }
    if (lowerMessage.includes('user already registered')) {
      return 'An account with this email already exists.';
    }
    if (lowerMessage.includes('rate limit')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    
    // In dev mode, return the actual message for debugging
    if (isDev) {
      return errorObj.message;
    }
  }
  
  // Default fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Creates a standardized error response for toast notifications
 */
export function createErrorToast(error: unknown): { title: string; description: string; variant: 'destructive' } {
  return {
    title: 'Error',
    description: sanitizeError(error),
    variant: 'destructive' as const,
  };
}
