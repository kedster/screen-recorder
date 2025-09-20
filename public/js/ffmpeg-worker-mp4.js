// Simplified MP4 conversion worker
// Focus on MediaRecorder API optimization for direct MP4 recording

console.log('MP4 worker loaded - optimizing MediaRecorder for MP4 output');

// Test MediaRecorder MP4 support
function testMP4Support() {
    const mimeTypes = [
        'video/mp4',
        'video/mp4;codecs=h264',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
    ];
    
    const supported = mimeTypes.filter(type => {
        if (typeof MediaRecorder !== 'undefined') {
            return MediaRecorder.isTypeSupported(type);
        }
        return false;
    });
    
    return supported;
}

self.onmessage = function(e) {
    const { type } = e.data;
    
    if (type === 'test-support') {
        // Test what MP4 formats are supported
        const supportedTypes = testMP4Support();
        self.postMessage({
            type: 'support-result',
            supportedTypes: supportedTypes,
            hasMP4Support: supportedTypes.length > 0
        });
        return;
    }
    
    if (type === 'run') {
        // For now, signal that conversion should be handled by MediaRecorder optimization
        // rather than post-processing conversion
        self.postMessage({
            type: 'error',
            error: 'Use optimized MediaRecorder with MP4 mime type instead of post-conversion',
            suggestion: 'Record directly in MP4 format when supported'
        });
    }
};

// Signal readiness and provide support information
const supportedTypes = testMP4Support();
self.postMessage({ 
    type: 'ready',
    supportedMP4Types: supportedTypes,
    recommendation: supportedTypes.length > 0 
        ? 'Use direct MP4 recording with MediaRecorder'
        : 'MP4 not supported, use WebM format'
});