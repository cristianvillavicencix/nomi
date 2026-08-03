/** Shared HTML props to stop password managers from treating SMS fields as login forms. */
export const SMS_COMPOSER_FORM_PROPS = {
  autoComplete: "off" as const,
};

export const SMS_COMPOSER_TEXTAREA_PROPS = {
  name: "sms-body",
  autoComplete: "off" as const,
  autoCorrect: "on" as const,
  spellCheck: true,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
};

export const TEAM_MESSAGE_INPUT_PROPS = {
  name: "team-message-body",
  autoComplete: "off" as const,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
};
