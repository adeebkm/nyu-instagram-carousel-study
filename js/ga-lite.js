/**
 * GA4 Lite - Shared GA initialization and tracking
 * Handles PROLIFIC_ID from query string or localStorage
 */

(function() {
    'use strict';
    
    // Configuration
    const GA_MEASUREMENT_ID = 'G-ELZDTBWQV3';
    const PROLIFIC_ID_KEY = 'prolific_id';
    
    // Global tracking state
    window.GALite = {
        isLoaded: false,
        userId: null,
        measurementId: GA_MEASUREMENT_ID
    };
    
    /**
     * Get PROLIFIC_ID from URL query string, localStorage, or prompt
     */
    function getProlificId() {
        // Check URL query string first
        const urlParams = new URLSearchParams(window.location.search);
        const prolificFromUrl = urlParams.get('PROLIFIC_ID');
        
        if (prolificFromUrl) {
            // Save to localStorage for future visits
            try {
                localStorage.setItem(PROLIFIC_ID_KEY, prolificFromUrl);
            } catch (e) {
                console.warn('Could not save PROLIFIC_ID to localStorage:', e);
            }
            return prolificFromUrl;
        }
        
        // Check localStorage
        try {
            const prolificFromStorage = localStorage.getItem(PROLIFIC_ID_KEY);
            if (prolificFromStorage) {
                return prolificFromStorage;
            }
        } catch (e) {
            console.warn('Could not read PROLIFIC_ID from localStorage:', e);
        }
        
        // If neither URL nor localStorage has it, prompt user
        const prolificFromPrompt = prompt('Please enter your Participant ID:');
        if (prolificFromPrompt && prolificFromPrompt.trim()) {
            const trimmedId = prolificFromPrompt.trim();
            try {
                localStorage.setItem(PROLIFIC_ID_KEY, trimmedId);
            } catch (e) {
                console.warn('Could not save PROLIFIC_ID to localStorage:', e);
            }
            return trimmedId;
        }
        
        return null;
    }
    
    /**
     * Initialize GA4 with gtag.js
     */
    function initializeGA() {
        return new Promise((resolve, reject) => {
            try {
                // Get user ID
                window.GALite.userId = getProlificId();
                
                // Load gtag.js
                const script = document.createElement('script');
                script.async = true;
                script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
                script.onerror = () => reject(new Error('Failed to load gtag.js'));
                
                script.onload = () => {
                    // Initialize gtag
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    
                    gtag('js', new Date());
                    
                    // Configure GA with user_id if available
                    const config = {
                        send_page_view: true,
                        debug_mode: false
                    };
                    
                    if (window.GALite.userId) {
                        config.user_id = window.GALite.userId;
                    }
                    
                    gtag('config', GA_MEASUREMENT_ID, config);
                    
                    window.GALite.isLoaded = true;
                    resolve();
                };
                
                document.head.appendChild(script);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Track custom event with automatic user_id inclusion
     */
    function track(eventName, parameters = {}) {
        if (!window.GALite.isLoaded || typeof window.gtag !== 'function') {
            return; // Fail silently if GA is blocked
        }
        
        try {
            const eventData = { ...parameters };
            
            // Always include user_id if available
            if (window.GALite.userId) {
                eventData.user_id = window.GALite.userId;
            }
            
            window.gtag('event', eventName, eventData);
        } catch (error) {
            // Fail silently - no console errors
        }
    }
    
    /**
     * Track page view
     */
    function trackPageView(pageTitle = document.title, pagePath = window.location.pathname) {
        track('page_view', {
            page_title: pageTitle,
            page_location: window.location.href,
            page_path: pagePath
        });
    }
    
    // Expose public API
    window.GALite.init = initializeGA;
    window.GALite.track = track;
    window.GALite.trackPageView = trackPageView;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGA().catch(() => {
                // Fail silently if GA initialization fails
            });
        });
    } else {
        initializeGA().catch(() => {
            // Fail silently if GA initialization fails
        });
    }
    
})();
