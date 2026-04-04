import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Resolve the base URL for the app. On Vercel, VERCEL_PROJECT_PRODUCTION_URL
// (stable production domain) and VERCEL_URL (per-deployment URL) are injected
// automatically, so we fall back to those when APP_BASE_URL is not set.
const resolveAppBaseUrl = (): string | undefined => {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.AUTH0_BASE_URL) return process.env.AUTH0_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
};

const appBaseUrl = resolveAppBaseUrl();

const isConfigured = !!(
  appBaseUrl &&
  process.env.AUTH0_DOMAIN &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET &&
  process.env.AUTH0_SECRET
);

export const auth0: Auth0Client | null = isConfigured
  ? new Auth0Client({
    appBaseUrl,
  })
  : null;

export const isAuth0Configured = isConfigured;