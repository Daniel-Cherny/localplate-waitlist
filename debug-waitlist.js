// LocalPlate Waitlist Debugging Script
// Run this in your browser console on the waitlist page

console.log('=== LOCALPLATE WAITLIST DEBUGGING ===');

// Test 1: Check if required elements exist
console.log('\n🔍 CHECKING REQUIRED ELEMENTS:');
const form = document.getElementById('waitlist-form');
const submitBtn = document.getElementById('submit-btn');
const emailInput = document.getElementById('email');

console.log('Form element:', form ? '✅ Found' : '❌ Missing');
console.log('Submit button:', submitBtn ? '✅ Found' : '❌ Missing');
console.log('Email input:', emailInput ? '✅ Found' : '❌ Missing');

// Test 2: Check if config is loaded
console.log('\n🔧 CHECKING CONFIGURATION:');
console.log('LOCALPLATE_CONFIG:', window.LOCALPLATE_CONFIG ? '✅ Loaded' : '❌ Missing');
if (window.LOCALPLATE_CONFIG) {
    console.log('Supabase URL:', window.LOCALPLATE_CONFIG.supabase?.url || '❌ Missing');
    console.log('Supabase Key Length:', window.LOCALPLATE_CONFIG.supabase?.anonKey?.length || '❌ Missing');
}

// Test 3: Check if Supabase library is loaded
console.log('\n📚 CHECKING LIBRARIES:');
console.log('Supabase library:', window.supabase ? '✅ Loaded' : '❌ Missing');
console.log('createClient function:', typeof window.supabase?.createClient === 'function' ? '✅ Available' : '❌ Missing');

// Test 4: Check if submit handler is attached
console.log('\n🎯 CHECKING EVENT HANDLERS:');
console.log('handleFormSubmit function:', typeof window.handleFormSubmit === 'function' ? '✅ Available' : '❌ Missing');

// Test 5: Try to get Supabase client
console.log('\n🔌 TESTING SUPABASE CLIENT:');
try {
    if (window.getSupabaseClient) {
        const client = window.getSupabaseClient();
        console.log('Supabase client creation:', client ? '✅ Success' : '❌ Failed');
    } else {
        console.log('getSupabaseClient function:', '❌ Missing');
    }
} catch (error) {
    console.log('Supabase client error:', '❌', error.message);
}

// Test 6: Check form event listeners
console.log('\n👂 CHECKING FORM EVENT LISTENERS:');
if (form) {
    const listeners = getEventListeners ? getEventListeners(form) : 'Cannot check (getEventListeners not available)';
    console.log('Form submit listeners:', listeners);
}

// Test 7: Manual form submission test
console.log('\n🧪 MANUAL SUBMISSION TEST:');
console.log('To test form submission manually, run:');
console.log('testFormSubmission()');

// Create manual test function
window.testFormSubmission = async function() {
    console.log('\n🚀 TESTING MANUAL FORM SUBMISSION...');
    
    // Fill in test data
    const testData = {
        firstName: 'Debug',
        lastName: 'Test', 
        email: 'debug-' + Date.now() + '@example.com',
        phone: '5551234567',
        zipcode: '90210'
    };
    
    console.log('Test data:', testData);
    
    // Try to create Supabase client and insert
    try {
        if (!window.getSupabaseClient) {
            throw new Error('getSupabaseClient function not available');
        }
        
        const supabase = window.getSupabaseClient();
        console.log('✅ Supabase client created');
        
        const submissionData = {
            first_name: testData.firstName,
            last_name: testData.lastName,
            email: testData.email,
            phone: testData.phone,
            zipcode: testData.zipcode,
            dietary_preferences: [],
            referral_source: 'debug_test',
            restaurant_suggestion: 'Debug Restaurant',
            referral_code: 'DEBUG123',
            referred_by: null,
            joined_at: new Date().toISOString(),
            source: 'premium_waitlist',
            user_agent: navigator.userAgent,
            language: navigator.language
        };
        
        console.log('Attempting database insert...');
        const { data, error } = await supabase
            .from('waitlist')
            .insert([submissionData])
            .select();
            
        if (error) {
            console.log('❌ INSERT ERROR:', error);
        } else {
            console.log('✅ INSERT SUCCESS:', data);
            console.log('🎉 Form submission would work! Check your browser console for JavaScript errors during actual submission.');
        }
        
    } catch (error) {
        console.log('❌ TEST ERROR:', error.message);
        console.log('This is likely why your form isn\'t working!');
    }
};

console.log('\n✨ Debugging complete! Run testFormSubmission() to test database connectivity.');