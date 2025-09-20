// Simplified MP4 utilities focusing on MediaRecorder optimization
export const mp4Utils = {
    // Get the best supported MP4 mime type for recording
    getBestMP4MimeType() {
        const mimeTypes = [
            'video/mp4;codecs=h264,aac',
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/mp4;codecs=h264',
            'video/mp4;codecs=avc1',
            'video/mp4'
        ];
        
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }
        
        return null;
    },

    // Check if direct MP4 recording is supported
    isDirectMP4Supported() {
        return this.getBestMP4MimeType() !== null;
    },

    // Get fallback WebM mime type
    getFallbackMimeType() {
        const webmTypes = [
            'video/webm;codecs=h264,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        
        for (const mimeType of webmTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }
        
        return 'video/webm'; // Basic fallback
    },

    // Get the recommended recording configuration
    getRecordingConfig() {
        const mp4MimeType = this.getBestMP4MimeType();
        
        if (mp4MimeType) {
            return {
                mimeType: mp4MimeType,
                format: 'mp4',
                needsConversion: false,
                message: 'Recording directly in MP4 format'
            };
        } else {
            return {
                mimeType: this.getFallbackMimeType(),
                format: 'webm',
                needsConversion: false,
                message: 'Recording in WebM format (MP4 not supported)'
            };
        }
    },

    // Legacy method for backward compatibility - now recommends direct recording
    async convertToMp4(webmBlob) {
        console.log('convertToMp4 called - checking if conversion is needed...');
        
        // If we already have an MP4 blob or MP4 is supported, no conversion needed
        if (webmBlob.type.includes('mp4')) {
            console.log('Blob is already MP4 format');
            return webmBlob;
        }

        // Check if direct MP4 recording should have been used instead
        if (this.isDirectMP4Supported()) {
            console.log('MP4 is supported - should record directly in MP4 format');
            throw new Error('Use direct MP4 recording instead of post-processing conversion. Enable MP4 in MediaRecorder options.');
        }

        // If MP4 is not supported, return the original blob
        console.log('MP4 not supported in this browser - keeping WebM format');
        return webmBlob;
    },

    // Audio encoding (unchanged)
    async encodeMp3(samples, sampleRate) {
        if (!window.lamejs) {
            try {
                await this.loadLameJS();
            } catch (err) {
                throw new Error('Failed to load lamejs encoder');
            }
        }

        const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
        const samplesInt16 = this.floatTo16BitPCM(samples);
        const chunkSize = 1152;
        let mp3Data = [];
        
        for (let i = 0; i < samplesInt16.length; i += chunkSize) {
            const chunk = samplesInt16.subarray(i, i + chunkSize);
            const mp3buf = mp3encoder.encodeBuffer(chunk);
            if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
        }
        
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
        
        return new Blob(mp3Data, { type: 'audio/mpeg' });
    },

    floatTo16BitPCM(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return int16Array;
    },

    async loadLameJS() {
        if (!window.lamejs) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js';
            
            return new Promise((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load lamejs'));
                document.head.appendChild(script);
            });
        }
    },

    // System diagnostics
    async checkVersions() {
        const info = {
            browser: {
                userAgent: navigator.userAgent,
                mediaRecorder: typeof MediaRecorder !== 'undefined',
                webRTC: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                mp4Support: this.isDirectMP4Supported(),
                recommendedConfig: this.getRecordingConfig()
            },
            server: {
                note: 'Simplified approach - no server-side conversion needed'
            },
            supportedFormats: this.getSupportedMimeTypes(),
            recommendations: {
                video: this.isDirectMP4Supported() 
                    ? 'Use direct MP4 recording with MediaRecorder'
                    : 'Use WebM format - MP4 not supported in this browser',
                audio: 'Use MP3 encoding for audio-only recordings'
            }
        };
        
        return info;
    },

    getSupportedMimeTypes() {
        const allTypes = [
            'video/mp4',
            'video/mp4;codecs=h264',
            'video/mp4;codecs=h264,aac',
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/webm',
            'video/webm;codecs=vp8',
            'video/webm;codecs=vp9',
            'video/webm;codecs=h264',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=h264,opus',
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp4'
        ];
        
        return allTypes.filter(type => {
            try {
                return MediaRecorder.isTypeSupported(type);
            } catch (e) {
                return false;
            }
        });
    }
};