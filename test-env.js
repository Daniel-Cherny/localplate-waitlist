// Test environment variables
console.log('Environment Test:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NETLIFY:', process.env.NETLIFY);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET (hidden)' : 'NOT SET');
console.log('All env vars:', Object.keys(process.env).sort().join(', '));