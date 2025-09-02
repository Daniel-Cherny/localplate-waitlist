// Netlify Build Script
// This script creates config.js during Netlify build process using environment variables

const fs = require('fs');

// Get environment variables from Netlify
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

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