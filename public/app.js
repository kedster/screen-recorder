// Import utilities
import { storage } from './js/storage.js';
import { overlayUtils } from './js/overlay-utils.js';
import { recordingUtils } from './js/recording-utils.js';
import { mp4Utils } from './js/mp4-utils.js';

// UI Elements
const startTabBtn = document.getElementById('startTab');
const startMicBtn = document.getElementById('startMic');
const startScreenBtn = document.getElementById('startScreen');
const stopBtn = document.getElementById('stop');
const statusEl = document.getElementById('status');
const downloadsEl = document.getElementById('downloads');
const audioVisualizer = document.getElementById('audioVisualizer');
const audioTimer = document.getElementById('audioTimer');
const screenTimer = document.getElementById('screenTimer');
const previewVideo = document.getElementById('preview');
const previewContainer = document.querySelector('.preview');
const downloadsToggle = document.getElementById('downloadsToggle');
const downloadsWrapper = document.querySelector('.downloads-wrapper');

// Generate unique session ID
const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

// Status and timer state
let recordingStartTime = 0;
let timerInterval = null;

function setStatus(text) { 
    statusEl.textContent = text;
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast styles if they don't exist
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: #333;
                color: white;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 14px;
                max-width: 300px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            }
            .toast.show {
                opacity: 1;
                transform: translateX(0);
            }
            .toast-success {
                background: #10b981;
            }
            .toast-error {
                background: #ef4444;
            }
            .toast-warning {
                background: #f59e0b;
            }
            .toast-info {
                background: #3b82f6;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Timer functions
function startTimer(timerEl) {
    recordingStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timerEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    audioTimer.textContent = '00:00';
    screenTimer.textContent = '00:00';
}

// Get current overlay options
function getOverlayOptions() {
    return {
        frame: document.getElementById('enableFrame').checked,
        frameSize: parseInt(document.getElementById('frameSize').value),
        frameColorStart: document.getElementById('frameColorStart').value,
        frameColorEnd: document.getElementById('frameColorEnd').value,
        label: document.getElementById('enableLabel').checked,
        labelText: document.getElementById('labelText').value,
        icon: document.getElementById('enableIcon').checked,
        iconOpacity: parseInt(document.getElementById('iconOpacity').value),
        iconImage: null
    };
}

// Variable to track current video processing
let currentVideoProcessing = null;

// Audio recording handlers
async function startCapture(useTab) {
    console.log('Starting capture, useTab:', useTab);
    setStatus('Requesting permissions...');
    stopBtn.disabled = false;
    startTabBtn.disabled = true;
    startMicBtn.disabled = true;
    startScreenBtn.disabled = true;
    
    try {
        const stream = await recordingUtils.startAudioCapture(useTab);
        const { analyzer } = await recordingUtils.setupAudioVisualization(stream);
        recordingUtils.drawVisualizer(analyzer, audioVisualizer);

        const mediaRecorder = recordingUtils.setupMediaRecorder(stream, 
            e => { if (e.data && e.data.size) recordingUtils.chunks.push(e.data); },
            onAudioStop
        );

        mediaRecorder.start();
        startTimer(audioTimer);
        setStatus('Recording audio...', true);
        showToast('Recording started');
    } catch(err) {
        setStatus('Error: ' + err.message);
        showToast(err.message, 'error');
        stopBtn.disabled = true;
        startTabBtn.disabled = false;
        startMicBtn.disabled = false;
        startScreenBtn.disabled = false;
    }
}

// Screen recording handlers
async function startScreenCapture() {
    console.log('Starting screen capture...');
    stopBtn.disabled = false;
    startTabBtn.disabled = true;
    startMicBtn.disabled = true;
    startScreenBtn.disabled = true;
    setStatus('Requesting screen share...');
    
    try {
        const stream = await recordingUtils.startScreenCapture();
        
        // Set up video preview
        if (previewVideo) {
            previewVideo.srcObject = stream;
            previewVideo.onloadedmetadata = () => previewVideo.play();
        }

        const mediaRecorder = recordingUtils.setupMediaRecorder(stream, 
            e => { if (e.data && e.data.size) recordingUtils.chunks.push(e.data); },
            onScreenStop
        );

        mediaRecorder.start(1000); // Capture in 1-second chunks
        startTimer(screenTimer);
        setStatus('Screen recording...', true);
        showToast('Screen recording started');
        
    } catch(err) {
        console.error('Screen capture error:', err);
        setStatus('Error: ' + err.message);
        showToast(err.message, 'error');
        stopBtn.disabled = true;
        startTabBtn.disabled = false;
        startMicBtn.disabled = false;
        startScreenBtn.disabled = false;
    }
}

// Stop recording handler
function stopCapture() {
    console.log('Stopping capture...');
    stopBtn.disabled = true;
    startTabBtn.disabled = false;
    startMicBtn.disabled = false;
    startScreenBtn.disabled = false;
    // Freeze chunks to avoid clearing while processing starts
    recordingUtils._freezeChunks = true;
    recordingUtils.stopCapture();

    // Clear preview
    if (previewVideo?.srcObject) {
        previewVideo.srcObject = null;
    }

    stopTimer();
    setStatus('Ready');
}

// Process recorded audio
async function onAudioStop() {
    setStatus('Stopping and processing...');
    const blob = new Blob(recordingUtils.chunks, { type: 'audio/webm' });

    try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        // Convert to MP3 if possible
        const finalBlob = await mp4Utils.encodeMp3(channelData, audioBuffer.sampleRate);
        const id = await storage.saveRecording(finalBlob, finalBlob.type, sessionId);
        
        await updateDownloadsList();
        setStatus('Done');
        showToast('Recording saved successfully');
    } catch(err) {
        console.error('Processing failed:', err);
        setStatus('Processing failed, saving original file.');
        
        try {
            const id = await storage.saveRecording(blob, blob.type, sessionId);
            await updateDownloadsList();
            setStatus('Done');
            showToast('Recording saved successfully');
        } catch (saveErr) {
            console.error('Failed to save recording:', saveErr);
            setStatus('Failed to save recording');
            showToast('Failed to save recording', 'error');
        }
    }
}

// Process recorded screen capture
async function onScreenStop() {
    let videoUrl;
    let videoEl;
    let blob; // will hold the recorded data for fallback paths

    try {
    // Prevent chunks from being cleared while we process
    recordingUtils._freezeChunks = true;
        console.log('Processing screen recording...');
        setStatus('Processing screen recording...');
        showToast('Processing recording...');

        // First verify we have data
        if (!recordingUtils.chunks.length) {
            throw new Error('No recording data available');
        }

    blob = new Blob(recordingUtils.chunks, { type: 'video/webm' });
        if (blob.size === 0) {
            throw new Error('Recording is empty');
        }
        
        // Create temporary video element for processing
    videoEl = document.createElement('video');
        videoEl.muted = true;
    videoEl.preload = 'auto';
    videoEl.playsInline = true;
        videoUrl = URL.createObjectURL(blob);
        videoEl.src = videoUrl;
    try { videoEl.currentTime = 0; } catch (_) {}
        
        // Add error handling for video loading (keep original listeners, add guards)
        await new Promise((resolve, reject) => {
            // Original listeners (retained)
            videoEl.addEventListener('loadeddata', resolve);
            videoEl.addEventListener('error', (e) => reject(new Error('Failed to load video: ' + (e.error?.message || 'Unknown error'))));

            // Guarded listeners to ensure single settle
            let done = false;
            const safeResolve = () => { if (done) return; done = true; resolve(); };
            const safeReject = (e) => { if (done) return; done = true; reject(new Error('Failed to load video: ' + (e.error?.message || 'Unknown error'))); };
            videoEl.addEventListener('loadeddata', safeResolve);
            videoEl.addEventListener('canplay', safeResolve);
            videoEl.addEventListener('canplaythrough', safeResolve);
            videoEl.addEventListener('error', safeReject);

            // Duplicate load calls retained from prior edits
            videoEl.load();
            videoEl.load();

            // Poll readystate as last resort (do not remove existing logic)
            const start = Date.now();
            const timer = setInterval(() => {
                // readyState >= 2 means have current data
                if ((videoEl.readyState ?? 0) >= 2) {
                    clearInterval(timer);
                    safeResolve();
                } else if (Date.now() - start > 5000) {
                    clearInterval(timer);
                    safeReject(new Error('Failed to load video: timeout'));
                }
            }, 100);
        });
        
        // Get and process overlay options
        const options = getOverlayOptions();
        console.log('Overlay options for export:', JSON.parse(JSON.stringify({
            frame: options.frame,
            frameSize: options.frameSize,
            frameColorStart: options.frameColorStart,
            frameColorEnd: options.frameColorEnd,
            label: options.label,
            labelText: options.labelText,
            icon: options.icon,
            iconOpacity: options.iconOpacity,
            hasIconImage: !!options.iconImage
        })));
        if (options.icon) {
            const iconFile = document.getElementById('iconFile').files[0];
            if (iconFile) {
                try {
                    options.iconImage = await overlayUtils.processIcon(iconFile, 64);
                } catch (err) {
                    console.error('Failed to process icon:', err);
                    showToast('Icon processing failed, continuing without icon', 'error');
                }
            }
        }
        
        // Process video with overlays
        console.log('Creating canvas with overlays...');
    const canvas = await overlayUtils.createVideoCanvas(videoEl, options);
        if (!canvas) {
            throw new Error('Failed to create video canvas');
        }
    console.log('Overlay canvas size:', { width: canvas.width, height: canvas.height });

        console.log('Setting up processed stream...');
    const processedStream = canvas.captureStream(30);
    // Give the canvas a moment to render an initial frame
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    console.log('Processed stream tracks:', processedStream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState }))); 
        
        // Add audio from original recording
        try {
            console.log('Processing audio...');
            const arrayBuffer = await blob.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            const dest = audioContext.createMediaStreamDestination();
            source.connect(dest);
            try { source.start(0); } catch (_) { /* ignore if already started */ }
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
                processedStream.addTrack(audioTrack);
            } else {
                console.warn('No audio track available');
            }
        } catch (audioErr) {
            console.error('Audio processing error:', audioErr);
            showToast('Audio processing failed, continuing without audio', 'error');
        }
        
        // Record processed stream
        console.log('Recording processed stream...');
    const processedRecorder = new MediaRecorder(processedStream, {
            mimeType: 'video/webm;codecs=vp8,opus'
        });
        const processedChunks = [];
        
        processedRecorder.ondataavailable = e => {
            if (e.data?.size) {
                console.log('Got processed chunk:', e.data.size, 'bytes');
                processedChunks.push(e.data);
            }
        };
        
        await new Promise((resolve, reject) => {
            let processed = false;
            let stopped = false;

            const finish = () => {
                if (processed) return;
                processed = true;
                console.log('Processing completed; chunks:', processedChunks.length);
                resolve();
            };

            processedRecorder.onstop = () => {
                stopped = true;
                // Give a short grace period for any late dataavailable
                setTimeout(finish, 200);
            };
            
            processedRecorder.onerror = (err) => {
                reject(new Error('Recording failed: ' + err.message));
            };

            try {
                // Use timeslice to get chunks periodically; helps ensure data before stop
                processedRecorder.start(1000);
                videoEl.play();
                const duration = Number.isFinite(videoEl.duration) && videoEl.duration > 0
                    ? videoEl.duration * 1000
                    : 3000; // fallback duration if metadata is unavailable
                console.log('Processing video, duration:', duration, 'ms');
                setTimeout(() => {
                    try { processedRecorder.requestData(); } catch (_) {}
                    setTimeout(() => {
                        if (!stopped) {
                            try { processedRecorder.stop(); } catch (_) {}
                        }
                    }, 120);
                }, duration + 500); // slight extra buffer
            } catch (err) {
                reject(err);
            }
        });
    
        // Create final video blob
        console.log('Creating final video blob...');
        if (processedChunks.length === 0) {
            throw new Error('No processed video data available');
        }

        let finalBlob = new Blob(processedChunks, { type: 'video/webm' });
        if (finalBlob.size === 0) {
            throw new Error('Processed video is empty');
        }
        
        // Convert to MP4 if enabled
        if (document.getElementById('convertToMp4').checked) {
            setStatus('Converting to MP4...');
            showToast('Converting to MP4...', 'info');
            try {
                console.log('Converting to MP4...');
                finalBlob = await mp4Utils.convertToMp4(finalBlob);
                console.log('MP4 conversion successful, size:', finalBlob.size);
                showToast('MP4 conversion successful', 'success');
            } catch (convErr) {
                console.error('MP4 conversion failed:', convErr);
                showToast('MP4 conversion failed: ' + convErr.message + ' - Saving as WebM', 'error');
                // finalBlob remains as WebM
            }
        }
        
        // Save the recording
        console.log('Saving recording...');
        const id = await storage.saveRecording(finalBlob, finalBlob.type, sessionId);
        console.log('Recording saved with ID:', id);
        
    // Clear chunks now that we saved
    recordingUtils.chunks = [];
    recordingUtils._freezeChunks = false;
    await updateDownloadsList();
        setStatus('Recording saved successfully');
        showToast('Recording saved - Check downloads at top of page', 'success');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('Failed during screen processing, attempting fallback:', err);
    setStatus('Processing failed, saving original file.');
        try {
            if (!blob) {
                // As an extreme fallback, reconstruct from chunks
                blob = new Blob(recordingUtils.chunks, { type: 'video/webm' });
            }
            const id = await storage.saveRecording(blob, blob.type || 'video/webm', sessionId);
            await updateDownloadsList();
            setStatus('Saved original recording (fallback)');
            showToast('Saved original recording (fallback)', 'warning');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (saveErr) {
            console.error('Fallback save failed:', saveErr);
            setStatus('Failed to save recording');
            showToast('Failed to save recording', 'error');
        }
    } finally {
        // Clean up resources
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
        }
        // Ensure unfreeze even on error
        recordingUtils._freezeChunks = false;
    }
}


// Downloads panel functionality
async function updateDownloadsList() {
    try {
        const recordings = await storage.listSessionRecordings(sessionId);
        downloadsEl.innerHTML = '';
        
        if (recordings.length === 0) {
            downloadsEl.innerHTML = '<div class="no-downloads">No recordings yet</div>';
            return;
        }
        
        recordings
            .sort((a, b) => b.timestamp - a.timestamp)
            .forEach(recording => {
                downloadsEl.appendChild(createDownloadLink(recording));
            });
    } catch (err) {
        console.error('Error updating downloads list:', err);
        showToast('Failed to update downloads list', 'error');
    }
}

function createDownloadLink(recording) {
    const container = document.createElement('div');
    container.className = 'download-item';
    
    const downloadBtn = document.createElement('a');
    downloadBtn.href = '#';
    downloadBtn.className = 'download-button';
    downloadBtn.innerHTML = `
        <i class="fas fa-download"></i>
        <span>${recording.type.includes('video') ? 'Video' : 'Audio'} (${formatDate(recording.timestamp)})</span>
    `;
    
    downloadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const url = URL.createObjectURL(recording.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording_${recording.id}.${getFileExtension(recording.type)}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await storage.markDownloaded(recording.id);
        } catch (err) {
            console.error('Download error:', err);
            showToast('Download failed: ' + err.message, 'error');
        }
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', async () => {
        try {
            await storage.deleteRecording(recording.id);
            container.remove();
            showToast('Recording deleted');
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete recording: ' + err.message, 'error');
        }
    });
    
    container.appendChild(downloadBtn);
    container.appendChild(deleteBtn);
    return container;
}

// Helper functions
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString(undefined, { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getFileExtension(mimeType) {
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4')) return 'mp4';
    return 'bin';
}

// Event listeners
startTabBtn.addEventListener('click', () => startCapture(true));
startMicBtn.addEventListener('click', () => startCapture(false));
startScreenBtn.addEventListener('click', () => startScreenCapture());
stopBtn.addEventListener('click', stopCapture);

// Set downloads panel state
let isDownloadsPanelCollapsed = localStorage.getItem('downloadsCollapsed') === 'true';
if (isDownloadsPanelCollapsed) {
    downloadsWrapper.classList.add('collapsed');
} else {
    downloadsWrapper.classList.remove('collapsed');
}

downloadsToggle.addEventListener('click', () => {
    isDownloadsPanelCollapsed = !isDownloadsPanelCollapsed;
    if (isDownloadsPanelCollapsed) {
        downloadsWrapper.classList.add('collapsed');
    } else {
        downloadsWrapper.classList.remove('collapsed');
    }
    localStorage.setItem('downloadsCollapsed', isDownloadsPanelCollapsed);
});

// Initialize on page load
window.addEventListener('load', async () => {
    try {
        await storage.init();
        console.log('IndexedDB initialized');
        await updateDownloadsList();
    } catch (err) {
        console.error('Failed to initialize IndexedDB:', err);
        showToast('Failed to initialize storage. Some features may not work.', 'error');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (storage.db) storage.cleanupSession(sessionId);
});

// Overlay preview handlers
const frameCheckbox = document.getElementById('enableFrame');
const frameColorStart = document.getElementById('frameColorStart');
const frameColorEnd = document.getElementById('frameColorEnd');
const frameSize = document.getElementById('frameSize');
const frameSizeLabel = document.querySelector('.frame-size-label');
const iconOpacity = document.getElementById('iconOpacity');
const opacityLabel = document.querySelector('.opacity-label');

// Update preview when overlay options change
const updatePreview = () => overlayUtils.updatePreview(previewContainer, getOverlayOptions());

// Add event listeners for all overlay controls
frameCheckbox.addEventListener('change', updatePreview);
frameColorStart.addEventListener('input', updatePreview);
frameColorEnd.addEventListener('input', updatePreview);
frameSize.addEventListener('input', () => {
    frameSizeLabel.textContent = `${frameSize.value}px`;
    updatePreview();
});

document.getElementById('enableLabel').addEventListener('change', updatePreview);
document.getElementById('labelText').addEventListener('input', updatePreview);
document.getElementById('enableIcon').addEventListener('change', updatePreview);
document.getElementById('iconFile').addEventListener('change', updatePreview);
iconOpacity.addEventListener('input', () => {
    opacityLabel.textContent = `${iconOpacity.value}%`;
    updatePreview();
});

// System diagnostics functionality
document.getElementById('checkVersions').addEventListener('click', async () => {
    const btn = document.getElementById('checkVersions');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    btn.disabled = true;

    try {
        const { mp4Utils } = await import('./js/mp4-utils.js');
        const versionInfo = await mp4Utils.checkVersions();
        
        // Display results in a formatted way
        const results = `
=== SYSTEM DIAGNOSTICS ===

🖥️  SERVER ENVIRONMENT:
• Node.js: ${versionInfo.server.nodejs}
• Platform: ${versionInfo.server.platform} (${versionInfo.server.arch})
• FFmpeg: ${versionInfo.server.ffmpeg.available ? '✅ ' + versionInfo.server.ffmpeg.version : '❌ Not available'}
• FFprobe: ${versionInfo.server.ffprobe.available ? '✅ ' + versionInfo.server.ffprobe.version : '❌ Not available'}

🌐 BROWSER CAPABILITIES:
• WebRTC: ${versionInfo.client.webRTC ? '✅' : '❌'}
• Screen Sharing: ${versionInfo.client.getDisplayMedia ? '✅' : '❌'}
• Media Recording: ${versionInfo.client.mediaRecorder ? '✅' : '❌'}
• Web Workers: ${versionInfo.client.worker ? '✅' : '❌'}
• IndexedDB: ${versionInfo.client.indexedDB ? '✅' : '❌'}

📼 SUPPORTED FORMATS:
${versionInfo.client.supportedMimeTypes.map(type => `• ${type}`).join('\n')}

🎯 MP4 CONVERSION STATUS:
• Client-side: ❌ Disabled (fallback stub)
• Server-side: ${versionInfo.server.ffmpeg.available ? '✅ Available' : '❌ FFmpeg not installed'}

📊 USER AGENT:
${versionInfo.client.userAgent}

Generated: ${versionInfo.timestamp}
        `.trim();

        console.log(results);
        alert(results);
        showToast('System diagnostics completed - check console for details', 'info');
        
    } catch (error) {
        console.error('Diagnostics failed:', error);
        alert(`Diagnostics failed: ${error.message}`);
        showToast('Diagnostics failed: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Debug helper
window.checkRecordingState = () => ({
    mediaRecorder: recordingUtils.mediaRecorder?.state,
    stream: recordingUtils.currentStream?.active,
    stopButton: stopBtn.disabled
});
