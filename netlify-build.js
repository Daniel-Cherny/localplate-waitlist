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
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

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

// Verify the file was created
if (fs.existsSync('config.js')) {
    console.log('✅ config.js file exists');
} else {
    console.error('❌ Failed to create config.js');
    process.exit(1);
}