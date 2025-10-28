// Recording utilities
export const recordingUtils = {
    mediaRecorder: null,
    currentStream: null,
    visualizerContext: null,
    chunks: [],
    _freezeChunks: false,

    async setupAudioVisualization(stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) throw new Error('No audio track available');
        const audioStream = new MediaStream([audioTrack]);

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        
        return { analyzer, audioContext };
    },

    drawVisualizer(analyzer, audioVisualizer) {
        if (!this.visualizerContext) {
            audioVisualizer.width = audioVisualizer.clientWidth;
            audioVisualizer.height = audioVisualizer.clientHeight;
            this.visualizerContext = audioVisualizer.getContext('2d');
        }

        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            requestAnimationFrame(draw);
            analyzer.getByteFrequencyData(dataArray);
            
            this.visualizerContext.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg');
            this.visualizerContext.fillRect(0, 0, audioVisualizer.width, audioVisualizer.height);
            
            const barWidth = audioVisualizer.width / bufferLength * 2.5;
            let x = 0;
            
            for(let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2;
                this.visualizerContext.fillStyle = getComputedStyle(document.body).getPropertyValue('--primary');
                this.visualizerContext.fillRect(x, audioVisualizer.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };

        draw();
    },

    setupMediaRecorder(stream, onDataAvailable, onStop) {
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: stream.getVideoTracks().length > 0 ? 'video/webm;codecs=vp8,opus' : 'audio/webm'
        });
        
        this.mediaRecorder.ondataavailable = onDataAvailable;
        this.mediaRecorder.onstop = onStop;
        this.chunks = [];
        
        this.currentStream = stream;
        return this.mediaRecorder;
    },

    async startAudioCapture(useTab = false) {
        let stream;
        if (useTab && navigator.mediaDevices?.getDisplayMedia) {
            stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true,  // Need video for system audio
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
        } else {
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                },
                video: false 
            });
        }
        return stream;
    },

    async startScreenCapture() {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('Screen capture not supported in this browser');
        }

        return await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                frameRate: { ideal: 30 },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
    },

    stopCapture() {
        // Stop MediaRecorder if active
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // Stop all tracks
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        // Clean up overlay resources
        if (this.overlaySourceVideo) {
            this.overlaySourceVideo.pause();
            this.overlaySourceVideo.srcObject = null;
            if (this.overlaySourceVideo.parentNode) {
                this.overlaySourceVideo.parentNode.removeChild(this.overlaySourceVideo);
            }
            this.overlaySourceVideo = null;
        }
        if (this.overlayCanvas) {
            this.overlayCanvas = null;
        }

        // Clear context
        this.mediaRecorder = null;
        if (!this._freezeChunks) {
            this.chunks = [];
        }
        this.visualizerContext = null;
    }
};
