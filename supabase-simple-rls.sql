-- Simple, sensible RLS policies for a waitlist app
-- Not the Pentagon, just a waitlist

-- Enable RLS on the waitlist table
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to INSERT into waitlist (they need to sign up!)
CREATE POLICY "Anyone can join the waitlist" 
ON public.waitlist 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Don't allow anonymous users to READ the waitlist (privacy)
CREATE POLICY "No public reading of waitlist" 
ON public.waitlist 
FOR SELECT 
TO anon 
USING (false);

-- Create a unique constraint on email to prevent duplicates
ALTER TABLE public.waitlist 
ADD CONSTRAINT unique_email UNIQUE (email);

-- That's it. Simple and effective.
-- The anon key can now only INSERT, not read or modify.
-- Your admin panel can use a service role key if needed for reading.