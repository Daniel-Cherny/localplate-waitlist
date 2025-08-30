// LocalPlate Premium Waitlist JavaScript

// Configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client if configured
let supabase = null;
if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Form state
let currentStep = 1;
const totalSteps = 3;
const formData = {
    email: '',
    zipcode: '',
    preferences: [],
    referralSource: '',
    restaurantSuggestion: ''
};

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    initScrollReveal();
    initFormHandlers();
    initMarquee();
    updateWaitlistCount();
    checkReferral();
});

// Dark Mode Toggle
function initDarkMode() {
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    
    // Check for saved theme or system preference
    const currentTheme = localStorage.getItem('theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    if (currentTheme === 'dark') {
        html.classList.add('dark');
    }
    
    themeToggle?.addEventListener('click', () => {
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    });
}

// Scroll Reveal Animations
function initScrollReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe all elements with reveal class
    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

// Multi-Step Form Handlers
function initFormHandlers() {
    const form = document.getElementById('waitlist-form');
    
    // Email validation
    const emailInput = document.getElementById('email');
    emailInput?.addEventListener('blur', () => {
        validateEmail(emailInput.value);
    });
    
    // ZIP code formatting
    const zipcodeInput = document.getElementById('zipcode');
    zipcodeInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });
    
    // Form submission
    form?.addEventListener('submit', handleFormSubmit);
    
    // Initialize step indicators
    updateStepIndicators();
}

// Navigate to next step
window.nextStep = function() {
    if (validateCurrentStep()) {
        saveStepData();
        
        if (currentStep < totalSteps) {
            currentStep++;
            showStep(currentStep);
            updateStepIndicators();
        }
    }
};

// Navigate to previous step
window.previousStep = function() {
    saveStepData();
    
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
        updateStepIndicators();
    }
};

// Validate current step
function validateCurrentStep() {
    if (currentStep === 1) {
        const email = document.getElementById('email').value;
        if (!validateEmail(email)) {
            showError('email-error');
            return false;
        }
    }
    return true;
}

// Validate email format
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    const errorElement = document.getElementById('email-error');
    if (!isValid && email) {
        errorElement?.classList.remove('hidden');
    } else {
        errorElement?.classList.add('hidden');
    }
    
    return isValid;
}

// Show error message
function showError(errorId) {
    const errorElement = document.getElementById(errorId);
    errorElement?.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        errorElement?.classList.add('hidden');
    }, 3000);
}

// Save current step data
function saveStepData() {
    switch(currentStep) {
        case 1:
            formData.email = document.getElementById('email').value;
            break;
        case 2:
            formData.zipcode = document.getElementById('zipcode').value;
            formData.preferences = Array.from(document.querySelectorAll('input[name="preferences"]:checked'))
                .map(cb => cb.value);
            break;
        case 3:
            formData.referralSource = document.getElementById('referral-source').value;
            formData.restaurantSuggestion = document.getElementById('restaurant-suggestion').value;
            break;
    }
}

// Show specific step
function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
    });
    
    // Show current step with fade effect
    setTimeout(() => {
        document.getElementById(`step-${step}`)?.classList.add('active');
    }, 50);
}

// Update step indicators
function updateStepIndicators() {
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        const stepNum = index + 1;
        
        if (stepNum < currentStep) {
            indicator.classList.add('completed');
            indicator.classList.remove('active');
        } else if (stepNum === currentStep) {
            indicator.classList.add('active');
            indicator.classList.remove('completed');
        } else {
            indicator.classList.remove('active', 'completed');
        }
    });
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    saveStepData();
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const submitText = document.getElementById('submit-text');
    const submitLoader = document.getElementById('submit-loader');
    
    submitButton.disabled = true;
    submitText.classList.add('hidden');
    submitLoader.classList.remove('hidden');
    
    try {
        // Generate referral code
        const referralCode = generateReferralCode(formData.email);
        
        // Get referrer if exists
        const referredBy = getReferralFromURL();
        
        // Prepare submission data
        const submissionData = {
            ...formData,
            referral_code: referralCode,
            referred_by: referredBy,
            joined_at: new Date().toISOString(),
            source: 'premium_waitlist',
            user_agent: navigator.userAgent,
            language: navigator.language
        };
        
        // Submit to Supabase or localStorage
        if (supabase) {
            const { data, error } = await supabase
                .from('waitlist')
                .insert([submissionData])
                .select();
            
            if (error) throw new Error(error.message);
            
            // Update referrer count
            if (referredBy) {
                await supabase
                    .from('waitlist')
                    .update({ referral_count: supabase.raw('referral_count + 1') })
                    .eq('referral_code', referredBy);
            }
        } else {
            // Fallback to localStorage
            const waitlist = JSON.parse(localStorage.getItem('localplate_waitlist') || '[]');
            waitlist.push(submissionData);
            localStorage.setItem('localplate_waitlist', JSON.stringify(waitlist));
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Store success data
        sessionStorage.setItem('waitlist_email', formData.email);
        sessionStorage.setItem('waitlist_referral_code', referralCode);
        
        // Redirect to success page
        window.location.href = 'success.html';
        
    } catch (error) {
        console.error('Submission error:', error);
        alert('Something went wrong. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitText.classList.remove('hidden');
        submitLoader.classList.add('hidden');
    }
}

// Generate unique referral code
function generateReferralCode(email) {
    const hash = email.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
}

// Get referral code from URL
function getReferralFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || null;
}

// Check if user came from referral
function checkReferral() {
    const referralCode = getReferralFromURL();
    if (referralCode) {
        // Track referral visit
        console.log('Referred by:', referralCode);
        
        // Could show a welcome message
        // showReferralWelcome(referralCode);
    }
}

// Update waitlist count with animation
async function updateWaitlistCount() {
    const countElement = document.getElementById('waitlist-count');
    if (!countElement) return;
    
    let targetCount = 1247; // Default
    
    try {
        if (supabase) {
            const { count, error } = await supabase
                .from('waitlist')
                .select('*', { count: 'exact', head: true });
            
            if (!error && count) {
                targetCount = count;
            }
        } else {
            // Use localStorage count
            const waitlist = JSON.parse(localStorage.getItem('localplate_waitlist') || '[]');
            targetCount = 1247 + waitlist.length;
        }
    } catch (error) {
        console.error('Error fetching count:', error);
    }
    
    // Animate the count
    animateCount(countElement, targetCount);
}

// Animate number counting up
function animateCount(element, target) {
    const duration = 2000; // 2 seconds
    const start = parseInt(element.textContent.replace(/,/g, '')) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

// Initialize marquee pause on hover
function initMarquee() {
    const marqueeContainer = document.querySelector('.marquee-container');
    const marqueeContent = document.querySelectorAll('.marquee-content');
    
    if (marqueeContainer) {
        // Pause on hover is handled via CSS
        // Could add touch support for mobile here
        
        // Optional: Add click tracking for restaurant logos
        document.querySelectorAll('.restaurant-logo').forEach(logo => {
            logo.addEventListener('click', () => {
                const restaurantName = logo.alt;
                console.log('Restaurant clicked:', restaurantName);
                // Track engagement
            });
        });
    }
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80; // Account for fixed header
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Add subtle parallax effect to hero
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.ken-burns-image');
    
    parallaxElements.forEach(el => {
        const speed = 0.5;
        el.style.transform = `translateY(${scrolled * speed}px) scale(1.1)`;
    });
});

// Performance optimization - Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimized scroll handler
const optimizedScroll = debounce(() => {
    // Parallax and other scroll effects
}, 10);

window.addEventListener('scroll', optimizedScroll);

// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (prefersReducedMotion.matches) {
    // Disable animations
    document.querySelectorAll('.animate-pulse-slow, .animate-gradient, .ken-burns-image').forEach(el => {
        el.style.animation = 'none';
    });
}

// Track form analytics
function trackEvent(eventName, eventData = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventData);
    }
    
    // Console log for development
    console.log('Event:', eventName, eventData);
}

// Add ripple effect to buttons
document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Add ripple styles dynamically
const style = document.createElement('style');
style.textContent = `
    .btn-primary, .btn-secondary {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);