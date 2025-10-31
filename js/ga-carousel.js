/**
 * GA4 Reel Carousel Tracking - FIXED VERSION
 * Updated to match working Feed Carousel tracking mechanism
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
            console.log('❌ No reel carousel slides found');
            return; // No carousel found
        }
        
        carouselState.totalSlides = slides.length;
        carouselState.slideViewedFlags = new Array(slides.length).fill(false);
        
        console.log(`🎠 Initialized reel carousel with ${slides.length} slides`);
        
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
            console.log('🎠 No tap overlay, starting tracking immediately');
            startCarouselTracking();
            return;
        }
        
        // Check if overlay is already hidden
        if (tapOverlay.classList.contains('hidden') || 
            window.getComputedStyle(tapOverlay).display === 'none') {
            console.log('🎠 Tap overlay already hidden, starting tracking');
            startCarouselTracking();
            return;
        }
        
        console.log('🎠 Waiting for tap-to-start...');
        // Wait for tap-to-start click
        tapOverlay.addEventListener('click', startCarouselTracking, { once: true });
    }
    
    /**
     * Start carousel tracking after tap-to-start
     */
    function startCarouselTracking() {
        console.log('🎠 Starting carousel tracking...');
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
            console.log('🎠 Reel Carousel started');
            
            window.GALite.track('carousel_start', {
                carousel_id: 'reel_carousel_1',
                carousel_type: 'reel_carousel',
                total_slides: carouselState.totalSlides,
                study_id: 'instagram_study'
            });
        }
    }
    
    /**
     * Track slide view event
     */
    function trackSlideView(slideIndex, direction = 'unknown') {
        console.log(`👁️ Reel Slide ${slideIndex} viewed (${direction})`);
        
        window.GALite.track('slide_view', {
            carousel_id: 'reel_carousel_1',
            carousel_type: 'reel_carousel',
            slide_index: slideIndex,
            total_slides: carouselState.totalSlides,
            direction: direction,
            study_id: 'instagram_study'
        });
        
        carouselState.currentSlide = slideIndex;
    }
    
    /**
     * Track dwell end event when leaving a slide
     */
    function trackDwellEnd(slideIndex, dwellMs) {
        // Track ALL dwell times (removed minimum threshold to capture brief interactions)
        console.log(`⏱️ Reel Slide ${slideIndex} dwell end: ${dwellMs}ms`);
        
        window.GALite.track('dwell_end', {
            carousel_id: 'reel_carousel_1',
            carousel_type: 'reel_carousel',
            slide_index: slideIndex,
            dwell_ms: dwellMs,
            study_id: 'instagram_study'
        });
        
        // Mark slide as viewed if they spent reasonable time (keep this for completion logic)
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
        
        console.log(`🔄 Slide change: ${carouselState.currentSlide} → ${newSlideIndex} (${direction})`);
        
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
        
        // Calculate completion metrics
        const viewedSlides = carouselState.slideViewedFlags.filter(Boolean).length;
        const completionRate = (viewedSlides / carouselState.totalSlides) * 100;
        const allViewed = carouselState.slideViewedFlags.every(viewed => viewed);
        
        console.log(`✅ Reel Carousel completed - ${viewedSlides}/${carouselState.totalSlides} slides viewed`);
        
        window.GALite.track('carousel_complete', {
            carousel_id: 'reel_carousel_1',
            carousel_type: 'reel_carousel',
            slides_viewed: viewedSlides,
            total_slides: carouselState.totalSlides,
            completion_rate: Math.round(completionRate),
            total_dwell_ms: carouselState.totalDwellTime,
            all_viewed: allViewed,
            study_id: 'instagram_study'
        });
    }
    
    /**
     * Set up navigation listeners for existing carousel system
     */
    function setupNavigationListeners() {
        console.log('🔧 Setting up navigation listeners...');
        
        // Hook into existing carousel system by observing the carousel track transform
        const track = document.querySelector('.reel-carousel-track');
        if (track) {
            console.log('✅ Found reel carousel track');
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
        } else {
            console.log('❌ Reel carousel track not found');
        }
        
        // Also listen for touchend events to detect swipes
        const carousel = document.querySelector('.reel-carousel');
        if (carousel) {
            console.log('✅ Found reel carousel container');
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
        } else {
            console.log('❌ Reel carousel container not found');
        }
        
        // Listen for dot clicks
        const dots = document.querySelectorAll('.reel-carousel-dot');
        console.log(`✅ Found ${dots.length} carousel dots`);
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                console.log(`🔘 Dot ${index} clicked`);
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
        console.log('📤 Page unloading, tracking final dwell time...');
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
    
    // Handle visibility changes (tab switch, etc.)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('👁️ Page hidden, tracking dwell time...');
            handlePageUnload();
        }
    });
    
    // Expose for debugging (optional)
    window.CarouselTracker = {
        getState: () => ({ ...carouselState }),
        MIN_DWELL_MS: MIN_DWELL_MS
    };
    
})();
