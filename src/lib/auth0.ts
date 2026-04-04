import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Resolve the base URL for the app.
//
// Priority:
//  1. VERCEL_PROJECT_PRODUCTION_URL – auto-injected by Vercel; only present when
//     running on the Vercel platform, so it is safe to check first. This avoids
//     broken deployments caused by a misconfigured APP_BASE_URL=http://localhost:3001
//     in Vercel environment variables.
//  2. APP_BASE_URL – explicit override; use this for custom domains on Vercel or
//     for non-Vercel deployments. Must NOT be set to a localhost URL in production.
//  3. AUTH0_BASE_URL – legacy alias for APP_BASE_URL.
//  4. VERCEL_URL – per-deployment Vercel URL; useful for preview deployments.
const resolveAppBaseUrl = (): string | undefined => {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.AUTH0_BASE_URL) return process.env.AUTH0_BASE_URL;
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