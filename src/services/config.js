// Runtime config for the web portal.
// The portal always talks to the live backend. Mock mode exists only for
// isolated UI development and must be explicitly enabled with
// REACT_APP_USE_MOCK=true.
export const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true';
export const API_URL = process.env.REACT_APP_API_URL || '';
export const WS_URL_ENV = process.env.REACT_APP_WS_URL || '';
