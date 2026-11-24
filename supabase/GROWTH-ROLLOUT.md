# ShopFlow growth and integrations rollout

Run this migration only after the existing ShopFlow profile and platform SQL files have succeeded.

## 1. Apply the database migration

In Supabase Dashboard → SQL Editor, run:

- `supabase/shopflow-growth-integrations.sql`

This creates coupon/campaign tables, team permission fields and policies, published storefront read policies, tracking tables, workspace-trial functions and analytics aggregation.

## 2. Deploy Supabase Edge Functions

From the repository root, with the Supabase CLI installed and the project linked:

```bash
supabase functions deploy shopflow-track --no-verify-jwt
supabase functions deploy invite-team-member
supabase functions deploy accept-team-invite
supabase functions deploy ga4-report
```

The Vercel frontend deployment does not deploy Supabase Edge Functions.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never add the service-role key to Vite or a browser environment variable.

## 3. Configure GA4 Data API

1. Create/use a Google Cloud service account and enable Google Analytics Data API.
2. In the GA4 property's Access Management, add the service account email with Viewer access.
3. In Supabase Dashboard → Edge Functions → Secrets, add `GA4_SERVICE_ACCOUNT_JSON` with the complete service-account JSON. Do not paste the private key into the ShopFlow dashboard, GitHub, or chat.
4. Save the GA4 Measurement ID (starts with `G-`) and numeric Property ID in ShopFlow.
5. Add the Google tag snippet shown in ShopFlow to every page of the independent website.

The GA4 Data API report button will work only after the function is deployed and the service account has property access. GA4 can take time to populate newly collected data.

## 4. Configure first-party ShopFlow website analytics

1. Save the exact website origin (scheme + hostname) in ShopFlow.
2. Deploy `shopflow-track`.
3. Copy the generated ShopFlow tracking script into every page of the independent website.
4. Load the script only after the site's analytics consent choice where required.
5. To record conversion events, call `window.ShopFlowTrack('purchase', { event_value: 499, currency: 'EGP' })` after the site's trusted order confirmation. Supported events: `add_to_cart`, `begin_checkout`, `purchase`, `lead`, and `custom`.

The ShopFlow reports are based on events actually received by the tracking endpoint. They are not estimates. A website URL alone is not enough to count visitors.

## 5. Team invitations

The invitation Edge Functions must be deployed, and Supabase Auth email delivery must be configured. The invited user must accept the email invitation and sign in before RLS grants their selected permissions.

## 6. Payment, shipping and WhatsApp

The dashboard currently saves non-secret merchant identifiers and marks these connections as pending. Live transactions/messages are intentionally not enabled yet. The next implementation stage requires provider-specific server adapters, encrypted per-store credential storage, webhook signature verification, idempotency and sandbox testing. Never store private API keys in `shopflow_integrations.public_config`.
