# LocalPlate Waitlist Audit

## Immediate Risks (Fix Before Wide Launch)

1. **Unprotected Referral Increment**  
   - File: `supabase-migration.sql:208`
   - Issue: The `record_referral` RPC is callable with the public anon key and blindly increments `referral_count`, even when the paired insert fails or is skipped (`ON CONFLICT DO NOTHING`). Anyone with the public API key can script fake referrals.  
   - Action: Move referral incrementing behind a service-role API (Edge Function / server endpoint) that verifies a successful signup before updating counts, or restrict execution to service clients only.

2. **Admin Dashboard Exposes Waitlist PII**  
   - Files: `admin-panel-x8k9m2q.html:174`, `FIX_SUPABASE_NOW.sql:20`
   - Issue: The deployed dashboard uses a hard-coded browser prompt and the SQL instructions grant `SELECT` on `waitlist` to the `anon` role. With the shipped anon key, anyone can load the page and download every signup.  
   - Action: Remove anon `SELECT` access, pull the admin UI from the public build, and front it with real authentication (e.g., Netlify Identity + Supabase service key proxy).

3. **Navigation Guard Never Clears on Errors**  
   - File: `waitlist.js:1335-1413`
   - Issue: When the Supabase insert throws, the `beforeunload` handler stays registered, trapping users on the page.  
   - Action: In a `finally` block, ensure `insertPending` is set to false and both navigation listeners (`beforeUnload`, `navigationHandler`) are removed.

## Near-Term Improvements (Post-Risk Mitigation)

4. **Success Page Trustworthiness**  
   - File: `success.html:835-936`
   - Concern: The confirmation page expires after 60 seconds and shows a random queue position when no real rank is available. Legitimate users refreshing later get bounced, and the random number misleads them.  
   - Recommendation: Persist success state server-side and display either the true position or a neutral message until it is available.

5. **Overly Strict Input Validation**  
   - Files: `waitlist.js:533-563`, `index.html:209-221`
   - Concern: Phone and ZIP validation enforce US-only formats, blocking international signups even though Supabase accepts the data.  
   - Recommendation: Switch to tolerant validation (or make optional) and rely on backend checks for canonical cleaning.

6. **Debug & Test Assets in Production Build**  
   - Files: `debug-waitlist.js`, `test-gamification.html`, `verify-gamification.js`, etc.
   - Concern: Netlify publishes the repo root, so debugging guidance ships to production.  
   - Recommendation: Exclude these files via `publish` directory or build step, or move them under `/docs` before deploy.

## Launch Checklist

- [ ] Lock down referral updates (Issue 1)
- [ ] Revoke anon read access and secure the admin panel (Issue 2)
- [ ] Patch submission navigation cleanup (Issue 3)
- [ ] Decide on success-page behavior (Issue 4)
- [ ] Loosen phone/ZIP validation as needed (Issue 5)
- [ ] Trim debug assets from production build (Issue 6)

When the top two are solved you can safely lean into the viral mechanics without risking data leakage or referral fraud.
