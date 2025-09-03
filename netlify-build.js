// Netlify Build Script
// This script creates config.js during Netlify build process using environment variables

const fs = require('fs');

// Debug: Log environment info
console.log('🚀 Build Environment:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   NETLIFY:', process.env.NETLIFY);
console.log('   CI:', process.env.CI);
console.log('   CONTEXT:', process.env.CONTEXT);

// Get environment variables from Netlify
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validate environment variables BEFORE proceeding
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ CRITICAL: Environment variables are missing!');
    console.error('❌ SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
    console.error('❌ SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
    console.error('❌ Please set these in Netlify dashboard under Site Settings > Environment Variables');
    process.exit(1);
}

// Debug: Log what we're getting (mask sensitive data)
console.log('🔍 Debug: SUPABASE_URL =', SUPABASE_URL?.startsWith('https://') ? 'FOUND (valid URL)' : 'NOT_FOUND_OR_INVALID');
console.log('🔍 Debug: SUPABASE_ANON_KEY =', SUPABASE_ANON_KEY?.startsWith('eyJ') ? 'FOUND (valid JWT)' : 'NOT_FOUND_OR_INVALID');
console.log('🔍 Debug: Raw SUPABASE_URL =', SUPABASE_URL === 'YOUR_SUPABASE_URL' ? 'PLACEHOLDER' : 'ACTUAL VALUE SET');

// Create config.js content
const configContent = `// LocalPlate Waitlist Configuration
// Auto-generated during Netlify build

window.LOCALPLATE_CONFIG = {
    supabase: {
        url: '${SUPABASE_URL}',
        anonKey: '${SUPABASE_ANON_KEY}'
    }
};`;

// Write config.js file
fs.writeFileSync('config.js', configContent, 'utf8');
console.log('✅ config.js created successfully');

// Verify the file was created and doesn't contain placeholders
if (fs.existsSync('config.js')) {
    const generatedContent = fs.readFileSync('config.js', 'utf8');
    if (generatedContent.includes('YOUR_SUPABASE_URL') || generatedContent.includes('YOUR_SUPABASE_ANON_KEY')) {
        console.error('❌ CRITICAL: config.js still contains placeholders!');
        console.error('❌ This means environment variables are not set in Netlify');
        console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify dashboard');
        process.exit(1);
    }
    if (!generatedContent.includes('https://') || !generatedContent.includes('eyJ')) {
        console.error('❌ CRITICAL: config.js does not contain valid values!');
        console.error('❌ URL should start with https:// and key should start with eyJ');
        process.exit(1);
    }
    console.log('✅ config.js file exists and contains real values');
    console.log('📋 Config preview (first 150 chars):', configContent.substring(0, 150) + '...');
} else {
    console.error('❌ Failed to create config.js');
    process.exit(1);
}