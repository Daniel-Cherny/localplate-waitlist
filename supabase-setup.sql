-- LocalPlate Waitlist Database Setup for Supabase
-- Run this SQL in your Supabase SQL editor to set up the waitlist table

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    zipcode VARCHAR(10),
    referral_code VARCHAR(20) UNIQUE,
    referred_by VARCHAR(20),
    referral_count INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50),
    user_agent TEXT,
    language VARCHAR(10),
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    email_verified BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX idx_waitlist_referred_by ON waitlist(referred_by);
CREATE INDEX idx_waitlist_zipcode ON waitlist(zipcode);
CREATE INDEX idx_waitlist_joined_at ON waitlist(joined_at DESC);
CREATE INDEX idx_waitlist_position ON waitlist(position);

-- Create a function to automatically update the position
CREATE OR REPLACE FUNCTION update_waitlist_position()
RETURNS TRIGGER AS $$
BEGIN
    NEW.position := (SELECT COALESCE(MAX(position), 0) + 1 FROM waitlist);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set position on insert
CREATE TRIGGER set_waitlist_position
    BEFORE INSERT ON waitlist
    FOR EACH ROW
    EXECUTE FUNCTION update_waitlist_position();

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_waitlist_updated_at
    BEFORE UPDATE ON waitlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Create view for public stats (without exposing emails)
CREATE OR REPLACE VIEW waitlist_stats AS
SELECT 
    COUNT(*) as total_signups,
    COUNT(DISTINCT zipcode) as unique_zipcodes,
    COUNT(CASE WHEN referred_by IS NOT NULL THEN 1 END) as referred_signups,
    MAX(joined_at) as last_signup,
    COUNT(CASE WHEN joined_at > NOW() - INTERVAL '24 hours' THEN 1 END) as signups_last_24h,
    COUNT(CASE WHEN joined_at > NOW() - INTERVAL '7 days' THEN 1 END) as signups_last_7d
FROM waitlist;

-- Create view for leaderboard (top referrers)
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT 
    referral_code,
    referral_count,
    joined_at,
    ROW_NUMBER() OVER (ORDER BY referral_count DESC, joined_at ASC) as rank
FROM waitlist
WHERE referral_count > 0
ORDER BY referral_count DESC
LIMIT 100;

-- Row Level Security (RLS) Policies
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert their own records
CREATE POLICY "Allow anonymous inserts" ON waitlist
    FOR INSERT 
    WITH CHECK (true);

-- Allow users to view their own record by email
CREATE POLICY "Users can view own record" ON waitlist
    FOR SELECT
    USING (email = current_setting('request.jwt.claims')::json->>'email');

-- Allow viewing public stats
GRANT SELECT ON waitlist_stats TO anon, authenticated;
GRANT SELECT ON referral_leaderboard TO anon, authenticated;

-- Function to get waitlist position by email
CREATE OR REPLACE FUNCTION get_waitlist_position(user_email VARCHAR)
RETURNS TABLE(
    position INTEGER,
    total_ahead INTEGER,
    estimated_access_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.position,
        (SELECT COUNT(*) FROM waitlist WHERE position < w.position) as total_ahead,
        -- Estimate access date based on position (adjust the calculation as needed)
        CURRENT_DATE + INTERVAL '1 day' * (w.position / 100) as estimated_access_date
    FROM waitlist w
    WHERE w.email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and record referral
CREATE OR REPLACE FUNCTION record_referral(
    referrer_code VARCHAR,
    new_email VARCHAR,
    new_zipcode VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    referrer_id UUID;
    new_user_code VARCHAR;
    result JSONB;
BEGIN
    -- Check if referrer exists
    SELECT id INTO referrer_id 
    FROM waitlist 
    WHERE referral_code = referrer_code;
    
    IF referrer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid referral code'
        );
    END IF;
    
    -- Generate new user's referral code
    new_user_code := UPPER(SUBSTRING(MD5(new_email || NOW()::TEXT), 1, 8));
    
    -- Insert new user
    INSERT INTO waitlist (email, zipcode, referral_code, referred_by)
    VALUES (new_email, new_zipcode, new_user_code, referrer_code)
    ON CONFLICT (email) DO NOTHING;
    
    -- Update referrer's count
    UPDATE waitlist 
    SET referral_count = referral_count + 1
    WHERE id = referrer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'referral_code', new_user_code,
        'message', 'Successfully joined waitlist'
    );
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (optional)
-- INSERT INTO waitlist (email, zipcode, referral_code) VALUES
-- ('test1@example.com', '94102', 'TEST1234'),
-- ('test2@example.com', '94103', 'TEST5678'),
-- ('test3@example.com', '94104', 'TEST9012')
-- ON CONFLICT DO NOTHING;