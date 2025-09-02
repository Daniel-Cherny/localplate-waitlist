# LocalPlate Waitlist - Simple Security Setup

## What Actually Matters for a Waitlist

### 1. Hide the Admin Panel ✅
**Problem**: Admin dashboard was publicly accessible
**Solution**: Renamed to `admin-panel-x8k9m2q.html` with a password prompt

- Password: `localplate2025admin`
- Change this password in the file before deploying
- URL is unguessable - don't share it

### 2. Basic Supabase RLS ✅
**Problem**: Need to prevent people from reading other users' data
**Solution**: Simple RLS policies - users can INSERT but not SELECT

Run this in Supabase SQL editor:
```sql
-- See supabase-simple-rls.sql
```

### 3. That's It ✅
Seriously, that's all you need for a waitlist.

## What We DON'T Need

❌ Edge Functions for authentication
❌ Complex rate limiting with IP hashing
❌ Netlify Functions for form submission
❌ Enterprise-grade CSP headers
❌ HMAC-SHA256 pepper salted IP tracking
❌ SOC 2 compliance for a waitlist

## To Deploy

1. **Set up config.js** (you already have this)
2. **Run the RLS policy** in Supabase
3. **Change the admin password** in admin-panel-x8k9m2q.html
4. **Push to GitHub** - Netlify will auto-deploy

```bash
git add .
git commit -m "Simple security fixes"
git push
```

## If You Get Spam

Add Cloudflare Turnstile (free):
1. Get a site key from Cloudflare
2. Add the widget to your form
3. That's it

But honestly? You probably won't get spam on a waitlist.

## Admin Access

Go to: `https://yoursite.netlify.app/admin-panel-x8k9m2q.html`

Don't put this URL anywhere public. If someone finds it, just rename it again.

## Reality Check

This is a waitlist collecting:
- Names
- Emails  
- Phone numbers
- ZIP codes

Not credit cards. Not medical records. Not state secrets.

The simple approach above is:
- ✅ Secure enough
- ✅ Easy to maintain
- ✅ Won't break randomly
- ✅ Actually makes sense

---

**Remember**: Perfect security is the enemy of shipping your product.