import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Resolve the base URL for the app.
//
// Priority:
//  1. VERCEL_ENV=production + VERCEL_PROJECT_PRODUCTION_URL – use the stable
//     production domain for production deployments.
//  2. VERCEL_URL – per-deployment URL auto-injected by Vercel (preview/branch).
//  3. VERCEL_PROJECT_PRODUCTION_URL – production-domain fallback when available.
//  4. APP_BASE_URL – explicit override for non-Vercel deployments or custom domains.
//     Must NOT be set to a localhost URL in production.
//  5. AUTH0_BASE_URL – legacy alias for APP_BASE_URL.
const resolveAppBaseUrl = (): string | undefined => {
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.AUTH0_BASE_URL) return process.env.AUTH0_BASE_URL;
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
