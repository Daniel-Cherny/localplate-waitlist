-- LocalPlate Gamification Database Functions
-- These functions support the real-time referral system and gamification features

-- Function to get user referral stats
CREATE OR REPLACE FUNCTION get_user_referral_stats(user_referral_code TEXT)
RETURNS JSON AS $$
DECLARE
    referral_count INTEGER := 0;
    waitlist_position INTEGER := NULL;
    result JSON;
BEGIN
    -- Get user's referral count
    SELECT COUNT(*) INTO referral_count
    FROM waitlist 
    WHERE referred_by = user_referral_code;
    
    -- Get user's waitlist position (based on join date)
    SELECT position INTO waitlist_position
    FROM (
        SELECT 
            referral_code,
            ROW_NUMBER() OVER (ORDER BY joined_at) as position
        FROM waitlist
        WHERE referral_code IS NOT NULL
    ) ranked
    WHERE referral_code = user_referral_code;
    
    -- Build result JSON
    result := json_build_object(
        'referral_count', referral_count,
        'waitlist_position', waitlist_position
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get community stats
CREATE OR REPLACE FUNCTION get_community_stats()
RETURNS JSON AS $$
DECLARE
    total_members INTEGER := 0;
    daily_referrals INTEGER := 0;
    result JSON;
BEGIN
    -- Get total community size
    SELECT COUNT(*) INTO total_members
    FROM waitlist;
    
    -- Get daily referrals (referrals made today)
    SELECT COUNT(*) INTO daily_referrals
    FROM waitlist 
    WHERE referred_by IS NOT NULL 
    AND DATE(joined_at) = CURRENT_DATE;
    
    -- Build result JSON
    result := json_build_object(
        'total_members', total_members,
        'daily_referrals', daily_referrals
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a referral (already exists but enhanced)
CREATE OR REPLACE FUNCTION record_referral(referral_code TEXT)
RETURNS JSON AS $$
DECLARE
    referrer_exists BOOLEAN := FALSE;
    referral_count INTEGER := 0;
    result JSON;
BEGIN
    -- Check if referrer exists
    SELECT EXISTS(
        SELECT 1 FROM waitlist 
        WHERE referral_code = record_referral.referral_code
    ) INTO referrer_exists;
    
    IF NOT referrer_exists THEN
        result := json_build_object(
            'success', false,
            'message', 'Invalid referral code'
        );
        RETURN result;
    END IF;
    
    -- Get updated referral count
    SELECT COUNT(*) INTO referral_count
    FROM waitlist 
    WHERE referred_by = record_referral.referral_code;
    
    result := json_build_object(
        'success', true,
        'message', 'Referral recorded successfully',
        'referral_count', referral_count
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top referrers (for social proof)
CREATE OR REPLACE FUNCTION get_top_referrers(limit_count INTEGER DEFAULT 5)
RETURNS TABLE(
    position INTEGER,
    referral_count BIGINT,
    anonymized_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY COUNT(r.referred_by) DESC)::INTEGER as position,
        COUNT(r.referred_by) as referral_count,
        -- Anonymize email (show first char + domain)
        CONCAT(
            SUBSTRING(w.email FROM 1 FOR 1),
            '***@',
            SUBSTRING(w.email FROM POSITION('@' IN w.email) + 1)
        ) as anonymized_email
    FROM waitlist w
    LEFT JOIN waitlist r ON w.referral_code = r.referred_by
    WHERE w.referral_code IS NOT NULL
    GROUP BY w.id, w.email
    HAVING COUNT(r.referred_by) > 0
    ORDER BY COUNT(r.referred_by) DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get referral tier progress
CREATE OR REPLACE FUNCTION get_referral_tier_progress(user_referral_code TEXT)
RETURNS JSON AS $$
DECLARE
    referral_count INTEGER := 0;
    tier_1_progress NUMERIC := 0;
    tier_2_progress NUMERIC := 0;
    tier_3_progress NUMERIC := 0;
    unlocked_tiers JSON;
    result JSON;
BEGIN
    -- Get user's referral count
    SELECT COUNT(*) INTO referral_count
    FROM waitlist 
    WHERE referred_by = user_referral_code;
    
    -- Calculate tier progress (1, 3, 5 referrals)
    tier_1_progress := LEAST(referral_count::NUMERIC / 1.0, 1.0);
    tier_2_progress := LEAST(referral_count::NUMERIC / 3.0, 1.0);
    tier_3_progress := LEAST(referral_count::NUMERIC / 5.0, 1.0);
    
    -- Determine unlocked tiers
    unlocked_tiers := json_build_array();
    IF referral_count >= 1 THEN
        unlocked_tiers := unlocked_tiers || json_build_object('tier', 1, 'reward', 'Early Access Badge');
    END IF;
    IF referral_count >= 3 THEN
        unlocked_tiers := unlocked_tiers || json_build_object('tier', 2, 'reward', 'One Month Free');
    END IF;
    IF referral_count >= 5 THEN
        unlocked_tiers := unlocked_tiers || json_build_object('tier', 3, 'reward', 'Swag Pack');
    END IF;
    
    -- Build result JSON
    result := json_build_object(
        'referral_count', referral_count,
        'tier_1_progress', tier_1_progress,
        'tier_2_progress', tier_2_progress,
        'tier_3_progress', tier_3_progress,
        'unlocked_tiers', unlocked_tiers
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent referral activity (for notifications)
CREATE OR REPLACE FUNCTION get_recent_referral_activity(user_referral_code TEXT, hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    referral_email TEXT,
    joined_at TIMESTAMPTZ,
    hours_ago NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Partially anonymize email for privacy
        CONCAT(
            SUBSTRING(w.email FROM 1 FOR 2),
            '***@',
            SUBSTRING(w.email FROM POSITION('@' IN w.email) + 1)
        ) as referral_email,
        w.joined_at,
        EXTRACT(EPOCH FROM (NOW() - w.joined_at)) / 3600 as hours_ago
    FROM waitlist w
    WHERE w.referred_by = user_referral_code
    AND w.joined_at > NOW() - INTERVAL '1 hour' * hours_back
    ORDER BY w.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for waitlist stats (for better performance)
CREATE OR REPLACE VIEW waitlist_stats AS
SELECT 
    COUNT(*) as total_signups,
    COUNT(CASE WHEN referred_by IS NOT NULL THEN 1 END) as total_referrals,
    COUNT(CASE WHEN DATE(joined_at) = CURRENT_DATE THEN 1 END) as signups_today,
    COUNT(CASE WHEN DATE(joined_at) = CURRENT_DATE AND referred_by IS NOT NULL THEN 1 END) as referrals_today,
    AVG(CASE WHEN referred_by IS NOT NULL THEN 1.0 ELSE 0.0 END) as referral_rate
FROM waitlist;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION get_user_referral_stats(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_community_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_referral(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_referrers(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_referral_tier_progress(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recent_referral_activity(TEXT, INTEGER) TO anon, authenticated;
GRANT SELECT ON waitlist_stats TO anon, authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_user_referral_stats(TEXT) IS 'Returns referral count and waitlist position for a user';
COMMENT ON FUNCTION get_community_stats() IS 'Returns overall community statistics including total members and daily referrals';
COMMENT ON FUNCTION record_referral(TEXT) IS 'Records a successful referral and returns updated count';
COMMENT ON FUNCTION get_top_referrers(INTEGER) IS 'Returns top referrers with anonymized emails for social proof';
COMMENT ON FUNCTION get_referral_tier_progress(TEXT) IS 'Returns detailed tier progress and unlocked rewards for a user';
COMMENT ON FUNCTION get_recent_referral_activity(TEXT, INTEGER) IS 'Returns recent referrals for a user within specified hours';
COMMENT ON VIEW waitlist_stats IS 'Aggregated waitlist statistics for dashboard display';