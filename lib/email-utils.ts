/**
 * lib/email-utils.ts
 * Utility helpers for AutoMail.
 * Note: Name extraction from email has been removed — body is sent verbatim.
 */

/** Returns true if the string looks like a valid email address. */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Promise-based delay in milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
