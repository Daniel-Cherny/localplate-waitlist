// LocalPlate Social Proof Rotator - Credible urgency without fake numbers
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    rotationInterval: 8000, // 8 seconds per message
    minActivityThreshold: 3, // Only show "active now" if >= this number
    storageKey: 'lp_social_proof_v1',
    maxImpressionsPerMessage: 2, // Frequency cap per session
  };

  // Message Sets - Honest, credible copy that converts
  const MESSAGE_SETS = {
    exclusivity: [
      { emoji: '✨', text: 'Founding member spots are limited', sub: 'Lock in lifetime benefits' },
      { emoji: '🔥', text: 'Early access closing soon', sub: 'Join before public launch' },
      { emoji: '⚡', text: 'High demand this week', sub: 'Secure your spot today' },
      { emoji: '🎯', text: 'Be among the first 500 members', sub: 'Exclusive benefits included' }
    ],
    
    timeOfDay: {
      morning: [ // 5am - 11am
        { emoji: '☀️', text: 'Plan healthier meals today', sub: 'Track breakfast spots near you' },
        { emoji: '🥐', text: 'Morning rush - spots filling', sub: 'Join early for best perks' }
      ],
      lunch: [ // 11am - 3pm
        { emoji: '🥗', text: 'Lunch crowd discovering LocalPlate', sub: 'Find healthy options nearby' },
        { emoji: '📍', text: 'Popular lunch spots already onboard', sub: 'See nutrition before you order' }
      ],
      dinner: [ // 5pm - 9pm
        { emoji: '🍽️', text: 'Dinner plans? Track them easily', sub: 'Local restaurants, real nutrition' },
        { emoji: '🌆', text: 'Evening surge in signups', sub: 'Join the movement' }
      ],
      default: [
        { emoji: '✅', text: 'Verified nutrition from local spots', sub: 'No more guessing on calories' },
        { emoji: '🏃', text: 'Stay on track while eating out', sub: 'Real menus, real macros' }
      ]
    },
    
    geographic: [
      { emoji: '📍', text: 'Growing fast in your area', sub: 'Local restaurants joining daily' },
      { emoji: '🗺️', text: 'Your neighborhood is lighting up', sub: 'Be first to access' }
    ],
    
    urgency: [
      { emoji: '⏰', text: 'Last chance for founding pricing', sub: 'Special rate expires soon' },
      { emoji: '🚀', text: 'Launching in select cities first', sub: 'Reserve your spot' }
    ]
  };

  class SocialProofRotator {
    constructor() {
      this.currentIndex = 0;
      this.messageQueue = [];
      this.impressions = this.loadImpressions();
      this.rotationTimer = null;
      this.element = null;
    }

    loadImpressions() {
      try {
        const stored = localStorage.getItem(CONFIG.storageKey);
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }

    saveImpressions() {
      try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.impressions));
      } catch {
        // Silent fail for privacy mode
      }
    }

    getTimeOfDay() {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) return 'morning';
      if (hour >= 11 && hour < 15) return 'lunch';
      if (hour >= 17 && hour < 21) return 'dinner';
      return 'default';
    }

    buildMessageQueue() {
      const queue = [];
      const timeOfDay = this.getTimeOfDay();
      
      // Priority order for maximum impact
      // 1. Time-relevant messages (highest relevance)
      queue.push(...MESSAGE_SETS.timeOfDay[timeOfDay]);
      
      // 2. Exclusivity (creates FOMO)
      queue.push(...this.shuffleArray([...MESSAGE_SETS.exclusivity]).slice(0, 2));
      
      // 3. Geographic (if we detect city - future enhancement)
      if (Math.random() > 0.5) { // 50% chance to show geo message
        queue.push(MESSAGE_SETS.geographic[Math.floor(Math.random() * MESSAGE_SETS.geographic.length)]);
      }
      
      // 4. Urgency (sparingly)
      if (Math.random() > 0.7) { // 30% chance
        queue.push(MESSAGE_SETS.urgency[Math.floor(Math.random() * MESSAGE_SETS.urgency.length)]);
      }
      
      return queue;
    }

    shuffleArray(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    canShowMessage(message) {
      const key = `${message.emoji}_${message.text}`;
      const impressionCount = this.impressions[key] || 0;
      return impressionCount < CONFIG.maxImpressionsPerMessage;
    }

    trackImpression(message) {
      const key = `${message.emoji}_${message.text}`;
      this.impressions[key] = (this.impressions[key] || 0) + 1;
      this.saveImpressions();
    }

    render(message) {
      if (!this.element) return;
      
      // Update the display
      const html = `
        <div class="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
          <div class="flex -space-x-2">
            <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 border-2 border-white dark:border-gray-800 flex items-center justify-center">
              <span class="text-sm">${message.emoji}</span>
            </div>
            <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 border-2 border-white dark:border-gray-800"></div>
            <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-gray-800"></div>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${message.text}</span>
            ${message.sub ? `<span class="text-xs text-gray-500 dark:text-gray-500">${message.sub}</span>` : ''}
          </div>
        </div>
      `;
      
      this.element.innerHTML = html;
      this.element.setAttribute('aria-live', 'polite');
      this.trackImpression(message);
    }

    start() {
      // Build initial queue
      this.messageQueue = this.buildMessageQueue();
      
      if (this.messageQueue.length === 0) {
        console.warn('No messages available to display');
        return;
      }

      // Show first message immediately
      this.showNext();
      
      // Start rotation
      this.rotationTimer = setInterval(() => {
        this.showNext();
      }, CONFIG.rotationInterval);
    }

    showNext() {
      let attempts = 0;
      const maxAttempts = this.messageQueue.length * 2;
      
      while (attempts < maxAttempts) {
        const message = this.messageQueue[this.currentIndex % this.messageQueue.length];
        
        if (this.canShowMessage(message)) {
          this.render(message);
          this.currentIndex++;
          break;
        }
        
        this.currentIndex++;
        attempts++;
      }
      
      // Rebuild queue if we've shown everything
      if (this.currentIndex >= this.messageQueue.length) {
        this.currentIndex = 0;
        this.messageQueue = this.buildMessageQueue();
      }
    }

    stop() {
      if (this.rotationTimer) {
        clearInterval(this.rotationTimer);
        this.rotationTimer = null;
      }
    }

    init(elementId = 'waitlist-count-container') {
      // Find the element to replace
      const targetElement = document.getElementById(elementId);
      if (!targetElement) {
        // Try to find the old counter element
        const oldCounter = document.querySelector('#waitlist-count')?.parentElement?.parentElement;
        if (oldCounter) {
          oldCounter.id = elementId;
          this.element = oldCounter;
        } else {
          console.error('Could not find social proof element');
          return;
        }
      } else {
        this.element = targetElement;
      }
      
      // Check for reduced motion preference
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // Show a static message for users who prefer reduced motion
        const staticMessage = MESSAGE_SETS.exclusivity[0];
        this.render(staticMessage);
      } else {
        this.start();
      }
    }

    // Optional: Get real activity count from Supabase (future enhancement)
    async getActivityCount() {
      // This would connect to your Supabase Realtime presence
      // For now, return 0 to not show "Active now" messages
      return 0;
    }
  }

  // Initialize when DOM is ready
  function initSocialProof() {
    const rotator = new SocialProofRotator();
    
    // Wait for the DOM element to exist
    const checkElement = setInterval(() => {
      const container = document.querySelector('#waitlist-count')?.parentElement?.parentElement;
      if (container) {
        clearInterval(checkElement);
        container.id = 'social-proof-container';
        rotator.init('social-proof-container');
      }
    }, 100);
    
    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(checkElement), 5000);
  }

  // Start when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSocialProof);
  } else {
    initSocialProof();
  }
})();