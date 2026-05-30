/**
 * Backend URL.
 * Override by setting EXPO_PUBLIC_API_URL in your .env file.
 * Defaults to localhost for local development.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
