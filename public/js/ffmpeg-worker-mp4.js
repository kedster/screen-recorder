// FFmpeg worker for client-side MP4 conversion
// This worker provides a fallback message when FFmpeg.js is not available

console.log('FFmpeg worker loaded - client-side conversion not available, will use server-side fallback');

self.onmessage = function(e) {
    const { type } = e.data;
    
    if (type === 'run') {
        // Immediately signal that client-side conversion is not available
        // This will trigger the fallback to server-side conversion
        self.postMessage({
            type: 'error',
            error: 'Client-side MP4 conversion not available - using server-side conversion'
        });
    }
};

// Signal that the worker loaded but conversion is not available
self.postMessage({ type: 'error', error: 'Client-side conversion not supported' });