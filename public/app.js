// Import utilities
import { storage } from './js/storage.js';
import { overlayUtils } from './js/overlay-utils.js';
import { recordingUtils } from './js/recording-utils.js';
import { mp4Utils } from './js/mp4-utils.js';
import { ChunkedUploader } from './js/chunked-upload.js';

// UI Elements
const startScreenBtn = document.getElementById('startScreen');
const stopBtn = document.getElementById('stop');
const statusEl = document.getElementById('status');
const downloadsEl = document.getElementById('downloads');
const screenTimer = document.getElementById('screenTimer');
const previewVideo = document.getElementById('preview');
const previewContainer = document.querySelector('.preview');
const themeToggle = document.querySelector('.theme-toggle');

// Generate secure session ID using crypto API
const sessionId = crypto.randomUUID ? crypto.randomUUID() : generateSecureSessionId();

// Fallback for browsers without randomUUID
function generateSecureSessionId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Status and timer state
let recordingStartTime = 0;
let timerInterval = null;

function setStatus(text) { 
    if (statusEl) statusEl.textContent = text;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
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
    if (screenTimer) screenTimer.textContent = '00:00';
}

// Get current overlay options
async function getOverlayOptions() {
    const iconFile = document.getElementById('iconFile')?.files[0];
    let iconImage = null;
    let iconUrl = null;
    
    if (iconFile && document.getElementById('enableIcon')?.checked) {
        try {
            iconImage = await overlayUtils.processIcon(iconFile);
            iconUrl = URL.createObjectURL(iconFile);
            // Store URL for cleanup later
            if (!window._overlayIconUrls) window._overlayIconUrls = [];
            window._overlayIconUrls.push(iconUrl);
        } catch (err) {
            console.warn('Failed to process icon:', err);
        }
    }
    
    return {
        frame: document.getElementById('enableFrame')?.checked || false,
        frameSize: parseInt(document.getElementById('frameSize')?.value || 20),
        frameColorStart: document.getElementById('frameColorStart')?.value || '#4f46e5',
        frameColorEnd: document.getElementById('frameColorEnd')?.value || '#9333ea',
        label: document.getElementById('enableLabel')?.checked || false,
        labelText: document.getElementById('labelText')?.value || '',
        icon: document.getElementById('enableIcon')?.checked || false,
        iconOpacity: parseInt(document.getElementById('iconOpacity')?.value || 60),
        iconImage: iconImage,
        iconUrl: iconUrl  // For preview
    };
}

// Screen recording handlers
async function startScreenCapture() {
    console.log('Starting screen capture...');
    stopBtn.disabled = false;
    startScreenBtn.disabled = true;
    startScreenBtn.classList.add('recording');
    setStatus('Requesting screen share...');
    
    try {
        const originalStream = await recordingUtils.startScreenCapture();
        
        // Get overlay options (async because it may process icon file)
        const options = await getOverlayOptions();
        const hasOverlays = options.frame || (options.label && options.labelText) || (options.icon && options.iconImage);
        
        let recordingStream = originalStream;
        let overlayCanvas = null;
        
        // If overlays are enabled, create a canvas stream with overlays applied
        if (hasOverlays && previewVideo) {
            console.log('Applying overlays to recording:', options);
            setStatus('Preparing overlays...');
            
            // Create a hidden video element for processing
            const sourceVideo = document.createElement('video');
            sourceVideo.srcObject = originalStream;
            sourceVideo.muted = true;
            sourceVideo.style.display = 'none';
            document.body.appendChild(sourceVideo);
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                sourceVideo.onloadedmetadata = () => {
                    sourceVideo.play();
                    resolve();
                };
            });
            
            // Wait a bit for video to stabilize
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Create canvas with overlays
            overlayCanvas = overlayUtils.createVideoCanvas(sourceVideo, options);
            
            // Get stream from canvas
            const canvasStream = overlayCanvas.captureStream(30); // 30 fps
            
            // Combine canvas video track with original audio tracks
            const audioTracks = originalStream.getAudioTracks();
            const videoTrack = canvasStream.getVideoTracks()[0];
            
            recordingStream = new MediaStream([videoTrack, ...audioTracks]);
            
            // Store references for cleanup
            recordingUtils.overlayCanvas = overlayCanvas;
            recordingUtils.overlaySourceVideo = sourceVideo;
            
            console.log('Overlay canvas stream created successfully');
        }
        
        // Set up video preview (show the original stream in preview)
        if (previewVideo) {
            previewVideo.srcObject = originalStream;
            previewVideo.onloadedmetadata = () => previewVideo.play();
        }

        const mediaRecorder = recordingUtils.setupMediaRecorder(recordingStream, 
            e => { if (e.data && e.data.size) recordingUtils.chunks.push(e.data); },
            onScreenStop
        );

        mediaRecorder.start(1000); // Capture in 1-second chunks
        startTimer(screenTimer);
        setStatus('Screen recording...', true);
        const overlayMsg = hasOverlays ? ' with overlays' : '';
        showToast(`Screen recording started${overlayMsg}`);
        
    } catch(err) {
        console.error('Screen capture error:', err);
        setStatus('Error: ' + err.message);
        showToast(err.message, 'error');
        stopBtn.disabled = true;
        startScreenBtn.disabled = false;
        startScreenBtn.classList.remove('recording');
    }
}

// Stop recording handler
function stopCapture() {
    console.log('Stopping capture...');
    stopBtn.disabled = true;
    startScreenBtn.disabled = false;
    startScreenBtn.classList.remove('recording');
    recordingUtils._freezeChunks = true;
    recordingUtils.stopCapture();

    // Clear preview
    if (previewVideo?.srcObject) {
        previewVideo.srcObject = null;
    }

    stopTimer();
    setStatus('Ready');
}

// Process recorded screen capture with backend processing
async function onScreenStop() {
    try {
        recordingUtils._freezeChunks = true;
        console.log('Processing screen recording with backend...');
        setStatus('Processing screen recording...');
        showToast('Processing recording...', 'info');

        if (!recordingUtils.chunks.length) {
            throw new Error('No recording data available');
        }

        const blob = new Blob(recordingUtils.chunks, { type: 'video/webm' });
        if (blob.size === 0) {
            throw new Error('Recording is empty');
        }
        
        console.log(`Recording blob size: ${blob.size} bytes`);

        // Overlays were already applied during recording if enabled
        // Just need to pass conversion preference
        const processingOptions = {
            convertToMp4: document.getElementById('convertToMp4')?.checked || true,
        };

        console.log('Sending to backend with options:', processingOptions);

        const uploader = new ChunkedUploader({
            baseUrl: '',
            chunkSize: 1024 * 1024,
            onProgress: (progress) => {
                const percent = Math.round(progress.progress);
                setStatus(`Uploading... ${percent}% (${progress.chunksCompleted}/${progress.totalChunks} chunks)`);
            },
            onError: (error) => {
                console.error('Upload error:', error);
                showToast(`Upload failed: ${error.error}`, 'error');
            }
        });

        const timestamp = Date.now();
        const filename = `recording_${timestamp}.webm`;

        setStatus('Uploading to backend for processing...');
        
        const result = await uploader.smartUpload(blob, filename, {
            ...processingOptions,
            chunkThreshold: 5 * 1024 * 1024,
            maxConcurrent: 3,
            resumable: true,
        });

        console.log('Backend processing completed:', result);

        try {
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
        }

        recordingUtils.chunks = [];
        recordingUtils._freezeChunks = false;
        
        await updateDownloadsList();
        setStatus('Recording processed and saved successfully!');
        showToast('Recording processed - Check gallery below', 'success');
        
    } catch (err) {
        console.error('Backend processing failed, attempting local fallback:', err);
        setStatus('Backend processing failed, trying local processing...');
        showToast('Backend failed, trying local processing...', 'warning');
        await onScreenStopFallback();
    } finally {
        recordingUtils._freezeChunks = false;
    }
}

// Fallback local processing
async function onScreenStopFallback() {
    try {
        console.log('Using local processing fallback...');
        
        if (!recordingUtils.chunks.length) {
            throw new Error('No recording data available for fallback');
        }

        const blob = new Blob(recordingUtils.chunks, { type: 'video/webm' });
        const id = await storage.saveRecording(blob, blob.type || 'video/webm', sessionId);
        
        recordingUtils.chunks = [];
        await updateDownloadsList();
        setStatus('Saved original recording (local fallback)');
        showToast('Saved original recording (local fallback)', 'warning');
        
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
                console.log('Downloading from backend:', backendPath);
                filename = `recording_${recording.id}_processed.${getFileExtension(recording.type)}`;
                
                // Fetch the file from the backend first
                showToast('Fetching file from server...', 'info');
                const response = await fetch(backendPath);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
                }
                
                const blob = await response.blob();
                downloadUrl = URL.createObjectURL(blob);
            } else {
                downloadUrl = URL.createObjectURL(recording.blob);
            }
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Always revoke the URL after download since we create it for both cases now
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            
            await storage.markDownloaded(recording.id);
            showToast('Download started successfully');
            
        } catch (err) {
            console.error('Download error:', err);
            showToast('Download failed: ' + err.message, 'error');
        }
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    deleteBtn.addEventListener('click', async () => {
        try {
            await storage.deleteRecording(recording.id);
            container.remove();
            showToast('Recording deleted');
            if (downloadsEl.children.length === 0) {
                downloadsEl.innerHTML = '<div class="no-downloads">No recordings yet</div>';
            }
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
if (startScreenBtn) {
    startScreenBtn.addEventListener('click', () => startScreenCapture());
}

if (stopBtn) {
    stopBtn.addEventListener('click', stopCapture);
}

// Theme toggle
if (themeToggle) {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = themeToggle?.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

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
    // Clean up icon URLs to prevent memory leaks
    if (window._overlayIconUrls) {
        window._overlayIconUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // Ignore errors during cleanup
            }
        });
        window._overlayIconUrls = [];
    }
});

// Overlay preview handlers
const frameCheckbox = document.getElementById('enableFrame');
const frameColorStart = document.getElementById('frameColorStart');
const frameColorEnd = document.getElementById('frameColorEnd');
const frameSize = document.getElementById('frameSize');
const frameSizeLabel = document.querySelector('.frame-size-label');
const iconOpacity = document.getElementById('iconOpacity');
const opacityLabel = document.querySelector('.opacity-label');

const updatePreview = async () => {
    const options = await getOverlayOptions();
    overlayUtils.updatePreview(previewContainer, options);
};

if (frameCheckbox) frameCheckbox.addEventListener('change', updatePreview);
if (frameColorStart) frameColorStart.addEventListener('input', updatePreview);
if (frameColorEnd) frameColorEnd.addEventListener('input', updatePreview);
if (frameSize) {
    frameSize.addEventListener('input', () => {
        if (frameSizeLabel) frameSizeLabel.textContent = `${frameSize.value}px`;
        updatePreview();
    });
}

const enableLabel = document.getElementById('enableLabel');
const labelText = document.getElementById('labelText');
const enableIcon = document.getElementById('enableIcon');
const iconFile = document.getElementById('iconFile');

if (enableLabel) enableLabel.addEventListener('change', updatePreview);
if (labelText) labelText.addEventListener('input', updatePreview);
if (enableIcon) enableIcon.addEventListener('change', updatePreview);
if (iconFile) iconFile.addEventListener('change', updatePreview);
if (iconOpacity) {
    iconOpacity.addEventListener('input', () => {
        if (opacityLabel) opacityLabel.textContent = `${iconOpacity.value}%`;
        updatePreview();
    });
}
