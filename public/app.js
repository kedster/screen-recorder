// Import utilities
import { storage } from './js/storage.js';
import { overlayUtils } from './js/overlay-utils.js';
import { recordingUtils } from './js/recording-utils.js';
import { mp4Utils } from './js/mp4-utils.js';
import { ChunkedUploader } from './js/chunked-upload.js';

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

// Process recorded screen capture with backend processing
async function onScreenStop() {
    try {
        // Prevent chunks from being cleared while we process
        recordingUtils._freezeChunks = true;
        console.log('Processing screen recording with backend...');
        setStatus('Processing screen recording...');
        showToast('Processing recording...', 'info');

        // First verify we have data
        if (!recordingUtils.chunks.length) {
            throw new Error('No recording data available');
        }

        const blob = new Blob(recordingUtils.chunks, { type: 'video/webm' });
        if (blob.size === 0) {
            throw new Error('Recording is empty');
        }
        
        console.log(`Recording blob size: ${blob.size} bytes`);

        // Get overlay options for backend processing
        const options = getOverlayOptions();
        const processingOptions = {
            frame: options.frame,
            frameSize: options.frameSize,
            frameColorStart: options.frameColorStart,
            frameColorEnd: options.frameColorEnd,
            label: options.label,
            labelText: options.labelText,
            icon: options.icon,
            iconOpacity: options.iconOpacity,
            convertToMp4: document.getElementById('convertToMp4').checked,
        };

        console.log('Sending to backend with options:', processingOptions);

        // Create chunked uploader with progress tracking
        const uploader = new ChunkedUploader({
            baseUrl: '', // Use same domain - _redirects will proxy to worker
            chunkSize: 1024 * 1024, // 1MB chunks
            onProgress: (progress) => {
                const percent = Math.round(progress.progress);
                setStatus(`Uploading... ${percent}% (${progress.chunksCompleted}/${progress.totalChunks} chunks)`);
            },
            onError: (error) => {
                console.error('Upload error:', error);
                showToast(`Upload failed: ${error.error}`, 'error');
            }
        });

        // Generate filename
        const timestamp = Date.now();
        const filename = `recording_${timestamp}.webm`;

        setStatus('Uploading to backend for processing...');
        
        // Use smart upload (chunked for large files, direct for small ones)
        const result = await uploader.smartUpload(blob, filename, {
            ...processingOptions,
            chunkThreshold: 5 * 1024 * 1024, // 5MB threshold
            maxConcurrent: 3, // Limit concurrent chunk uploads
            resumable: true,
        });

        console.log('Backend processing completed:', result);

        // For now, save the result to local storage as well for the downloads UI
        // In the future, this could be replaced with a backend API call to list recordings
        try {
            // Create a minimal blob reference for local storage
            const resultBlob = new Blob(['Backend processed file'], { type: 'video/webm' });
            const id = await storage.saveRecording(resultBlob, 'video/webm', sessionId, {
                backendPath: result.path,
                backendProcessed: true,
                originalSize: blob.size,
                processedSize: result.size,
            });
            console.log('Local reference saved with ID:', id);
        } catch (storageError) {
            console.warn('Failed to save local reference:', storageError);
            // Don't fail the entire process for storage errors
        }

        // Clear chunks now that we've successfully processed
        recordingUtils.chunks = [];
        recordingUtils._freezeChunks = false;
        
        await updateDownloadsList();
        setStatus('Recording processed and saved successfully!');
        showToast('Recording processed by backend - Check downloads at top of page', 'success');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (err) {
        console.error('Backend processing failed, attempting local fallback:', err);
        setStatus('Backend processing failed, trying local processing...');
        showToast('Backend failed, trying local processing...', 'warning');
        
        // Fall back to the original local processing as a last resort
        await onScreenStopFallback();
    } finally {
        // Ensure unfreeze even on error
        recordingUtils._freezeChunks = false;
    }
}

// Fallback local processing (simplified version of original)
async function onScreenStopFallback() {
    try {
        console.log('Using local processing fallback...');
        
        if (!recordingUtils.chunks.length) {
            throw new Error('No recording data available for fallback');
        }

        const blob = new Blob(recordingUtils.chunks, { type: 'video/webm' });
        
        // Just save the original recording without heavy processing
        const id = await storage.saveRecording(blob, blob.type || 'video/webm', sessionId);
        
        recordingUtils.chunks = [];
        await updateDownloadsList();
        setStatus('Saved original recording (local fallback)');
        showToast('Saved original recording (local fallback)', 'warning');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (saveErr) {
        console.error('Fallback save failed:', saveErr);
        setStatus('Failed to save recording');
        showToast('Failed to save recording', 'error');
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
    
    const isBackendProcessed = recording.metadata?.backendProcessed;
    const backendPath = recording.metadata?.backendPath;
    
    const downloadBtn = document.createElement('a');
    downloadBtn.href = '#';
    downloadBtn.className = 'download-button';
    
    const typeLabel = recording.type.includes('video') ? 'Video' : 'Audio';
    const processingLabel = isBackendProcessed ? ' (Backend Processed)' : '';
    const sizeLabel = recording.metadata?.processedSize ? 
        ` - ${Math.round(recording.metadata.processedSize / 1024 / 1024 * 100) / 100}MB` : '';
    
    downloadBtn.innerHTML = `
        <i class="fas fa-download"></i>
        <span>${typeLabel}${processingLabel} (${formatDate(recording.timestamp)})${sizeLabel}</span>
    `;
    
    downloadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            let downloadUrl;
            let filename = `recording_${recording.id}.${getFileExtension(recording.type)}`;
            
            if (isBackendProcessed && backendPath) {
                // Download from backend
                console.log('Downloading from backend:', backendPath);
                downloadUrl = backendPath; // This will be proxied by _redirects
                filename = `recording_${recording.id}_processed.${getFileExtension(recording.type)}`;
            } else {
                // Download from local blob
                downloadUrl = URL.createObjectURL(recording.blob);
            }
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Only revoke if it's a local blob URL
            if (!isBackendProcessed) {
                URL.revokeObjectURL(downloadUrl);
            }
            
            await storage.markDownloaded(recording.id);
            showToast('Download started successfully');
            
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
