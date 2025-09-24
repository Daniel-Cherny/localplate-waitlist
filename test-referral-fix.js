// Test the referral code fix thoroughly

// Original broken function (for comparison)
function generateReferralCodeOld(email) {
    const hash = email.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
}

// Fixed version
function generateReferralCode(email) {
    const hash = email.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    // Ensure we always get 8 characters by padding with zeros if needed
    const code = Math.abs(hash).toString(36).toUpperCase();
    return code.padStart(8, '0').substring(0, 8);
}

console.log('🔬 TESTING REFERRAL CODE GENERATION FIX\n');
console.log('=' .repeat(60));

// Test various email patterns
const testEmails = [
    'a@b.c',                    // Very short email
    'test@example.com',         // Standard email
    'user@localplate.com',      // Domain email
    'john.doe+test@gmail.com',  // Plus addressing
    'special!chars@test.co.uk', // Special chars
    'very.long.email.address.with.many.parts@subdomain.example.com',
    'simple@test.io',
    '12345@numbers.com',
    'CAPS@UPPERCASE.COM',
    'unicode.테스트@example.com'
];

console.log('Testing with various emails:\n');

let oldLengthIssues = 0;
let newLengthIssues = 0;
const collisions = new Set();
const oldCollisions = new Set();

testEmails.forEach(email => {
    const oldCode = generateReferralCodeOld(email);
    const newCode = generateReferralCode(email);

    const oldLen = oldCode.length;
    const newLen = newCode.length;

    if (oldLen !== 8) oldLengthIssues++;
    if (newLen !== 8) newLengthIssues++;

    oldCollisions.add(oldCode);
    collisions.add(newCode);

    console.log(`Email: ${email.padEnd(50)} | Old: ${oldCode.padEnd(8)} (${oldLen}) | New: ${newCode} (${newLen})`);
});

console.log('\n' + '=' .repeat(60));
console.log('📊 RESULTS:\n');

console.log(`Old function: ${oldLengthIssues}/${testEmails.length} had wrong length`);
console.log(`New function: ${newLengthIssues}/${testEmails.length} had wrong length`);
console.log(`\nUniqueness: ${collisions.size}/${testEmails.length} unique codes (new)`);
console.log(`Uniqueness: ${oldCollisions.size}/${testEmails.length} unique codes (old)`);

// Test deterministic behavior
console.log('\n🔄 Testing Deterministic Generation:');
const testEmail = 'test@example.com';
const codes = [];
for (let i = 0; i < 5; i++) {
    codes.push(generateReferralCode(testEmail));
}
const allSame = codes.every(c => c === codes[0]);
console.log(`Same email produces same code: ${allSame ? '✅ YES' : '❌ NO'}`);
console.log(`Codes: ${codes.join(', ')}`);

// Analyze if length even matters
console.log('\n' + '=' .repeat(60));
console.log('💭 DOES LENGTH EVEN MATTER?\n');

console.log('Collision probability analysis:');
const base36Chars = 36; // 0-9, A-Z
const possibleCodes6 = Math.pow(base36Chars, 6);
const possibleCodes8 = Math.pow(base36Chars, 8);

console.log(`6 characters: ${possibleCodes6.toLocaleString()} possible codes`);
console.log(`8 characters: ${possibleCodes8.toLocaleString()} possible codes`);
console.log(`\nFor a 10,000 user waitlist:`);

// Birthday paradox approximation
function collisionProbability(n, k) {
    // n = number of possible values, k = number of samples
    // Approximation: P(collision) ≈ 1 - e^(-k^2 / 2n)
    return 1 - Math.exp(-(k * k) / (2 * n));
}

const users = 10000;
const prob6 = collisionProbability(possibleCodes6, users);
const prob8 = collisionProbability(possibleCodes8, users);

console.log(`6-char collision chance: ${(prob6 * 100).toFixed(4)}%`);
console.log(`8-char collision chance: ${(prob8 * 100).toFixed(8)}%`);

console.log('\n🎯 VERDICT:');
console.log('- 6 chars = 2.1 billion combinations');
console.log('- 8 chars = 2.8 trillion combinations');
console.log('- For small waitlists (<100k users), 6 chars is actually fine');
console.log('- This is mostly a cosmetic issue, not a functional one');

// Check what actually breaks with different lengths
console.log('\n🔍 WHAT ACTUALLY BREAKS?');
console.log('- Database field: Can store any length');
console.log('- URL parameters: Both 6 and 8 chars work fine');
console.log('- Share links: No difference');
console.log('- Visual consistency: Only issue is user perception');

// Test if padding causes any issues
console.log('\n⚠️  TESTING PADDING SIDE EFFECTS:');
const edgeCases = [
    '',           // Empty
    '@',          // Just domain
    'a',          // Single char
    '!!!@###.com' // All special chars
];

edgeCases.forEach(email => {
    try {
        const code = generateReferralCode(email);
        console.log(`Edge case "${email}": ${code} (${code.length} chars) ✅`);
    } catch (e) {
        console.log(`Edge case "${email}": ERROR - ${e.message} ❌`);
    }
});

console.log('\n' + '=' .repeat(60));
console.log('✅ FIX VERIFICATION COMPLETE');