/*
 * LocalPlate Waitlist – Single Step Email Capture
 * Simplified client with UTM persistence, telemetry, and responsive UX.
 */

(function () {
    'use strict';

    const DEBUG = new URLSearchParams(window.location.search).has('debug');
    const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const LEAD_CONTEXT_KEY = 'localplate:lead_context';
    const SUCCESS_CONTEXT_KEY = 'waitlist_lead_context';
    const SUCCESS_EMAIL_KEY = 'waitlist_email';
    const SUCCESS_REFERRAL_KEY = 'waitlist_referral_code';
    const SUCCESS_TIMESTAMP_KEY = 'waitlist_timestamp';

    let leadContext = loadLeadContext();

    function trace(...args) {
        if (DEBUG) {
            console.log('[waitlist]', ...args);
        }
    }

    function loadLeadContext() {
        try {
            const raw = sessionStorage.getItem(LEAD_CONTEXT_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            trace('loadLeadContext failed', error.message);
            return {};
        }
    }

    function saveLeadContext(context) {
        try {
            sessionStorage.setItem(LEAD_CONTEXT_KEY, JSON.stringify(context));
        } catch (error) {
            trace('saveLeadContext failed', error.message);
        }
    }

    // Global error capture for quick diagnostics
    if (typeof window !== 'undefined') {
        window.__lpLogs = window.__lpLogs || [];
        const pushLog = (type, payload) => {
            try {
                window.__lpLogs.push({ at: Date.now(), type, payload });
                if (window.__lpLogs.length > 500) {
                    window.__lpLogs.shift();
                }
            } catch (error) {
                trace('pushLog error', error.message);
            }
        };

        window.addEventListener('error', (event) => {
            console.error('[GLOBAL ERROR]', event.error || event.message);
            pushLog('error', {
                message: event.message,
                stack: event.error?.stack,
                filename: event.filename,
                line: event.lineno,
            });
            try {
                localStorage.setItem('localplate:lastError', JSON.stringify({
                    at: Date.now(),
                    error: event.message,
                    phase: 'global_error',
                }));
            } catch (_) {}
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('[UNHANDLED REJECTION]', event.reason);
            pushLog('unhandledrejection', {
                reason: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
            });
            try {
                localStorage.setItem('localplate:lastError', JSON.stringify({
                    at: Date.now(),
                    error: event.reason?.message || String(event.reason),
                    phase: 'unhandled_rejection',
                }));
            } catch (_) {}
        });
    }

    function reportError(phase, error, friendlyMessage) {
        const payload = {
            at: Date.now(),
            phase,
            error: friendlyMessage || error?.message || 'Unknown error',
            details: error?.stack || null,
        };
        try {
            localStorage.setItem('localplate:lastError', JSON.stringify(payload));
        } catch (_) {}
        if (!friendlyMessage && error) {
            console.error(`[${phase}]`, error);
        } else if (friendlyMessage) {
            if (error) {
                console.warn(`[${phase}] ${friendlyMessage}`, error);
            } else {
                console.warn(`[${phase}] ${friendlyMessage}`);
            }
        }
    }

    function parseJSON(value, fallback = null) {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (error) {
            trace('parseJSON failed', error.message);
            return fallback;
        }
    }

    window.getSupabaseClient = function () {
        trace('getSupabaseClient called');
        try {
            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                throw new Error('Supabase library not loaded.');
            }
            if (!window.LOCALPLATE_CONFIG) {
                throw new Error('Configuration not loaded.');
            }

            const SUPABASE_URL = window.LOCALPLATE_CONFIG?.supabase?.url;
            const SUPABASE_ANON_KEY = window.LOCALPLATE_CONFIG?.supabase?.anonKey;

            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new Error('Supabase credentials missing.');
            }
            if (!SUPABASE_URL.startsWith('https://')) {
                throw new Error('Invalid Supabase URL.');
            }

            const options = DEBUG ? { global: { fetch: createDebugFetch(fetch) } } : {};
            const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
            if (!client) {
                throw new Error('Failed to create Supabase client');
            }
            return client;
        } catch (error) {
            reportError('supabase_client', error, error.message);
            throw error;
        }
    };

    function createDebugFetch(origFetch = fetch) {
        return async (url, options) => {
            const start = performance.now();
            trace('supabase fetch →', options?.method || 'GET', String(url));
            try {
                const response = await origFetch(url, options);
                trace('supabase fetch ←', response.status, );
                return response;
            } catch (error) {
                trace('supabase fetch ✖', error.message);
                throw error;
            }
        };
    }

    function captureLandingContext() {
        const params = new URLSearchParams(window.location.search);
        let touched = false;

        const utms = {};
        UTMS.forEach((key) => {
            const value = params.get(key);
            if (value) {
                utms[key] = value;
            }
        });
        if (Object.keys(utms).length > 0) {
            leadContext.utms = Object.assign({}, leadContext.utms || {}, utms);
            touched = true;
        }

        if (!leadContext.landing_url) {
            leadContext.landing_url = window.location.pathname + window.location.search;
            touched = true;
        }

        if (!leadContext.referrer && document.referrer) {
            leadContext.referrer = document.referrer;
            touched = true;
        }

        if (!leadContext.captured_at) {
            leadContext.captured_at = new Date().toISOString();
            touched = true;
        }

        const sourceHint = params.get('source');
        if (sourceHint && !leadContext.discovery) {
            leadContext.discovery = sourceHint;
            touched = true;
        }

        if (touched) {
            saveLeadContext(leadContext);
        }
    }

    function captureReferralParam() {
        try {
            const params = new URLSearchParams(window.location.search);
            const referralParam = params.get('ref') || params.get('referral');
            if (referralParam) {
                const value = referralParam.trim().toUpperCase();
                if (value) {
                    localStorage.setItem('referrer_code', value);
                    leadContext.referred_by = value;
                    saveLeadContext(leadContext);
                }
            }
        } catch (error) {
            trace('captureReferralParam failed', error.message);
        }
    }

    function initDarkMode() {
        const themeToggle = document.getElementById('theme-toggle');
        const root = document.documentElement;
        const storedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = storedTheme ? storedTheme === 'dark' : prefersDark;

        if (isDark) {
            root.classList.add('dark');
        }

        themeToggle?.addEventListener('click', () => {
            const currentlyDark = root.classList.toggle('dark');
            localStorage.setItem('theme', currentlyDark ? 'dark' : 'light');
        });
    }

    function validateEmail(value) {
        if (!value) return false;
        const trimmed = value.trim().toLowerCase();
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(trimmed);
    }

    function showInlineError(message) {
        const errorElement = document.getElementById('email-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
        const input = document.getElementById('email');
        input?.setAttribute('aria-invalid', 'true');
    }

    function clearInlineError() {
        const errorElement = document.getElementById('email-error');
        errorElement?.classList.add('hidden');
        const input = document.getElementById('email');
        input?.removeAttribute('aria-invalid');
    }

    function setLoadingState(isLoading) {
        const submitButton = document.getElementById('submit-btn');
        const submitText = document.getElementById('submit-text');
        const submitLoader = document.getElementById('submit-loader');

        if (submitButton) {
            submitButton.disabled = isLoading;
        }
        if (submitText) {
            submitText.classList.toggle('hidden', isLoading);
        }
        if (submitLoader) {
            submitLoader.classList.toggle('hidden', !isLoading);
        }
    }

    function sanitizeMetadata(metadata = {}) {
        return Object.fromEntries(
            Object.entries(metadata).filter(([_, value]) => value !== undefined && value !== null && value !== '')
        );
    }

    function buildSubmissionPayload(email, referralCode, referredBy) {
        const utms = leadContext?.utms || {};
        const baseMetadata = {
            utms,
            landing_url: leadContext?.landing_url || (window.location.pathname + window.location.search),
            referrer: leadContext?.referrer || document.referrer || null,
            captured_at: leadContext?.captured_at || new Date().toISOString(),
            entry_variant: 'email_only_v1',
        };

        const payload = {
            first_name: '',
            last_name: '',
            email,
            phone: '',
            zipcode: '',
            referral_code: referralCode,
            referred_by: referredBy || null,
            referral_source: leadContext?.discovery || null,
            joined_at: new Date().toISOString(),
            source: 'waitlist_email_capture',
            user_agent: navigator.userAgent,
            language: navigator.language,
            tags: ['email_only_v1'],
            metadata: sanitizeMetadata(baseMetadata),
        };

        return payload;
    }

    function storeSuccessSession(email, referralCode) {
        try {
            sessionStorage.setItem(SUCCESS_EMAIL_KEY, email);
            sessionStorage.setItem(SUCCESS_REFERRAL_KEY, referralCode);
            sessionStorage.setItem(SUCCESS_TIMESTAMP_KEY, Date.now().toString());
            sessionStorage.setItem(SUCCESS_CONTEXT_KEY, JSON.stringify(leadContext || {}));
        } catch (error) {
            trace('storeSuccessSession failed', error.message);
        }
    }

    async function logTelemetry(eventType, payload = {}, extra = {}) {
        try {
            const supabase = getSupabaseClient();
            const utms = leadContext?.utms || {};
            const telemetryPayload = {
                event_type: eventType,
                occurred_at: new Date().toISOString(),
                metadata: sanitizeMetadata({
                    ...payload,
                    landing_url: leadContext?.landing_url,
                    referrer: leadContext?.referrer,
                }),
                email: extra.email || null,
                referral_code: extra.referral_code || null,
                utm_source: utms.utm_source || null,
                utm_medium: utms.utm_medium || null,
                utm_campaign: utms.utm_campaign || null,
            };

            await supabase.from('waitlist_events').insert([telemetryPayload]);
        } catch (error) {
            trace('logTelemetry failed', error.message);
        }
    }

    function generateReferralCode(email) {
        const hash = email.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const code = Math.abs(hash).toString(36).toUpperCase();
        return code.padStart(8, '0').substring(0, 8);
    }

    async function handleEmailSubmit(event) {
        event.preventDefault();
        clearInlineError();

        const emailInput = document.getElementById('email');
        const emailValue = emailInput?.value.trim();

        if (!validateEmail(emailValue)) {
            showInlineError('Please enter a valid email address');
            emailInput?.focus();
            return;
        }

        setLoadingState(true);
        const email = emailValue.toLowerCase();
        const referralCode = generateReferralCode(email);
        const referredBy = leadContext?.referred_by || localStorage.getItem('referrer_code');

        try {
            const supabase = getSupabaseClient();
            const payload = buildSubmissionPayload(email, referralCode, referredBy);

            const insertPromise = supabase.from('waitlist').insert([payload]).select('id');
            const timeoutMs = 30000;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs)
            );

            const result = await Promise.race([insertPromise, timeoutPromise]);
            if (result?.error) {
                const message = normalizeInsertError(result.error);
                showInlineError(message);
                reportError('form_submission', result.error, message);
                return;
            }

            storeSuccessSession(email, referralCode);
            await logTelemetry('lead_captured', { referred_by: referredBy || null }, { email, referral_code: referralCode });
            trackEvent('lead_captured', {
                method: 'email_only',
                referred_by: referredBy || undefined,
            });

            window.location.href = 'success.html';
        } catch (error) {
            const message = deriveFriendlyMessage(error);
            showInlineError(message);
            reportError('form_submission_exception', error, message);
        } finally {
            setLoadingState(false);
        }
    }

    function normalizeInsertError(error) {
        const message = error?.message || '';
        if (message.includes('duplicate key value') || message.includes('already exists')) {
            return 'This email is already on the waitlist.';
        }
        if (message.toLowerCase().includes('timeout')) {
            return 'Request timed out. Please try again.';
        }
        if (message.toLowerCase().includes('network')) {
            return 'Network error. Please check your connection and try again.';
        }
        return message || 'Something went wrong. Please try again.';
    }

    function deriveFriendlyMessage(error) {
        if (!error) {
            return 'Something went wrong. Please try again.';
        }
        const message = error.message || '';
        if (!message) {
            return 'Something went wrong. Please try again.';
        }
        if (message.includes('timed out')) {
            return 'Request timed out. Please try again.';
        }
        if (message.includes('Supabase library not loaded')) {
            return 'We could not reach our servers. Please refresh and try again.';
        }
        if (message.includes('credentials')) {
            return 'Configuration error. Please try again later.';
        }
        if (message.includes('network')) {
            return 'Network error. Please check your connection and try again.';
        }
        return message;
    }

    function initWaitlistForm() {
        const form = document.getElementById('waitlist-form');
        if (!form) {
            trace('waitlist form not found');
            return;
        }

        form.addEventListener('submit', handleEmailSubmit);
        const emailInput = document.getElementById('email');
        emailInput?.addEventListener('input', () => {
            if (emailInput.getAttribute('aria-invalid')) {
                clearInlineError();
            }
        });
    }

    function updateWaitlistStatus() {
        const label = document.querySelector('.waitlist-status-eyebrow');
        if (!label) return;

        try {
            const supabase = getSupabaseClient();
            supabase
                .rpc('get_capacity_status')
                .then(({ data, error }) => {
                    if (error || !data) {
                        trace('capacity status error', error?.message);
                        return;
                    }
                    const { filled_percent, spots_left, status } = data;
                    const percent = typeof filled_percent === 'number' ? Math.round(filled_percent) : null;
                    const copy = buildStatusCopy({ percent, spots_left, status });
                    if (copy) {
                        label.textContent = copy;
                    }
                })
                .catch((error) => trace('capacity status exception', error.message));
        } catch (error) {
            trace('updateWaitlistStatus failed', error.message);
        }
    }

    function buildStatusCopy({ status }) {
        if (status === 'closed') {
            return 'Founding Cohort · waitlist paused';
        }
        return 'Founding Cohort · limited to 500 invites';
    }

    function initScrollReveal() {
        const elements = document.querySelectorAll('.reveal-on-scroll');
        if (!elements.length) return;

        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        obs.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: window.innerWidth <= 768 ? 0.15 : 0.25,
                rootMargin: '0px 0px -60px 0px',
            }
        );

        elements.forEach((el) => observer.observe(el));
    }

    function initMarquee() {
        const marquee = document.querySelector('.marquee-container');
        if (!marquee) return;

        let scrollTimeout;
        window.addEventListener(
            'scroll',
            () => {
                if (window.innerWidth <= 768) {
                    marquee.classList.add('paused');
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(() => marquee.classList.remove('paused'), 150);
                }
            },
            { passive: true }
        );

        marquee.addEventListener(
            'mouseenter',
            () => marquee.classList.add('paused'),
            { passive: true }
        );
        marquee.addEventListener(
            'mouseleave',
            () => marquee.classList.remove('paused'),
            { passive: true }
        );
    }

    function trackEvent(eventName, eventData = {}) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, eventData);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        try {
            initDarkMode();
            captureLandingContext();
            captureReferralParam();
            initWaitlistForm();
            updateWaitlistStatus();
            initScrollReveal();
            initMarquee();
        } catch (error) {
            reportError('dom_init', error, error.message);
        }
    });
})();
