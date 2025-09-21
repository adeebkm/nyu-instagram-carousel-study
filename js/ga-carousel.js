/**
 * GA4 Carousel Tracking
 * Tracks carousel interactions using existing selectors
 */

(function() {
    'use strict';
    
    // Configuration
    const MIN_DWELL_MS = 2000; // Minimum dwell time to count as "viewed"
    
    // Tracking state
    let carouselState = {
        isStarted: false,
        totalSlides: 0,
        currentSlide: 0,
        slideStartTime: null,
        slideViewedFlags: [], // Track which slides have been viewed long enough
        totalDwellTime: 0,
        slideHistory: [] // Track all slide visits with dwell times
    };
    
    /**
     * Initialize carousel tracking
     */
    function initCarouselTracking() {
        // Wait for GALite to be available
        if (!window.GALite) {
            setTimeout(initCarouselTracking, 100);
            return;
        }
        
        // Find carousel slides (adapt to existing structure)
        const slides = document.querySelectorAll('.reel-carousel-slide');
        if (slides.length === 0) {
            return; // No carousel found
        }
        
        carouselState.totalSlides = slides.length;
        carouselState.slideViewedFlags = new Array(slides.length).fill(false);
        
        // Set up navigation button listeners
        setupNavigationListeners();
        
        // Wait for tap-to-start before beginning tracking
        waitForTapToStart();
    }
    
    /**
     * Wait for tap-to-start before beginning carousel tracking
     */
    function waitForTapToStart() {
        const tapOverlay = document.getElementById('tap-to-start-overlay');
        if (!tapOverlay) {
            // No tap-to-start overlay, begin tracking immediately
            startCarouselTracking();
            return;
        }
        
        // Check if overlay is already hidden
        if (tapOverlay.classList.contains('hidden') || 
            window.getComputedStyle(tapOverlay).display === 'none') {
            startCarouselTracking();
            return;
        }
        
        // Wait for tap-to-start click
        tapOverlay.addEventListener('click', startCarouselTracking, { once: true });
    }
    
    /**
     * Start carousel tracking after tap-to-start
     */
    function startCarouselTracking() {
        trackCarouselStart();
        trackSlideView(0, 'start');
        carouselState.slideStartTime = Date.now();
    }
    
    /**
     * Track carousel start event
     */
    function trackCarouselStart() {
        if (!carouselState.isStarted) {
            carouselState.isStarted = true;
            window.GALite.track('carousel_start', {
                total_slides: carouselState.totalSlides
            });
        }
    }
    
    /**
     * Track slide view event
     */
    function trackSlideView(slideIndex, direction = 'unknown') {
        window.GALite.track('slide_view', {
            slide_index: slideIndex,
            direction: direction
        });
        
        carouselState.currentSlide = slideIndex;
    }
    
    /**
     * Track dwell end event when leaving a slide
     */
    function trackDwellEnd(slideIndex, dwellMs) {
        window.GALite.track('dwell_end', {
            slide_index: slideIndex,
            dwell_ms: dwellMs
        });
        
        // Mark slide as viewed if dwell time meets minimum
        if (dwellMs >= MIN_DWELL_MS) {
            carouselState.slideViewedFlags[slideIndex] = true;
        }
        
        // Add to total dwell time
        carouselState.totalDwellTime += dwellMs;
        
        // Store in history
        carouselState.slideHistory.push({
            slideIndex: slideIndex,
            dwellMs: dwellMs,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle slide change
     */
    function handleSlideChange(newSlideIndex, direction) {
        const now = Date.now();
        
        // Calculate dwell time for previous slide
        if (carouselState.slideStartTime !== null) {
            const dwellMs = now - carouselState.slideStartTime;
            trackDwellEnd(carouselState.currentSlide, dwellMs);
        }
        
        // Track new slide view
        trackSlideView(newSlideIndex, direction);
        
        // Update state
        carouselState.slideStartTime = now;
    }
    
    /**
     * Track carousel completion
     */
    function trackCarouselComplete() {
        // Calculate final dwell time for current slide
        if (carouselState.slideStartTime !== null) {
            const dwellMs = Date.now() - carouselState.slideStartTime;
            trackDwellEnd(carouselState.currentSlide, dwellMs);
            carouselState.slideStartTime = null;
        }
        
        // Check if all slides were viewed long enough
        const allViewed = carouselState.slideViewedFlags.every(viewed => viewed);
        
        window.GALite.track('carousel_complete', {
            total_dwell_ms: carouselState.totalDwellTime,
            all_viewed: allViewed
        });
    }
    
    /**
     * Set up navigation listeners for existing carousel system
     */
    function setupNavigationListeners() {
        // Hook into existing carousel system by observing the carousel track transform
        const track = document.querySelector('.reel-carousel-track');
        if (track) {
            // Use MutationObserver to detect transform changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        detectSlideChange();
                    }
                });
            });
            
            observer.observe(track, { 
                attributes: true, 
                attributeFilter: ['style'] 
            });
        }
        
        // Also listen for touchend events to detect swipes
        const carousel = document.querySelector('.reel-carousel');
        if (carousel) {
            let lastSlideIndex = 0;
            
            carousel.addEventListener('touchend', () => {
                // Small delay to let the animation start
                setTimeout(() => {
                    const currentSlideIndex = getCurrentSlideIndex();
                    if (currentSlideIndex !== lastSlideIndex) {
                        const direction = currentSlideIndex > lastSlideIndex ? 'next' : 'prev';
                        handleSlideChange(currentSlideIndex, direction);
                        lastSlideIndex = currentSlideIndex;
                    }
                }, 50);
            });
        }
        
        // Listen for dot clicks
        const dots = document.querySelectorAll('.reel-carousel-dot');
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                setTimeout(() => {
                    handleSlideChange(index, 'jump');
                }, 50);
            });
        });
    }
    
    /**
     * Get current slide index from carousel transform
     */
    function getCurrentSlideIndex() {
        const track = document.querySelector('.reel-carousel-track');
        if (!track) return 0;
        
        const transform = track.style.transform;
        if (!transform) return 0;
        
        // Extract translateX value and calculate slide index
        const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)%\)/);
        if (match) {
            const translatePercent = parseFloat(match[1]);
            return Math.round(Math.abs(translatePercent) / 100);
        }
        
        return 0;
    }
    
    /**
     * Detect slide change by checking transform
     */
    function detectSlideChange() {
        const currentSlideIndex = getCurrentSlideIndex();
        
        // If we detected a different slide than current, update
        if (currentSlideIndex !== carouselState.currentSlide) {
            const direction = currentSlideIndex > carouselState.currentSlide ? 'next' : 'prev';
            handleSlideChange(currentSlideIndex, direction);
        }
    }
    
    /**
     * Handle page unload - track final dwell time
     */
    function handlePageUnload() {
        if (carouselState.slideStartTime !== null) {
            const dwellMs = Date.now() - carouselState.slideStartTime;
            trackDwellEnd(carouselState.currentSlide, dwellMs);
        }
        
        // Only track completion if carousel was actually started
        if (carouselState.isStarted) {
            trackCarouselComplete();
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarouselTracking);
    } else {
        initCarouselTracking();
    }
    
    // Track final dwell time on page unload
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    
    // Expose for debugging (optional)
    window.CarouselTracker = {
        getState: () => ({ ...carouselState }),
        MIN_DWELL_MS: MIN_DWELL_MS
    };
    
})();

 * Tracks carousel interactions using existing selectors
 */

(function() {
    'use strict';
    
    // Configuration
    const MIN_DWELL_MS = 2000; // Minimum dwell time to count as "viewed"
    
    // Tracking state
    let carouselState = {
        isStarted: false,
        totalSlides: 0,
        currentSlide: 0,
        slideStartTime: null,
        slideViewedFlags: [], // Track which slides have been viewed long enough
        totalDwellTime: 0,
        slideHistory: [] // Track all slide visits with dwell times
    };
    
    /**
     * Initialize carousel tracking
     */
    function initCarouselTracking() {
        // Wait for GALite to be available
        if (!window.GALite) {
            setTimeout(initCarouselTracking, 100);
            return;
        }
        
        // Find carousel slides (adapt to existing structure)
        const slides = document.querySelectorAll('.reel-carousel-slide');
        if (slides.length === 0) {
            return; // No carousel found
        }
        
        carouselState.totalSlides = slides.length;
        carouselState.slideViewedFlags = new Array(slides.length).fill(false);
        
        // Set up navigation button listeners
        setupNavigationListeners();
        
        // Wait for tap-to-start before beginning tracking
        waitForTapToStart();
    }
    
    /**
     * Wait for tap-to-start before beginning carousel tracking
     */
    function waitForTapToStart() {
        const tapOverlay = document.getElementById('tap-to-start-overlay');
        if (!tapOverlay) {
            // No tap-to-start overlay, begin tracking immediately
            startCarouselTracking();
            return;
        }
        
        // Check if overlay is already hidden
        if (tapOverlay.classList.contains('hidden') || 
            window.getComputedStyle(tapOverlay).display === 'none') {
            startCarouselTracking();
            return;
        }
        
        // Wait for tap-to-start click
        tapOverlay.addEventListener('click', startCarouselTracking, { once: true });
    }
    
    /**
     * Start carousel tracking after tap-to-start
     */
    function startCarouselTracking() {
        trackCarouselStart();
        trackSlideView(0, 'start');
        carouselState.slideStartTime = Date.now();
    }
    
    /**
     * Track carousel start event
     */
    function trackCarouselStart() {
        if (!carouselState.isStarted) {
            carouselState.isStarted = true;
            window.GALite.track('carousel_start', {
                total_slides: carouselState.totalSlides
            });
        }
    }
    
    /**
     * Track slide view event
     */
    function trackSlideView(slideIndex, direction = 'unknown') {
        window.GALite.track('slide_view', {
            slide_index: slideIndex,
            direction: direction
        });
        
        carouselState.currentSlide = slideIndex;
    }
    
    /**
     * Track dwell end event when leaving a slide
     */
    function trackDwellEnd(slideIndex, dwellMs) {
        window.GALite.track('dwell_end', {
            slide_index: slideIndex,
            dwell_ms: dwellMs
        });
        
        // Mark slide as viewed if dwell time meets minimum
        if (dwellMs >= MIN_DWELL_MS) {
            carouselState.slideViewedFlags[slideIndex] = true;
        }
        
        // Add to total dwell time
        carouselState.totalDwellTime += dwellMs;
        
        // Store in history
        carouselState.slideHistory.push({
            slideIndex: slideIndex,
            dwellMs: dwellMs,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle slide change
     */
    function handleSlideChange(newSlideIndex, direction) {
        const now = Date.now();
        
        // Calculate dwell time for previous slide
        if (carouselState.slideStartTime !== null) {
            const dwellMs = now - carouselState.slideStartTime;
            trackDwellEnd(carouselState.currentSlide, dwellMs);
        }
        
        // Track new slide view
        trackSlideView(newSlideIndex, direction);
        
        // Update state
        carouselState.slideStartTime = now;
    }
    
    /**
     * Track carousel completion
     */
    function trackCarouselComplete() {
        // Calculate final dwell time for current slide
        if (carouselState.slideStartTime !== null) {
            const dwellMs = Date.now() - carouselState.slideStartTime;
            trackDwellEnd(carouselState.currentSlide, dwellMs);
            carouselState.slideStartTime = null;
        }
        
        // Check if all slides were viewed long enough
        const allViewed = carouselState.slideViewedFlags.every(viewed => viewed);
        
        window.GALite.track('carousel_complete', {
            total_dwell_ms: carouselState.totalDwellTime,
            all_viewed: allViewed
        });
    }
    
    /**
     * Set up navigation listeners for existing carousel system
     */
    function setupNavigationListeners() {
        // Hook into existing carousel system by observing the carousel track transform
        const track = document.querySelector('.reel-carousel-track');
        if (track) {
            // Use MutationObserver to detect transform changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        detectSlideChange();
                    }
                });
            });
            
            observer.observe(track, { 
                attributes: true, 
                attributeFilter: ['style'] 
            });
        }
        
        // Also listen for touchend events to detect swipes
        const carousel = document.querySelector('.reel-carousel');
        if (carousel) {
            let lastSlideIndex = 0;
            
            carousel.addEventListener('touchend', () => {
                // Small delay to let the animation start
                setTimeout(() => {
                    const currentSlideIndex = getCurrentSlideIndex();
                    if (currentSlideIndex !== lastSlideIndex) {
                        const direction = currentSlideIndex > lastSlideIndex ? 'next' : 'prev';
                        handleSlideChange(currentSlideIndex, direction);
                        lastSlideIndex = currentSlideIndex;
                    }
                }, 50);
            });
        }
        
        // Listen for dot clicks
        const dots = document.querySelectorAll('.reel-carousel-dot');
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                setTimeout(() => {
                    handleSlideChange(index, 'jump');
                }, 50);
            });
        });
    }
    
    /**
     * Get current slide index from carousel transform
     */
    function getCurrentSlideIndex() {
        const track = document.querySelector('.reel-carousel-track');
        if (!track) return 0;
        
        const transform = track.style.transform;
        if (!transform) return 0;
        
        // Extract translateX value and calculate slide index
        const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)%\)/);
        if (match) {
            const translatePercent = parseFloat(match[1]);
            return Math.round(Math.abs(translatePercent) / 100);
        }
        
        return 0;
    }
    
    /**
     * Detect slide change by checking transform
     */
    function detectSlideChange() {
        const currentSlideIndex = getCurrentSlideIndex();
        
        // If we detected a different slide than current, update
        if (currentSlideIndex !== carouselState.currentSlide) {
            const direction = currentSlideIndex > carouselState.currentSlide ? 'next' : 'prev';
            handleSlideChange(currentSlideIndex, direction);
        }
    }
    
    /**
     * Handle page unload - track final dwell time
     */
    function handlePageUnload() {
        if (carouselState.slideStartTime !== null) {
            const dwellMs = Date.now() - carouselState.slideStartTime;
            trackDwellEnd(carouselState.currentSlide, dwellMs);
        }
        
        // Only track completion if carousel was actually started
        if (carouselState.isStarted) {
            trackCarouselComplete();
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarouselTracking);
    } else {
        initCarouselTracking();
    }
    
    // Track final dwell time on page unload
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    
    // Expose for debugging (optional)
    window.CarouselTracker = {
        getState: () => ({ ...carouselState }),
        MIN_DWELL_MS: MIN_DWELL_MS
    };
    
})();











