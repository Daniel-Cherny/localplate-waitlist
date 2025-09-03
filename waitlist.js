// LocalPlate Premium Waitlist JavaScript

// Debug mode toggle
const DEBUG = new URLSearchParams(location.search).has('debug');

// Debug tracing helper
const trace = (...args) => {
    if (!DEBUG) return;
    const t = (performance.now() / 1000).toFixed(3);
    console.log(`[waitlist ${t}s]`, ...args);
};

// Assertion helper
const assertOrThrow = (cond, msg) => {
    if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
};

// Debug fetch wrapper to trace Supabase network calls
function createDebugFetch(origFetch = fetch) {
    return async (url, opts) => {
        const start = performance.now();
        trace('[supabase fetch] →', opts?.method || 'GET', String(url), {
            headers: opts?.headers ? Object.keys(opts.headers) : [],
            bodyBytes: opts?.body ? (typeof opts.body === 'string' ? opts.body.length : 'binary') : 0,
        });
        try {
            const res = await origFetch(url, opts);
            trace('[supabase fetch] ←', res.status, res.statusText, `${(performance.now()-start).toFixed(1)}ms`);
            return res;
        } catch (err) {
            trace('[supabase fetch] ✖', err.message);
            throw err;
        }
    };
}

// Initialize Supabase client when needed (fixes timing issue)
function getSupabaseClient() {
    trace('[getSupabaseClient] called');
    
    // Assert config is loaded
    assertOrThrow(window.LOCALPLATE_CONFIG, 'LOCALPLATE_CONFIG missing (config.js not loaded)');
    
    // Get configuration from config.js (loaded separately for security)
    const SUPABASE_URL = window.LOCALPLATE_CONFIG?.supabase?.url || 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = window.LOCALPLATE_CONFIG?.supabase?.anonKey || 'YOUR_SUPABASE_ANON_KEY';
    
    // Assert credentials exist
    assertOrThrow(SUPABASE_URL !== 'YOUR_SUPABASE_URL', 'SUPABASE_URL not configured');
    assertOrThrow(SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY not configured');
    
    trace('[getSupabaseClient] url:', SUPABASE_URL, 'anon key length:', SUPABASE_ANON_KEY.length);
    
    // Create client with debug fetch if in debug mode
    const options = DEBUG ? {
        global: { fetch: createDebugFetch(fetch) }
    } : {};
    
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
    trace('[getSupabaseClient] client created');
    
    return client;
}

// Form state
let currentStep = 1;
const totalSteps = 3;
const formData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    zipcode: '',
    preferences: [],
    referralSource: '',
    restaurantSuggestion: ''
};

// Initialize everything when DOM is ready - Mobile Optimized
document.addEventListener('DOMContentLoaded', () => {
    trace('[init] DOM ready');
    
    // DEBUG: Network monitoring
    if (DEBUG && 'PerformanceObserver' in window) {
        trace('[init] setting up network monitoring');
        try {
            const po = new PerformanceObserver((list) => {
                for (const e of list.getEntries()) {
                    if (e.initiatorType === 'fetch' && e.name.includes('supabase.co')) {
                        trace('[perf fetch]', e.name, `${e.duration.toFixed(1)}ms`);
                    }
                }
            });
            po.observe({ entryTypes: ['resource'] });
        } catch (err) {
            trace('[init] network monitoring setup failed:', err.message);
        }
    }
    
    // Critical path - initialize immediately
    initDarkMode();
    initFormHandlers();
    
    // Defer non-critical initializations for better mobile performance
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
            initScrollReveal();
            initMarquee();
            updateWaitlistCount();
            checkReferral();
        }, { timeout: 2000 });
    } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
            initScrollReveal();
            initMarquee();
            updateWaitlistCount();
            checkReferral();
        }, 100);
    }
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

// Scroll Reveal Animations - Mobile Optimized
function initScrollReveal() {
    // Detect mobile device for optimized settings
    const isMobile = window.innerWidth <= 768;
    
    const observerOptions = {
        threshold: isMobile ? [0.1, 0.3] : [0.1, 0.3, 0.5], // Multiple thresholds for better mobile performance
        rootMargin: isMobile ? '0px 0px -50px 0px' : '0px 0px -100px 0px' // Smaller margin on mobile
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add small delay for mobile to ensure smooth animation
                if (isMobile) {
                    setTimeout(() => {
                        entry.target.classList.add('revealed');
                    }, 50);
                } else {
                    entry.target.classList.add('revealed');
                }
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
    
    // CRITICAL: Log form detection
    console.log('[INIT] Form element found:', !!form);
    if (!form) {
        console.error('[INIT] CRITICAL: waitlist-form not found! Submit handler will not attach.');
        // Try again after a delay
        setTimeout(() => {
            const retryForm = document.getElementById('waitlist-form');
            if (retryForm) {
                console.log('[INIT] Form found on retry, attaching handler');
                retryForm.addEventListener('submit', handleFormSubmit);
            }
        }, 100);
        return;
    }
    
    // First name validation
    const firstNameInput = document.getElementById('firstName');
    firstNameInput?.addEventListener('blur', () => {
        validateName(firstNameInput, 'First name');
    });
    
    // Last name validation
    const lastNameInput = document.getElementById('lastName');
    lastNameInput?.addEventListener('blur', () => {
        validateName(lastNameInput, 'Last name');
    });
    
    // Email validation
    const emailInput = document.getElementById('email');
    emailInput?.addEventListener('blur', () => {
        validateEmail(emailInput.value);
    });
    
    // Phone number formatting and validation
    const phoneInput = document.getElementById('phone');
    phoneInput?.addEventListener('input', (e) => {
        e.target.value = formatPhoneNumber(e.target.value);
    });
    phoneInput?.addEventListener('blur', () => {
        validatePhone(phoneInput.value);
    });
    
    // ZIP code formatting
    const zipcodeInput = document.getElementById('zipcode');
    zipcodeInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });
    
    // Form submission - CRITICAL PATH
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        console.log('[INIT] Submit handler attached successfully');
    } else {
        console.error('[INIT] Cannot attach submit handler - form is null');
    }
    
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
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        
        if (!firstName.trim()) {
            showError('firstName', 'First name is required');
            return false;
        }
        if (!lastName.trim()) {
            showError('lastName', 'Last name is required');
            return false;
        }
        if (!validateEmail(email)) {
            showError('email-error');
            return false;
        }
        if (!validatePhone(phone)) {
            showError('phone-error');
            return false;
        }
    } else if (currentStep === 2) {
        const zipcode = document.getElementById('zipcode').value;
        if (!validateZipcode(zipcode)) {
            showError('zipcode-error');
            return false;
        }
    }
    return true;
}

// Validate name fields
function validateName(input, fieldName) {
    const isValid = input.value.trim().length > 0;
    if (!isValid) {
        showError(input.id, `${fieldName} is required`);
    }
    return isValid;
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

// Validate phone number
function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const isValid = cleaned.length === 10;
    
    const errorElement = document.getElementById('phone-error');
    if (!isValid && phone) {
        errorElement?.classList.remove('hidden');
    } else {
        errorElement?.classList.add('hidden');
    }
    
    return isValid;
}

// Format phone number as user types
function formatPhoneNumber(value) {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length >= 6) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    }
    
    return formatted;
}

// Validate ZIP code
function validateZipcode(zipcode) {
    const isValid = /^\d{5}$/.test(zipcode);
    
    const errorElement = document.getElementById('zipcode-error');
    if (!isValid && zipcode) {
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
            formData.firstName = document.getElementById('firstName').value;
            formData.lastName = document.getElementById('lastName').value;
            formData.email = document.getElementById('email').value;
            formData.phone = document.getElementById('phone').value.replace(/\D/g, ''); // Store clean phone number
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

// Show inline error helper
function showInlineError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
    errorDiv.textContent = `ERROR: ${message}`;
    document.querySelector('.form-step.active').prepend(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => errorDiv.remove(), 10000);
}

// Show inline success helper  
function showInlineSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4';
    successDiv.textContent = `SUCCESS: ${message}`;
    document.querySelector('.form-step.active').prepend(successDiv);
}

// Handle form submission - Simple and direct with Supabase
window.handleFormSubmit = async function(e) {
    e.preventDefault();
    console.log('[SUBMIT] Handler fired! Form submission started');
    trace('[submit] form submission started');
    
    if (!validateCurrentStep()) {
        trace('[submit] validation failed');
        return;
    }
    
    saveStepData();
    trace('[submit] step data saved');
    
    // Show loading state
    const submitButton = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitLoader = document.getElementById('submit-loader');
    
    submitButton.disabled = true;
    submitText.classList.add('hidden');
    submitLoader.classList.remove('hidden');
    
    try {
        // Generate referral code
        const referralCode = generateReferralCode(formData.email);
        trace('[submit] referral code generated:', referralCode);
        
        // Get referrer if exists
        const referredBy = getReferralFromURL();
        trace('[submit] referred by:', referredBy || 'none');
        
        // Prepare submission data
        const submissionData = {
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            zipcode: formData.zipcode,
            dietary_preferences: formData.preferences,
            referral_source: formData.referralSource,
            restaurant_suggestion: formData.restaurantSuggestion,
            referral_code: referralCode,
            referred_by: referredBy,
            joined_at: new Date().toISOString(),
            source: 'premium_waitlist',
            user_agent: navigator.userAgent,
            language: navigator.language
        };
        trace('[submit] payload built', { email: submissionData.email });
        
        // Create Supabase client with assertions
        const supabase = getSupabaseClient();
        assertOrThrow(supabase, 'Supabase client not created');
        
        // DEBUG ONLY: Connectivity sanity check
        if (DEBUG) {
            trace('[submit] debug connectivity check...');
            const { error: pingErr } = await supabase
                .from('waitlist')
                .select('*', { head: true, count: 'estimated' });
            trace('[submit] connectivity check result:', pingErr || 'ok');
        }
        
        // **CRITICAL: Block navigation while insert is pending**
        let insertPending = true;
        const beforeUnload = (evt) => {
            if (insertPending) {
                evt.preventDefault();
                evt.returnValue = 'Database operation in progress...';
                trace('[submit] navigation blocked - insert pending');
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        
        // Submit directly to Supabase (with RLS this is fine)
        trace('[submit] starting database insert...');
        const { data, error } = await supabase
            .from('waitlist')
            .insert([submissionData])
            .select();
        
        // Clear navigation block immediately
        insertPending = false;
        window.removeEventListener('beforeunload', beforeUnload);
        
        trace('[submit] insert result', { error: error?.message, rows: data?.length || 0 });
        
        if (error) {
            const errorMsg = error.message?.includes('duplicate') 
                ? 'This email is already on the waitlist.'
                : error.message;
            
            showInlineError(`Database error: ${errorMsg}`);
            localStorage.setItem('localplate:lastError', JSON.stringify({ 
                at: Date.now(), 
                error: errorMsg 
            }));
            
            throw new Error(errorMsg);
        }
        
        // Update referrer count if applicable
        if (referredBy) {
            trace('[submit] updating referrer count...');
            await supabase
                .from('waitlist')
                .update({ referral_count: supabase.raw('referral_count + 1') })
                .eq('referral_code', referredBy);
        }
        
        // Store success data
        sessionStorage.setItem('waitlist_email', formData.email);
        sessionStorage.setItem('waitlist_referral_code', referralCode);
        
        // Store real position from database response
        if (data && data.length > 0 && data[0].position) {
            sessionStorage.setItem('waitlist_position', data[0].position);
            trace('[submit] real position stored:', data[0].position);
        }
        
        trace('[submit] success data stored, about to redirect');
        
        // CRITICAL: Only redirect if we have confirmed data
        if (data && data.length > 0) {
            console.log('[SUBMIT] Insert confirmed with ID:', data[0].id, '- navigating to success');
            window.location.href = 'success.html';
        } else {
            console.error('[SUBMIT] No data returned from insert - refusing to navigate');
            showInlineError('Database insert did not complete. Please try again.');
        }
        
    } catch (error) {
        trace('[submit] exception caught', error.message);
        console.error('Submission error:', error);
        
        showInlineError(error.message || 'Something went wrong. Please try again.');
        localStorage.setItem('localplate:lastError', JSON.stringify({ 
            at: Date.now(), 
            error: String(error) 
        }));
    } finally {
        // Always restore UI state
        submitButton.disabled = false;
        submitText.classList.remove('hidden');
        submitLoader.classList.add('hidden');
        trace('[submit] UI state restored');
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
        const supabase = getSupabaseClient();
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

// Initialize marquee pause on hover and touch support
function initMarquee() {
    const marqueeContainer = document.querySelector('.marquee-container');
    
    if (marqueeContainer) {
        // Touch support for mobile - pause on touch
        let touchStartTime = 0;
        
        marqueeContainer.addEventListener('touchstart', () => {
            touchStartTime = Date.now();
            marqueeContainer.classList.add('paused');
        }, { passive: true });
        
        marqueeContainer.addEventListener('touchend', () => {
            const touchDuration = Date.now() - touchStartTime;
            // Only resume if it was a brief touch (not a scroll gesture)
            if (touchDuration < 200) {
                setTimeout(() => {
                    marqueeContainer.classList.remove('paused');
                }, 1000);
            } else {
                marqueeContainer.classList.remove('paused');
            }
        }, { passive: true });
        
        // Pause on scroll to prevent jank on mobile
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (window.innerWidth <= 768) {
                marqueeContainer.classList.add('paused');
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    marqueeContainer.classList.remove('paused');
                }, 150);
            }
        }, { passive: true });
        
        // Optional: Add click tracking for restaurant logos
        document.querySelectorAll('.restaurant-logo').forEach(logo => {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                const restaurantName = logo.alt;
                console.log('Restaurant clicked:', restaurantName);
                // Track engagement
                trackEvent('restaurant_logo_click', {
                    restaurant_name: restaurantName
                });
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

// Mobile-optimized parallax effect
function initParallax() {
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Disable parallax on mobile and for users who prefer reduced motion
    if (isMobile || prefersReducedMotion) {
        return;
    }
    
    const parallaxHandler = () => {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.ken-burns-image');
        
        parallaxElements.forEach(el => {
            const speed = 0.3; // Reduced intensity
            // Use transform3d for better performance
            el.style.transform = `translate3d(0, ${scrolled * speed}px, 0) scale3d(1.05, 1.05, 1)`;
        });
    };
    
    // Optimized scroll handler with requestAnimationFrame
    let ticking = false;
    const optimizedParallax = () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                parallaxHandler();
                ticking = false;
            });
            ticking = true;
        }
    };
    
    window.addEventListener('scroll', optimizedParallax, { passive: true });
}

// Initialize parallax on page load
initParallax();

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

// Add ripple styles dynamically (only on non-mobile devices)
if (window.innerWidth > 768) {
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
}

// Mobile Performance Monitoring
function initMobilePerformanceMonitoring() {
    if (window.innerWidth <= 768) {
        // Monitor frame rate
        let frameCount = 0;
        let lastTime = performance.now();
        
        function trackFPS() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime >= lastTime + 1000) {
                const fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
                
                // Log performance issues
                if (fps < 30) {
                    console.warn(`Low FPS detected: ${fps}fps`);
                    trackEvent('performance_issue', {
                        fps: fps,
                        user_agent: navigator.userAgent
                    });
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(trackFPS);
        }
        
        // Start monitoring after page load
        window.addEventListener('load', () => {
            setTimeout(trackFPS, 2000);
        });
    }
}

// Mobile Menu Functionality
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerIcon = document.getElementById('hamburger-icon');
    const closeIcon = document.getElementById('close-icon');
    const body = document.body;
    
    if (!mobileMenuButton || !mobileMenu) return;
    
    let isMenuOpen = false;
    
    // Toggle mobile menu
    mobileMenuButton.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            mobileMenu.classList.add('mobile-menu-open');
            hamburgerIcon.classList.add('hidden');
            closeIcon.classList.remove('hidden');
            body.classList.add('mobile-menu-active');
            mobileMenuButton.setAttribute('aria-expanded', 'true');
            
            // Focus first menu item
            const firstLink = mobileMenu.querySelector('a');
            if (firstLink) firstLink.focus();
        } else {
            closeMobileMenu();
        }
    });
    
    // Close menu function
    function closeMobileMenu() {
        mobileMenu.classList.remove('mobile-menu-open');
        hamburgerIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
        body.classList.remove('mobile-menu-active');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
        isMenuOpen = false;
    }
    
    // Close menu when clicking links
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMenuOpen) {
            closeMobileMenu();
            mobileMenuButton.focus();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 640 && isMenuOpen) {
            closeMobileMenu();
        }
    });
}

// Initialize mobile menu
document.addEventListener('DOMContentLoaded', initMobileMenu);

// Initialize performance monitoring
initMobilePerformanceMonitoring();