/**
 * GA4 Video Tracking
 * Supports both HTML5 video (#adVideo) and Vimeo iframe (#vimeoFrame)
 */

(function() {
    'use strict';
    
    // Configuration
    const PROGRESS_SECONDS = [5, 10, 15, 30, 45, 60, 75, 90]; // Editable array
    
    // Tracking state
    let videoState = {
        isStarted: false,
        duration: 0,
        maxWatched: 0, // Anti-skip logic: track max watched time
        progressTracked: new Set(), // Track which progress points have been sent
        startTime: null,
        totalWatchedMs: 0,
        videoType: null // 'html5' or 'vimeo'
    };
    
    /**
     * Initialize video tracking
     */
    function initVideoTracking() {
        // Wait for GALite to be available
        if (!window.GALite) {
            setTimeout(initVideoTracking, 100);
            return;
        }
        
        // Try to find HTML5 video first
        const html5Video = document.querySelector('#adVideo');
        if (html5Video) {
            setupHTML5VideoTracking(html5Video);
            return;
        }
        
        // Try to find Vimeo iframe
        const vimeoFrame = document.querySelector('#vimeoFrame');
        if (vimeoFrame) {
            setupVimeoTracking(vimeoFrame);
            return;
        }
    }
    
    /**
     * Set up HTML5 video tracking
     */
    function setupHTML5VideoTracking(video) {
        videoState.videoType = 'html5';
        
        // Wait for video metadata to load
        if (video.readyState >= 1) {
            videoState.duration = video.duration;
        } else {
            video.addEventListener('loadedmetadata', () => {
                videoState.duration = video.duration;
            });
        }
        
        // Track video start
        video.addEventListener('play', () => {
            if (!videoState.isStarted) {
                trackVideoStart();
                videoState.isStarted = true;
                videoState.startTime = Date.now();
            }
        });
        
        // Track progress during playback
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            
            // Anti-skip logic: only update maxWatched if playing forward
            if (currentTime > videoState.maxWatched) {
                videoState.maxWatched = currentTime;
            }
            
            // Use maxWatched for progress tracking (not currentTime)
            trackVideoProgress(videoState.maxWatched);
        });
        
        // Track video completion
        video.addEventListener('ended', () => {
            trackVideoComplete();
        });
        
        // Track pause/resume for watch time calculation
        video.addEventListener('pause', () => {
            if (videoState.startTime) {
                videoState.totalWatchedMs += Date.now() - videoState.startTime;
                videoState.startTime = null;
            }
        });
        
        video.addEventListener('play', () => {
            if (!videoState.startTime) {
                videoState.startTime = Date.now();
            }
        });
    }
    
    /**
     * Set up Vimeo iframe tracking using postMessage API
     */
    function setupVimeoTracking(iframe) {
        videoState.videoType = 'vimeo';
        
        // Enable Vimeo API
        const src = iframe.src;
        if (src.indexOf('api=1') === -1) {
            iframe.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'api=1';
        }
        
        // Listen for Vimeo events
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://player.vimeo.com') return;
            
            try {
                const data = JSON.parse(event.data);
                handleVimeoEvent(data);
            } catch (e) {
                // Ignore non-JSON messages
            }
        });
        
        // Request events from Vimeo
        iframe.addEventListener('load', () => {
            const commands = [
                'addEventListener',
                'play',
                'pause',
                'ended',
                'timeupdate',
                'loaded'
            ];
            
            commands.forEach(command => {
                iframe.contentWindow.postMessage(JSON.stringify({
                    method: command,
                    value: command === 'addEventListener' ? 'play' : undefined
                }), 'https://player.vimeo.com');
            });
        });
    }
    
    /**
     * Handle Vimeo player events
     */
    function handleVimeoEvent(data) {
        switch (data.event) {
            case 'ready':
                // Get video duration
                break;
                
            case 'play':
                if (!videoState.isStarted) {
                    trackVideoStart();
                    videoState.isStarted = true;
                    videoState.startTime = Date.now();
                } else if (!videoState.startTime) {
                    videoState.startTime = Date.now();
                }
                break;
                
            case 'pause':
                if (videoState.startTime) {
                    videoState.totalWatchedMs += Date.now() - videoState.startTime;
                    videoState.startTime = null;
                }
                break;
                
            case 'timeupdate':
                if (data.data) {
                    const currentTime = data.data.seconds;
                    const duration = data.data.duration;
                    
                    if (!videoState.duration && duration) {
                        videoState.duration = duration;
                    }
                    
                    // Anti-skip logic
                    if (currentTime > videoState.maxWatched) {
                        videoState.maxWatched = currentTime;
                    }
                    
                    trackVideoProgress(videoState.maxWatched);
                }
                break;
                
            case 'ended':
                trackVideoComplete();
                break;
        }
    }
    
    /**
     * Track video start event
     */
    function trackVideoStart() {
        window.GALite.track('video_start', {
            video_type: videoState.videoType,
            duration_s: videoState.duration
        });
    }
    
    /**
     * Track video progress at specified intervals
     */
    function trackVideoProgress(currentSeconds) {
        if (!videoState.duration) return;
        
        PROGRESS_SECONDS.forEach(second => {
            if (currentSeconds >= second && !videoState.progressTracked.has(second)) {
                videoState.progressTracked.add(second);
                
                window.GALite.track('video_progress', {
                    second: second,
                    duration_s: videoState.duration,
                    video_type: videoState.videoType
                });
            }
        });
    }
    
    /**
     * Track video completion
     */
    function trackVideoComplete() {
        // Calculate final watch time
        if (videoState.startTime) {
            videoState.totalWatchedMs += Date.now() - videoState.startTime;
            videoState.startTime = null;
        }
        
        // Calculate percent watched based on maxWatched (anti-skip)
        const percentWatched = videoState.duration > 0 ? 
            Math.round((videoState.maxWatched / videoState.duration) * 100) : 0;
        
        window.GALite.track('video_complete', {
            watched_ms: videoState.totalWatchedMs,
            percent_watched: percentWatched,
            max_watched_s: videoState.maxWatched,
            duration_s: videoState.duration,
            video_type: videoState.videoType
        });
    }
    
    /**
     * Handle page unload - track completion if video was playing
     */
    function handlePageUnload() {
        if (videoState.isStarted && videoState.startTime) {
            // Add final watch time
            videoState.totalWatchedMs += Date.now() - videoState.startTime;
            
            // Track as incomplete completion
            const percentWatched = videoState.duration > 0 ? 
                Math.round((videoState.maxWatched / videoState.duration) * 100) : 0;
            
            window.GALite.track('video_complete', {
                watched_ms: videoState.totalWatchedMs,
                percent_watched: percentWatched,
                max_watched_s: videoState.maxWatched,
                duration_s: videoState.duration,
                video_type: videoState.videoType,
                completed_naturally: false
            });
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoTracking);
    } else {
        initVideoTracking();
    }
    
    // Track completion on page unload
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    
    // Expose for debugging (optional)
    window.VideoTracker = {
        getState: () => ({ ...videoState }),
        PROGRESS_SECONDS: PROGRESS_SECONDS
    };
    
})();
