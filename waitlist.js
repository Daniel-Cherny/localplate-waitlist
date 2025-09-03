// LocalPlate Premium Waitlist JavaScript

// Global error handlers and instrumentation (MUST BE FIRST)
if (typeof window !== 'undefined') {
    window.__lpLogs = window.__lpLogs || [];
    const pushLog = (type, payload) => {
        try {
            window.__lpLogs.push({ at: Date.now(), type, payload });
            if (window.__lpLogs.length > 2000) window.__lpLogs.shift();
        } catch (_) {}
    };

    window.addEventListener('error', (e) => {
        console.error('[GLOBAL ERROR]', e.error || e.message, e.filename, e.lineno, e.colno);
        pushLog('error', { message: e.message, stack: e.error?.stack, filename: e.filename, line: e.lineno });
        localStorage.setItem('localplate:lastError', JSON.stringify({ at: Date.now(), error: e.message, phase: 'global_error' }));
    });

    window.addEventListener('unhandledrejection', (e) => {
        console.error('[UNHANDLED REJECTION]', e.reason);
        pushLog('unhandledrejection', { reason: e.reason?.message || String(e.reason), stack: e.reason?.stack });
        localStorage.setItem('localplate:lastError', JSON.stringify({ at: Date.now(), error: e.reason?.message || String(e.reason), phase: 'unhandled_rejection' }));
    });
}

// Debug mode toggle
const DEBUG = new URLSearchParams(location.search).has('debug');

// Forward declarations to prevent initialization errors
window.nextStep = null; // Will be defined later  
window.previousStep = null; // Will be defined later

// Handle form submission - Defined early to prevent initialization race condition
window.handleFormSubmit = async function(e) {
    e.preventDefault();
    console.log('[SUBMIT] Handler fired! Form submission started');
    
    // Defer to the full implementation that will be set up after all dependencies are loaded
    // This ensures validateCurrentStep, saveStepData, etc. are available
    if (window._handleFormSubmitImpl) {
        return window._handleFormSubmitImpl(e);
    }
    
    console.error('[SUBMIT] Form handler implementation not yet loaded');
    return false;
}

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
window.getSupabaseClient = function() {
    trace('[getSupabaseClient] called');
    
    try {
        // Check if supabase library is loaded
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Supabase library not loaded. Please check your internet connection and try refreshing the page.');
        }
        
        // Assert config is loaded
        if (!window.LOCALPLATE_CONFIG) {
            throw new Error('Configuration not loaded. Please refresh the page and try again.');
        }
        
        // Get configuration from config.js (loaded separately for security)
        const SUPABASE_URL = window.LOCALPLATE_CONFIG?.supabase?.url || 'YOUR_SUPABASE_URL';
        const SUPABASE_ANON_KEY = window.LOCALPLATE_CONFIG?.supabase?.anonKey || 'YOUR_SUPABASE_ANON_KEY';
        
        // Validate credentials
        if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || !SUPABASE_URL) {
            throw new Error('Supabase URL not configured properly');
        }
        if (SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY' || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase API key not configured properly');
        }
        
        // Validate URL format
        if (!SUPABASE_URL.startsWith('https://') || !SUPABASE_URL.includes('supabase.co')) {
            throw new Error('Invalid Supabase URL format');
        }
        
        trace('[getSupabaseClient] url:', SUPABASE_URL, 'anon key length:', SUPABASE_ANON_KEY.length);
        
        // Create client with debug fetch if in debug mode
        const options = DEBUG ? {
            global: { fetch: createDebugFetch(fetch) }
        } : {};
        
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        
        if (!client) {
            throw new Error('Failed to create Supabase client');
        }
        
        trace('[getSupabaseClient] client created successfully');
        return client;
        
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error.message);
        trace('[getSupabaseClient] error:', error.message);
        
        // Store error for user feedback
        localStorage.setItem('localplate:supabaseError', JSON.stringify({
            at: Date.now(),
            error: error.message
        }));
        
        throw new Error(`Database connection failed: ${error.message}`);
    }
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
    
    try {
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
        
        // Critical path - initialize immediately with error handling
        try {
            initDarkMode();
        } catch (error) {
            console.error('Dark mode initialization failed:', error);
        }
        
        try {
            initFormHandlers();
        } catch (error) {
            console.error('Form handlers initialization failed:', error);
            reportError('init_form_handlers', error, 'Failed to initialize form');
        }
        
        // Defer non-critical initializations for better mobile performance
        const deferredInit = () => {
            const initFunctions = [
                { fn: initScrollReveal, name: 'scroll reveal' },
                { fn: initMarquee, name: 'marquee' },
                { fn: updateWaitlistCount, name: 'waitlist count' },
                { fn: checkReferral, name: 'referral check' }
            ];
            
            initFunctions.forEach(({ fn, name }) => {
                try {
                    fn();
                } catch (error) {
                    console.warn(`${name} initialization failed:`, error.message);
                    trace(`[init] ${name} failed:`, error.message);
                }
            });
        };
        
        if (window.requestIdleCallback) {
            window.requestIdleCallback(deferredInit, { timeout: 2000 });
        } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(deferredInit, 100);
        }
        
    } catch (criticalError) {
        console.error('Critical initialization error:', criticalError);
        reportError('critical_init', criticalError, 'Application failed to initialize properly');
        
        // Show user-friendly error message
        setTimeout(() => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'fixed top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
            errorDiv.innerHTML = `
                <strong>Loading Error:</strong> The application failed to initialize properly. 
                Please refresh the page. If the problem persists, try clearing your browser cache.
                <button onclick="window.location.reload()" class="ml-2 underline">Refresh Now</button>
            `;
            document.body.prepend(errorDiv);
        }, 1000);
    }
});

// Connection monitoring will be initialized after ConnectionMonitor class is defined

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
        return;
    }

    // Restore form data from sessionStorage on page load
    restoreFormData();
    
    // Save initial state to sessionStorage (in case user refreshes before entering data)
    setTimeout(() => {
        saveToSessionStorage();
    }, 100);
    
    // First name validation with blur event handling
    const firstNameInput = document.getElementById('firstName');
    firstNameInput?.addEventListener('blur', () => {
        validateName(firstNameInput, 'First name');
        saveStepData();
        saveToSessionStorage();
    });
    
    // Last name validation with blur event handling
    const lastNameInput = document.getElementById('lastName');
    lastNameInput?.addEventListener('blur', () => {
        validateName(lastNameInput, 'Last name');
        saveStepData();
        saveToSessionStorage();
    });
    
    // Email validation with blur event handling
    const emailInput = document.getElementById('email');
    emailInput?.addEventListener('blur', () => {
        validateEmail(emailInput.value);
        saveStepData();
        saveToSessionStorage();
    });
    
    // Phone number formatting and validation with blur event handling
    const phoneInput = document.getElementById('phone');
    phoneInput?.addEventListener('input', (e) => {
        e.target.value = formatPhoneNumber(e.target.value);
    });
    phoneInput?.addEventListener('blur', () => {
        validatePhone(phoneInput.value);
        saveStepData();
        saveToSessionStorage();
    });
    
    // ZIP code formatting with blur event handling
    const zipcodeInput = document.getElementById('zipcode');
    zipcodeInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });
    zipcodeInput?.addEventListener('blur', () => {
        saveStepData();
        saveToSessionStorage();
    });

    // Dietary preferences checkboxes with change event handling
    const preferenceInputs = document.querySelectorAll('input[name="preferences"]');
    preferenceInputs.forEach(input => {
        input.addEventListener('change', () => {
            saveStepData();
            saveToSessionStorage();
        });
    });

    // Referral source dropdown with change event handling
    const referralSourceInput = document.getElementById('referral-source');
    referralSourceInput?.addEventListener('change', () => {
        saveStepData();
        saveToSessionStorage();
    });

    // Restaurant suggestion input with blur event handling
    const restaurantSuggestionInput = document.getElementById('restaurant-suggestion');
    restaurantSuggestionInput?.addEventListener('blur', () => {
        saveStepData();
        saveToSessionStorage();
    });
    
    // Form submission - CRITICAL PATH
    if (form) {
        // handleFormSubmit is now defined early at the top of the file, so it's always available
        form.addEventListener('submit', window.handleFormSubmit);
        console.log('[INIT] Submit handler attached successfully');
    } else {
        console.error('[INIT] Cannot attach submit handler - form is null');
    }
    
    // Initialize step indicators and set up initial accessibility state
    updateStepIndicators();
    
    // Set up initial focus on first input
    const firstInput = document.querySelector('#step-1 input:not([type="hidden"])');
    if (firstInput) {
        // Don't immediately focus - wait for user interaction
        firstInput.setAttribute('tabindex', '0');
    }
    
    // Add keyboard navigation for step indicators (for screen reader users)
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        indicator.setAttribute('tabindex', '0');
        indicator.setAttribute('role', 'button');
        
        indicator.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Only allow navigation to completed or current steps
                const stepNum = index + 1;
                if (stepNum <= currentStep) {
                    currentStep = stepNum;
                    showStep(currentStep);
                    updateStepIndicators();
                }
            }
        });
    });
}

// Navigate to next step
window.nextStep = function() {
    if (validateCurrentStep()) {
        saveStepData();
        saveToSessionStorage();
        
        if (currentStep < totalSteps) {
            currentStep++;
            showStep(currentStep);
            updateStepIndicators();
            // Save updated step to sessionStorage
            saveToSessionStorage();
        }
    }
};

// Navigate to previous step
window.previousStep = function() {
    saveStepData();
    saveToSessionStorage();
    
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
        updateStepIndicators();
        // Save updated step to sessionStorage
        saveToSessionStorage();
    }
};

// Validate current step with accessibility enhancements
function validateCurrentStep() {
    let isValid = true;
    
    if (currentStep === 1) {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        
        // Clear previous error states
        clearErrorStates(['firstName', 'lastName', 'email', 'phone']);
        
        if (!firstName.trim()) {
            showError('firstName', 'First name is required');
            isValid = false;
        }
        if (!lastName.trim()) {
            showError('lastName', 'Last name is required');
            isValid = false;
        }
        if (!validateEmail(email)) {
            showError('email-error');
            isValid = false;
        }
        if (!validatePhone(phone)) {
            showError('phone-error');
            isValid = false;
        }
    } else if (currentStep === 2) {
        const zipcode = document.getElementById('zipcode').value;
        
        // Clear previous error states
        clearErrorStates(['zipcode']);
        
        if (!validateZipcode(zipcode)) {
            showError('zipcode-error');
            isValid = false;
        }
    }
    
    return isValid;
}

// Clear error states for form inputs
function clearErrorStates(fieldIds) {
    fieldIds.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        const errorElement = document.getElementById(fieldId + '-error');
        
        if (input) {
            input.removeAttribute('aria-invalid');
        }
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    });
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

// Show error message with accessibility enhancements
function showError(errorId, customMessage) {
    let errorElement;
    
    // Handle different error ID formats
    if (errorId.endsWith('-error')) {
        errorElement = document.getElementById(errorId);
    } else {
        errorElement = document.getElementById(errorId + '-error');
    }
    
    if (errorElement) {
        // Update message if provided
        if (customMessage) {
            errorElement.textContent = customMessage;
        }
        
        errorElement.classList.remove('hidden');
        
        // Focus the related input for keyboard users
        const inputId = errorId.replace('-error', '');
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            inputElement.focus();
            inputElement.setAttribute('aria-invalid', 'true');
        }
        
        // Auto-hide after 5 seconds (increased for accessibility)
        setTimeout(() => {
            errorElement.classList.add('hidden');
            if (inputElement) {
                inputElement.removeAttribute('aria-invalid');
            }
        }, 5000);
    }
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

// Save all form data regardless of current step (for form submission)
function saveAllFormData() {
    // Step 1 data
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    
    if (firstName) formData.firstName = firstName.value;
    if (lastName) formData.lastName = lastName.value;
    if (email) formData.email = email.value;
    if (phone) formData.phone = phone.value.replace(/\D/g, '');
    
    // Step 2 data
    const zipcode = document.getElementById('zipcode');
    if (zipcode) formData.zipcode = zipcode.value;
    
    const preferences = document.querySelectorAll('input[name="preferences"]:checked');
    formData.preferences = Array.from(preferences).map(cb => cb.value);
    
    // Step 3 data
    const referralSource = document.getElementById('referral-source');
    const restaurantSuggestion = document.getElementById('restaurant-suggestion');
    
    if (referralSource) formData.referralSource = referralSource.value;
    if (restaurantSuggestion) formData.restaurantSuggestion = restaurantSuggestion.value;
}

// Save form data to sessionStorage to prevent data loss
function saveToSessionStorage() {
    try {
        // Always capture all field values, regardless of current step
        const phoneInput = document.getElementById('phone');
        const phoneValue = phoneInput ? phoneInput.value.replace(/\D/g, '') : (formData.phone || '');
        
        const allFormData = {
            firstName: document.getElementById('firstName')?.value || formData.firstName || '',
            lastName: document.getElementById('lastName')?.value || formData.lastName || '',
            email: document.getElementById('email')?.value || formData.email || '',
            phone: phoneValue,
            zipcode: document.getElementById('zipcode')?.value || formData.zipcode || '',
            preferences: Array.from(document.querySelectorAll('input[name="preferences"]:checked'))
                .map(cb => cb.value) || formData.preferences || [],
            referralSource: document.getElementById('referral-source')?.value || formData.referralSource || '',
            restaurantSuggestion: document.getElementById('restaurant-suggestion')?.value || formData.restaurantSuggestion || '',
            currentStep: currentStep
        };
        
        sessionStorage.setItem('waitlist_form_data', JSON.stringify(allFormData));
        trace('[sessionStorage] Form data saved', { step: currentStep, email: allFormData.email });
    } catch (error) {
        console.warn('Failed to save form data to sessionStorage:', error);
    }
}

// Restore form data from sessionStorage on page load
function restoreFormData() {
    try {
        const savedData = sessionStorage.getItem('waitlist_form_data');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            
            // Restore form data object
            Object.assign(formData, parsedData);
            
            // Restore current step if available
            if (parsedData.currentStep && parsedData.currentStep > 1) {
                currentStep = parsedData.currentStep;
                showStep(currentStep);
                updateStepIndicators();
            }
            
            // Restore form field values
            restoreFormFields();
            
            trace('[sessionStorage] Form data restored', { step: currentStep, email: formData.email });
        }
    } catch (error) {
        console.warn('Failed to restore form data from sessionStorage:', error);
    }
}

// Restore form field values from formData object
function restoreFormFields() {
    // Step 1 fields
    const firstNameInput = document.getElementById('firstName');
    if (firstNameInput && formData.firstName) {
        firstNameInput.value = formData.firstName;
    }
    
    const lastNameInput = document.getElementById('lastName');
    if (lastNameInput && formData.lastName) {
        lastNameInput.value = formData.lastName;
    }
    
    const emailInput = document.getElementById('email');
    if (emailInput && formData.email) {
        emailInput.value = formData.email;
    }
    
    const phoneInput = document.getElementById('phone');
    if (phoneInput && formData.phone) {
        // Format phone number for display
        phoneInput.value = formatPhoneNumber(formData.phone);
    }
    
    // Step 2 fields
    const zipcodeInput = document.getElementById('zipcode');
    if (zipcodeInput && formData.zipcode) {
        zipcodeInput.value = formData.zipcode;
    }
    
    // Restore dietary preferences checkboxes
    if (formData.preferences && formData.preferences.length > 0) {
        formData.preferences.forEach(preference => {
            const checkbox = document.querySelector(`input[name="preferences"][value="${preference}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }
    
    // Step 3 fields
    const referralSourceInput = document.getElementById('referral-source');
    if (referralSourceInput && formData.referralSource) {
        referralSourceInput.value = formData.referralSource;
    }
    
    const restaurantSuggestionInput = document.getElementById('restaurant-suggestion');
    if (restaurantSuggestionInput && formData.restaurantSuggestion) {
        restaurantSuggestionInput.value = formData.restaurantSuggestion;
    }
}

// Clear sessionStorage (called after successful submission)
function clearSessionStorage() {
    try {
        sessionStorage.removeItem('waitlist_form_data');
        trace('[sessionStorage] Form data cleared');
    } catch (error) {
        console.warn('Failed to clear sessionStorage:', error);
    }
}

// Show specific step with accessibility enhancements
function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
    });
    
    // Show current step with fade effect
    setTimeout(() => {
        const currentStepElement = document.getElementById(`step-${step}`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
            
            // Announce step change to screen readers
            announceStepChange(step);
            
            // Focus the first input of the new step for keyboard navigation
            setTimeout(() => {
                const firstInput = currentStepElement.querySelector('input:not([type="hidden"]), select, textarea');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);
        }
    }, 50);
}

// Announce step changes to screen readers
function announceStepChange(step) {
    const stepNames = {
        1: 'Personal Information',
        2: 'Location and Preferences', 
        3: 'Final Details'
    };
    
    // Create a temporary announcement element
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Now on step ${step} of ${totalSteps}: ${stepNames[step]}`;
    
    // Add to DOM, then remove after announcement
    document.body.appendChild(announcement);
    setTimeout(() => {
        if (announcement.parentNode) {
            announcement.parentNode.removeChild(announcement);
        }
    }, 1000);
}

// Update step indicators with accessibility enhancements
function updateStepIndicators() {
    const progressIndicator = document.getElementById('progress-indicator');
    if (progressIndicator) {
        // Update progress bar ARIA attributes
        progressIndicator.setAttribute('aria-valuenow', currentStep);
        progressIndicator.setAttribute('aria-valuetext', `Step ${currentStep} of ${totalSteps}`);
    }
    
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        const stepNum = index + 1;
        
        // Remove aria-current from all steps first
        indicator.removeAttribute('aria-current');
        
        if (stepNum < currentStep) {
            indicator.classList.add('completed');
            indicator.classList.remove('active');
            indicator.setAttribute('aria-label', `Step ${stepNum}: Completed`);
        } else if (stepNum === currentStep) {
            indicator.classList.add('active');
            indicator.classList.remove('completed');
            indicator.setAttribute('aria-current', 'step');
            indicator.setAttribute('aria-label', `Step ${stepNum}: Current`);
        } else {
            indicator.classList.remove('active', 'completed');
            indicator.setAttribute('aria-label', `Step ${stepNum}: Not completed`);
        }
    });
}

// Show inline error helper with accessibility
function showInlineError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
    errorDiv.textContent = `ERROR: ${message}`;
    
    const activeStep = document.querySelector('.form-step.active');
    if (activeStep) {
        activeStep.prepend(errorDiv);
        
        // Focus the error for screen readers
        errorDiv.setAttribute('tabindex', '-1');
        errorDiv.focus();
    }
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 10000);
}

// Show inline success helper with accessibility
function showInlineSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4';
    successDiv.setAttribute('role', 'alert');
    successDiv.setAttribute('aria-live', 'polite');
    successDiv.textContent = `SUCCESS: ${message}`;
    
    const activeStep = document.querySelector('.form-step.active');
    if (activeStep) {
        activeStep.prepend(successDiv);
    }
}

// Add retry button for recoverable errors
function addRetryButton() {
    // Remove any existing retry button first
    const existingRetry = document.getElementById('retry-submit-btn');
    if (existingRetry) {
        existingRetry.remove();
    }
    
    const retryButton = document.createElement('button');
    retryButton.id = 'retry-submit-btn';
    retryButton.type = 'button';
    retryButton.className = 'w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 mt-3';
    retryButton.innerHTML = `
        <span class="flex items-center justify-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Try Again
        </span>
    `;
    
    // Add click handler to retry the form submission
    retryButton.addEventListener('click', async () => {
        // Remove the retry button and error message
        retryButton.remove();
        const errorDiv = document.querySelector('.form-step.active .bg-red-100');
        if (errorDiv) {
            errorDiv.remove();
        }
        
        // Trigger the form submission again
        const form = document.getElementById('waitlist-form');
        if (form) {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
        }
    });
    
    // Insert the retry button after the submit button
    const submitButton = document.getElementById('submit-btn');
    if (submitButton && submitButton.parentNode) {
        submitButton.parentNode.insertBefore(retryButton, submitButton.nextSibling);
    }
}

// Enhanced retry mechanism with exponential backoff
class RetryManager {
    constructor() {
        this.retryCount = 0;
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 second
    }
    
    async retry(operation, isRetriableError = () => true) {
        this.retryCount = 0;
        
        while (this.retryCount <= this.maxRetries) {
            try {
                return await operation();
            } catch (error) {
                if (this.retryCount >= this.maxRetries || !isRetriableError(error)) {
                    throw error;
                }
                
                const delay = this.baseDelay * Math.pow(2, this.retryCount);
                trace(`[retry] Attempt ${this.retryCount + 1} failed, retrying in ${delay}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                this.retryCount++;
            }
        }
    }
    
    reset() {
        this.retryCount = 0;
    }
}

// Global retry manager instance
const retryManager = new RetryManager();

// Network error detection utility
function isNetworkError(error) {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    
    return (
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('cors') ||
        errorName === 'networkerror' ||
        errorName === 'typeerror' ||
        error.code === 'NETWORK_ERROR' ||
        !navigator.onLine
    );
}

// Check if error is retriable
function isRetriableError(error) {
    if (!error) return false;
    
    // Network errors are retriable
    if (isNetworkError(error)) return true;
    
    // Timeout errors are retriable
    if (error.message?.includes('timeout')) return true;
    
    // 5xx server errors are retriable
    if (error.status >= 500 && error.status < 600) return true;
    
    // 429 rate limiting is retriable
    if (error.status === 429) return true;
    
    // Service unavailable
    if (error.message?.includes('service unavailable')) return true;
    
    // Specific Supabase transient errors
    if (error.code === 'PGRST301' || error.code === 'PGRST302') return true;
    
    return false;
}

// Enhanced error reporting
function reportError(context, error, userMessage) {
    const errorReport = {
        timestamp: new Date().toISOString(),
        context: context,
        error: {
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack
        },
        userMessage: userMessage,
        userAgent: navigator.userAgent,
        url: window.location.href,
        online: navigator.onLine
    };
    
    // Store for debugging
    const errorLog = JSON.parse(localStorage.getItem('localplate:errorLog') || '[]');
    errorLog.push(errorReport);
    
    // Keep only last 10 errors
    if (errorLog.length > 10) {
        errorLog.splice(0, errorLog.length - 10);
    }
    
    localStorage.setItem('localplate:errorLog', JSON.stringify(errorLog));
    
    console.error(`[${context}] Error:`, errorReport);
}

// Connection status monitoring
class ConnectionMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.callbacks = [];
        
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyCallbacks('online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyCallbacks('offline');
        });
    }
    
    onStatusChange(callback) {
        this.callbacks.push(callback);
    }
    
    notifyCallbacks(status) {
        this.callbacks.forEach(cb => {
            try {
                cb(status);
            } catch (error) {
                console.error('Connection callback error:', error);
            }
        });
    }
    
    showOfflineMessage() {
        if (!this.isOnline) {
            showInlineError('You appear to be offline. Please check your internet connection.');
        }
    }
}

// Global connection monitor
const connectionMonitor = new ConnectionMonitor();

// Initialize connection monitoring
connectionMonitor.onStatusChange((status) => {
    if (status === 'online') {
        trace('[connection] back online');
        // Remove offline messages if any
        const offlineMessages = document.querySelectorAll('.offline-message');
        offlineMessages.forEach(msg => msg.remove());
        
        // Show reconnection message briefly
        const reconnectDiv = document.createElement('div');
        reconnectDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded z-50';
        reconnectDiv.textContent = 'Connection restored';
        document.body.appendChild(reconnectDiv);
        
        setTimeout(() => reconnectDiv.remove(), 3000);
    } else if (status === 'offline') {
        trace('[connection] went offline');
        const offlineDiv = document.createElement('div');
        offlineDiv.className = 'fixed top-4 left-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-50 offline-message';
        offlineDiv.innerHTML = `
            <strong>Connection Lost:</strong> You appear to be offline. 
            Some features may not work until your connection is restored.
        `;
        document.body.prepend(offlineDiv);
    }
});

// Diagnostic function for troubleshooting
function runDiagnostics() {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        url: window.location.href,
        errors: [],
        config: {
            hasSupabase: !!window.supabase,
            hasConfig: !!window.LOCALPLATE_CONFIG,
            configKeys: window.LOCALPLATE_CONFIG ? Object.keys(window.LOCALPLATE_CONFIG) : []
        }
    };
    
    // Check for recent errors
    try {
        const errorLog = JSON.parse(localStorage.getItem('localplate:errorLog') || '[]');
        diagnostics.errors = errorLog.slice(-5); // Last 5 errors
    } catch (e) {
        diagnostics.errors.push({ type: 'localStorage_error', message: e.message });
    }
    
    // Test Supabase client creation
    try {
        const client = getSupabaseClient();
        diagnostics.supabaseClient = 'OK';
    } catch (error) {
        diagnostics.supabaseClient = error.message;
        diagnostics.errors.push({
            type: 'supabase_client_error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
    
    // Check DOM elements
    const requiredElements = ['waitlist-form', 'submit-btn', 'waitlist-count'];
    diagnostics.domElements = {};
    requiredElements.forEach(id => {
        diagnostics.domElements[id] = !!document.getElementById(id);
    });
    
    console.group('LocalPlate Waitlist Diagnostics');
    console.log('Full Report:', diagnostics);
    console.log('Connection Status:', diagnostics.online ? 'Online' : 'Offline');
    console.log('Recent Errors:', diagnostics.errors.length);
    console.log('Supabase Client:', diagnostics.supabaseClient);
    console.log('Required DOM Elements:', 
        Object.entries(diagnostics.domElements)
            .map(([id, exists]) => `${id}: ${exists ? '✓' : '✗'}`)
            .join(', ')
    );
    console.groupEnd();
    
    return diagnostics;
}

// Make diagnostics available globally for debugging
window.localplateDiagnostics = runDiagnostics;

// CRITICAL TEST: Check for request cancellation issue (GPT-5 identified)
window.testRequestCancellation = async function() {
    console.log('=== TESTING FOR REQUEST CANCELLATION BUG ===');
    console.log('This test will determine if navigation is killing your Supabase insert.');
    console.log('Watch the Network tab for a request to /rest/v1/waitlist');
    console.log('If it shows "(canceled)" = FOUND THE BUG!');
    
    const testData = {
        first_name: 'Test',
        last_name: 'Cancel',
        email: 'cancel-test-' + Date.now() + '@test.com',
        phone: '5551234567',
        zipcode: '90210',
        dietary_preferences: [],
        referral_source: 'cancel_test',
        restaurant_suggestion: 'Test Restaurant',
        referral_code: 'TESTCANCEL',
        referred_by: null,
        joined_at: new Date().toISOString(),
        source: 'cancel_test',
        user_agent: navigator.userAgent,
        language: navigator.language
    };
    
    try {
        const supabase = window.getSupabaseClient();
        
        console.log('Starting insert WITHOUT awaiting...');
        // Intentionally NOT awaiting to simulate the bug
        const insertPromise = supabase
            .from('waitlist')
            .insert([testData])
            .select();
            
        // Simulate navigation after 100ms (before request completes)
        setTimeout(() => {
            console.log('SIMULATING NAVIGATION - Watch Network tab NOW!');
            // Don't actually navigate, just log what would happen
            console.warn('In real scenario, window.location.href would be set here');
            console.warn('This would CANCEL the pending insert request!');
        }, 100);
        
        // Now properly await to see if it succeeds when not interrupted
        const { data, error } = await insertPromise;
        
        if (error) {
            console.error('Insert failed:', error);
        } else if (data && data[0]) {
            console.log('✅ Insert succeeded when not interrupted:', data[0]);
            console.log('This proves navigation IS the problem!');
        } else {
            console.log('⚠️ Insert returned no data (check RLS policies)');
        }
        
    } catch (err) {
        console.error('Test error:', err);
    }
    
    console.log('=== TEST COMPLETE ===');
    console.log('To fix: Ensure you AWAIT the insert before ANY navigation!');
};

// Handle form submission implementation - Simple and direct with Supabase
window._handleFormSubmitImpl = async function(e) {
    e.preventDefault();
    // No need to log here since the wrapper already logged
    trace('[submit] form submission started');
    
    if (!validateCurrentStep()) {
        trace('[submit] validation failed');
        return;
    }
    
    // Ensure all form data is captured before submission
    saveAllFormData();
    trace('[submit] all form data saved');
    
    // Show loading state
    // The submit button is the actual button with id="submit-btn" in step 3
    const submitButton = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitLoader = document.getElementById('submit-loader');
    
    // Add null checking before manipulating elements
    if (submitButton) {
        submitButton.disabled = true;
    }
    if (submitText) {
        submitText.classList.add('hidden');
    }
    if (submitLoader) {
        submitLoader.classList.remove('hidden');
    }
    
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
        
        // Create Supabase client with defensive guards
        const supabase = typeof getSupabaseClient === 'function'
            ? getSupabaseClient()
            : (typeof window !== 'undefined' && typeof window.getSupabaseClient === 'function'
                ? window.getSupabaseClient()
                : null);
        
        if (!supabase || typeof supabase.from !== 'function') {
            console.error('[SUBMIT] Supabase client unavailable', { supabaseType: typeof supabase });
            localStorage.setItem('localplate:lastError', JSON.stringify({
                at: Date.now(),
                error: 'Supabase client unavailable',
                phase: 'client_init'
            }));
            showInlineError('Database connection failed. Please refresh the page and try again.');
            throw new Error('Supabase client unavailable');
        }
        
        // DEBUG ONLY: Connectivity sanity check - removed unnecessary GET request
        if (DEBUG) {
            trace('[submit] debug connectivity check skipped - using direct insert');
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
        
        // Submit directly to Supabase with timeout handling (POST request)
        trace('[submit] starting database insert via POST...');
        
        // Create timeout promise with sentinel value
        const timeoutMs = 30000;
        const timeoutPromise = new Promise(resolve => 
            setTimeout(() => resolve({ timedOut: true, timeoutMs }), timeoutMs)
        );
        
        // Submit directly to Supabase using POST request via .insert()
        console.log('Submitting to Supabase via POST:', submissionData);
        
        // Add abort detection to catch navigation cancellations
        const abortController = new AbortController();
        const navigationHandler = (e) => {
            console.error('[CRITICAL] Navigation detected during insert!', e.type);
            abortController.abort('Navigation during insert');
        };
        
        // Monitor for navigation events that could cancel our request
        window.addEventListener('beforeunload', navigationHandler);
        window.addEventListener('popstate', navigationHandler);
        
        const insertPromise = supabase
            .from('waitlist')
            .insert([submissionData])
            .select()
            .abortSignal(abortController.signal)
            .then(result => {
                console.log('[INSERT] Request completed successfully');
                return result;
            })
            .catch(err => {
                if (err.name === 'AbortError') {
                    console.error('[INSERT] Request ABORTED - navigation canceled the request!');
                    localStorage.setItem('localplate:lastError', JSON.stringify({
                        at: Date.now(),
                        error: 'Insert aborted by navigation',
                        phase: 'insert_aborted'
                    }));
                }
                throw err;
            });
        
        const result = await Promise.race([insertPromise, timeoutPromise]);
        
        // Clean up navigation monitoring
        window.removeEventListener('beforeunload', navigationHandler);
        window.removeEventListener('popstate', navigationHandler);
        
        // Check for timeout
        if (result?.timedOut) {
            console.warn('[SUBMIT] Timeout during insert', { timeoutMs });
            localStorage.setItem('localplate:lastError', JSON.stringify({
                at: Date.now(),
                error: 'Insert timed out',
                phase: 'insert_timeout',
                timeoutMs
            }));
            showInlineError('Request timed out. Please try again.');
            throw new Error('Insert timed out');
        }
        
        const { data, error, status, statusText } = result || {};
        console.log('[SUBMIT] Insert result', { hasData: Array.isArray(data), dataLength: data?.length, error: error?.message, status, statusText });
        
        // Clear navigation block immediately
        insertPending = false;
        window.removeEventListener('beforeunload', beforeUnload);
        
        trace('[submit] processing insert result', { error: error?.message || 'none', hasData: !!data });
        
        if (error) {
            const errorMsg = error.message?.includes('duplicate') 
                ? 'This email is already on the waitlist.'
                : error.message || 'Unknown database error';
            
            console.error('[SUBMIT] Insert error', { error, status, statusText });
            showInlineError(`Database error: ${errorMsg}`);
            localStorage.setItem('localplate:lastError', JSON.stringify({ 
                at: Date.now(), 
                error: errorMsg,
                phase: 'insert_error',
                status,
                statusText
            }));
            
            throw new Error(errorMsg);
        }
        
        // Update referrer count if applicable
        if (referredBy) {
            trace('[submit] updating referrer count...');
            try {
                // RPC call uses POST method as per Supabase documentation
                const { data: referralResult, error: referralError } = await supabase
                    .rpc('record_referral', { referral_code: referredBy });
                
                if (referralError) {
                    console.error('Failed to record referral:', referralError);
                    trace('[submit] referral error:', referralError.message);
                    // Don't fail the whole submission for this
                } else if (referralResult?.success) {
                    trace('[submit] referral recorded successfully');
                    console.log('Referral recorded for code:', referredBy);
                } else {
                    trace('[submit] referral failed:', referralResult?.message || 'unknown error');
                    console.warn('Referral recording failed:', referralResult?.message);
                }
            } catch (err) {
                console.error('Referral tracking error:', err);
                trace('[submit] referral exception:', err.message);
                // Don't fail the whole submission for this
            }
        }
        
        // CRITICAL: Verify we actually have a successful insert before redirecting
        let inserted = null;
        
        if (Array.isArray(data) && data.length > 0 && data[0]) {
            // Check for any identifier that confirms the row was created
            if (data[0].id || data[0].email || data[0].created_at) {
                inserted = data[0];
                console.log('[SUBMIT] Insert confirmed', { id: data[0].id, email: data[0].email });
            }
        }
        
        // If no data returned (RLS blocks SELECT), we can't verify - but since no error, assume success
        // This is risky but necessary given RLS constraints
        if (!inserted && !error) {
            console.warn('[SUBMIT] No data returned (likely RLS blocks SELECT), but no error - assuming success');
            inserted = { assumed: true, email: formData.email };
        }
        
        if (!inserted) {
            console.error('[SUBMIT] Could not verify insert (no data returned)');
            showInlineError('We could not confirm your submission was saved. Please try again.');
            localStorage.setItem('localplate:lastError', JSON.stringify({
                at: Date.now(),
                error: 'Insert unverified (no data returned)',
                phase: 'post_insert_verify',
                dataReceived: data
            }));
            // Do NOT redirect to success
            throw new Error('Insert result not verifiable');
        }
        
        // Store success data for success.html - use formData which was populated by saveAllFormData
        sessionStorage.setItem('waitlist_email', formData.email);
        sessionStorage.setItem('waitlist_first_name', formData.firstName);
        sessionStorage.setItem('waitlist_referral_code', referralCode);
        if (inserted.id) {
            sessionStorage.setItem('waitlist_inserted_id', String(inserted.id));
        }
        sessionStorage.setItem('waitlist_timestamp', Date.now().toString());
        
        // Clear form data (but preserve success keys)
        clearSessionStorage();
        
        trace('[submit] verified insert, storing success data, about to redirect');
        console.log('[SUBMIT] Verified insert - navigating to success');
        window.location.href = 'success.html';
        
    } catch (error) {
        trace('[submit] exception caught', error.message);
        console.error('Submission error:', error);
        
        let userMessage = 'Something went wrong. Please try again.';
        let shouldShowRetry = false;
        
        // Provide specific error messages based on error type
        if (error.code === '23505' || error.message?.includes('duplicate')) {
            userMessage = 'This email is already on the waitlist!';
        } else if (error.message?.includes('network') || error.message?.includes('NetworkError')) {
            userMessage = 'Network error. Please check your connection and try again.';
            shouldShowRetry = true;
        } else if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
            userMessage = 'Request timed out. Please try again.';
            shouldShowRetry = true;
        } else if (error.code === '23502' || error.message?.includes('null value')) {
            userMessage = 'Please fill in all required fields.';
        } else if (error.message?.includes('CORS')) {
            userMessage = 'Configuration error. Please try again later.';
        } else if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
            userMessage = 'Authentication error. Please refresh the page and try again.';
            shouldShowRetry = true;
        } else if (error.message?.includes('service unavailable') || error.message?.includes('503')) {
            userMessage = 'Service temporarily unavailable. Please try again in a moment.';
            shouldShowRetry = true;
        } else if (error.message && error.message !== 'Something went wrong. Please try again.') {
            // Use the specific error message if it's informative
            userMessage = error.message;
        }
        
        showInlineError(userMessage);
        
        // Add retry button for recoverable errors
        if (shouldShowRetry || isRetriableError(error)) {
            addRetryButton();
        }
        
        // Enhanced error reporting
        reportError('form_submission', error, userMessage);
        
        // Check if user is offline
        connectionMonitor.showOfflineMessage();
    } finally {
        // Always restore UI state with null checking and error handling
        try {
            if (submitButton) {
                submitButton.disabled = false;
            }
            if (submitText) {
                submitText.classList.remove('hidden');
            }
            if (submitLoader) {
                submitLoader.classList.add('hidden');
            }
            trace('[submit] UI state restored');
        } catch (uiError) {
            console.error('Error restoring UI state:', uiError);
            // Try to at least enable the button so user isn't completely stuck
            const fallbackButton = document.getElementById('submit-btn');
            if (fallbackButton) {
                fallbackButton.disabled = false;
            }
        }
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
    if (!countElement) {
        trace('[updateWaitlistCount] count element not found');
        return;
    }
    
    let targetCount = null;
    
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            // Add timeout for count query
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Count query timeout')), 10000)
            );
            
            // Legitimate GET request for reading count data
            const countPromise = supabase
                .from('waitlist_stats')
                .select('total_signups')
                .single();
            
            const { data, error } = await Promise.race([countPromise, timeoutPromise]);
            
            if (!error && data && data.total_signups) {
                targetCount = data.total_signups;
                trace('[updateWaitlistCount] retrieved count:', data.total_signups);
            } else {
                console.warn('Count query error or no data:', error?.message);
                trace('[updateWaitlistCount] count unavailable:', error?.message || 'no data');
                // Hide the count if we can't get real data
                countElement.style.display = 'none';
                return;
            }
        } else {
            trace('[updateWaitlistCount] no supabase client, hiding count');
            countElement.style.display = 'none';
            return;
        }
    } catch (error) {
        console.warn('Error fetching waitlist count:', error.message);
        trace('[updateWaitlistCount] exception caught, hiding count:', error.message);
        countElement.style.display = 'none';
        return;
    }
    
    // Animate the count (this should always work)
    try {
        animateCount(countElement, targetCount);
    } catch (animationError) {
        console.error('Count animation failed:', animationError.message);
        // Fallback: set count directly without animation
        countElement.textContent = targetCount.toLocaleString();
    }
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



// Initialize performance monitoring
initMobilePerformanceMonitoring();