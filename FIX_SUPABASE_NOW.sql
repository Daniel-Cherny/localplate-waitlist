-- EMERGENCY FIX: Run this ENTIRE file in Supabase SQL Editor
-- This creates the missing functions causing 404 errors

-- Step 1: Create the functions
-- Copy ALL content from gamification-functions.sql and run it

-- Step 2: Quick test to verify functions work
SELECT get_community_stats();

-- Step 3: If you get permission errors, run these grants
GRANT EXECUTE ON FUNCTION get_user_referral_stats(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_community_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_referral_tier_progress(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_referral(TEXT) TO anon, authenticated;
GRANT SELECT ON waitlist_stats TO anon, authenticated;

-- Step 4: Enable RLS for real-time subscriptions
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow reading waitlist for counts and real-time
CREATE POLICY "Allow public read for analytics" ON waitlist
FOR SELECT TO anon
USING (true);

-- Step 5: Test everything works
SELECT COUNT(*) FROM waitlist; -- Should return a number
SELECT * FROM waitlist_stats; -- Should return stats