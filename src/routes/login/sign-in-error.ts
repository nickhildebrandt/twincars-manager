/**
 * Maps a better-auth sign-in error to the German message shown in the
 * login form. better-auth's own strings are English ("Invalid username
 * or password") and must never reach the UI; only the 429 body is
 * produced by our own rate-limit hook and is already German.
 */

/** Shape of the error object returned by `authClient.signIn.username`. */
export type SignInError = { status?: number; message?: string }

/**
 * Returns the German user-facing message for a failed sign-in attempt.
 *
 * @param error - Error object from the better-auth client.
 * @returns Curated German message for the login form's error alert.
 */
export const signInErrorMessage = (error: SignInError): string => {
  if (error.status === 429) {
    // Our rate-limit hook answers with a German body; keep it if present.
    return (
      error.message?.trim() ||
      'Zu viele Anmeldeversuche, bitte warten Sie eine Minute.'
    )
  }
  if (error.status === 401 || error.status === 403) {
    return 'Benutzername oder Passwort ist falsch.'
  }
  return 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.'
}
