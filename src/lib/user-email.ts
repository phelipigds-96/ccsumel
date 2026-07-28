export const USER_EMAIL_DOMAIN = "sumel.local";

/** Internal logins are mapped to synthetic e-mails for the auth provider. */
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${USER_EMAIL_DOMAIN}`;
