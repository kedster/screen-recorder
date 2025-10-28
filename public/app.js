// Import utilities
import { storage } from './js/storage.js';

// UI Elements
const recordBtn = document.getElementById('recordBtn');
const timer = document.getElementById('timer');
const status = document.getElementById('status');
const previewSection = document.getElementById('previewSection');
const previewVideo = document.getElementById('previewVideo');
const downloadBtn = document.getElementById('downloadBtn');
const saveBtn = document.getElementById('saveBtn');
const galleryGrid = document.getElementById('galleryGrid');
const themeToggle = document.getElementById('themeToggle');

// Recording state
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingStartTime = 0;
let timerInterval = null;
let currentStream = null;
let currentBlob = null;
// Generate secure session ID using crypto API
const sessionId = crypto.randomUUID ? crypto.randomUUID() : generateSecureSessionId();

// Fallback for browsers without randomUUID
function generateSecureSessionId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Theme toggle handler
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

// Toast notification
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
function startTimer() {
    recordingStartTime = Date.now();
    timer.classList.add('active');
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timer.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timer.classList.remove('active');
    timer.textContent = '00:00';
}

// Start recording
async function startRecording() {
    try {
        status.textContent = 'Requesting screen permissions...';
        
        // Request screen capture with audio
        currentStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: true
        });

        // Set up MediaRecorder
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }

        mediaRecorder = new MediaRecorder(currentStream, options);
        recordedChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = handleRecordingStop;

        // Handle when user stops sharing via browser UI
        currentStream.getVideoTracks()[0].onended = () => {
            if (isRecording) {
                stopRecording();
            }
        };

        mediaRecorder.start(1000); // Capture in 1-second chunks
        isRecording = true;
        
        // Update UI
        recordBtn.classList.add('recording');
        recordBtn.querySelector('.record-btn-text').textContent = 'Stop';
        status.textContent = 'Recording... Click Stop when done';
        startTimer();
        showToast('Recording started', 'success');

    } catch (error) {
        console.error('Failed to start recording:', error);
        status.textContent = 'Failed to start recording';
        showToast('Failed to start recording: ' + error.message, 'error');
        stopTimer();
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordBtn.querySelector('.record-btn-text').textContent = 'Record';
        stopTimer();
        status.textContent = 'Processing recording...';
    }

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// Handle recording stop
async function handleRecordingStop() {
    try {
        if (recordedChunks.length === 0) {
            throw new Error('No recording data available');
        }

        currentBlob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log('Recording blob size:', currentBlob.size, 'bytes');

        // Show preview
        previewVideo.src = URL.createObjectURL(currentBlob);
        previewSection.style.display = 'block';
        status.textContent = 'Recording complete! Preview below';
        showToast('Recording complete!', 'success');

        // Scroll to preview
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error('Error processing recording:', error);
        status.textContent = 'Error processing recording';
        showToast('Error processing recording: ' + error.message, 'error');
    }
}

// Record button handler
recordBtn.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Download button handler
downloadBtn.addEventListener('click', async () => {
    try {
        if (!currentBlob) {
            showToast('No recording to download', 'error');
            return;
        }

        status.textContent = 'Preparing download...';
        
        // Send to backend for MP4 conversion
        const formData = new FormData();
        const filename = `recording_${Date.now()}.webm`;
        formData.append('file', currentBlob, filename);
        formData.append('convertToMp4', 'true');

        showToast('Converting to MP4...', 'info');

        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Conversion failed');
        }

        const convertedBlob = await response.blob();
        const url = URL.createObjectURL(convertedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        status.textContent = 'Download started!';
        showToast('Download started!', 'success');

    } catch (error) {
        console.error('Download error:', error);
        // Fallback to direct download
        const url = URL.createObjectURL(currentBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        status.textContent = 'Downloaded as WebM (conversion unavailable)';
        showToast('Downloaded as WebM (conversion unavailable)', 'warning');
    }
});

// Save to gallery button handler
saveBtn.addEventListener('click', async () => {
    try {
        if (!currentBlob) {
            showToast('No recording to save', 'error');
            return;
        }

        status.textContent = 'Saving to gallery...';
        
        const id = await storage.saveRecording(currentBlob, currentBlob.type, sessionId);
        await updateGallery();
        
        status.textContent = 'Saved to gallery!';
        showToast('Saved to gallery!', 'success');

        // Hide preview and reset
        previewSection.style.display = 'none';
        previewVideo.src = '';
        currentBlob = null;
        recordedChunks = [];

        // Scroll to gallery
        document.getElementById('gallerySection').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Save error:', error);
        status.textContent = 'Failed to save to gallery';
        showToast('Failed to save: ' + error.message, 'error');
    }
});

// Update gallery
async function updateGallery() {
    try {
        const recordings = await storage.listSessionRecordings(sessionId);
        
        if (recordings.length === 0) {
            galleryGrid.innerHTML = '<p class="no-recordings">No recordings yet</p>';
            return;
        }

        galleryGrid.innerHTML = '';
        
        recordings
            .sort((a, b) => b.timestamp - a.timestamp)
            .forEach(recording => {
                galleryGrid.appendChild(createGalleryItem(recording));
            });

    } catch (error) {
        console.error('Error updating gallery:', error);
        showToast('Failed to update gallery', 'error');
    }
}

// Create gallery item
function createGalleryItem(recording) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    
    const typeIcon = recording.type.includes('video') ? 'video' : 'music';
    const filename = `recording_${recording.id}`;
    const timestamp = new Date(recording.timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    item.innerHTML = `
        <div class="gallery-thumbnail">
            <i class="fas fa-${typeIcon}"></i>
        </div>
        <div class="gallery-info">
            <div class="gallery-filename">${filename}</div>
            <div class="gallery-timestamp">${timestamp}</div>
            <div class="gallery-actions">
                <button class="gallery-btn gallery-btn-download" data-id="${recording.id}">
                    <i class="fas fa-download"></i>
                    Download
                </button>
                <button class="gallery-btn gallery-btn-delete" data-id="${recording.id}">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `;

    // Download handler
    item.querySelector('.gallery-btn-download').addEventListener('click', async () => {
        try {
            const url = URL.createObjectURL(recording.blob);
            const ext = recording.type.includes('mp4') ? 'mp4' : 'webm';
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await storage.markDownloaded(recording.id);
            showToast('Download started', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Download failed', 'error');
        }
    });

    // Delete handler
    item.querySelector('.gallery-btn-delete').addEventListener('click', async () => {
        if (confirm('Delete this recording?')) {
            try {
                await storage.deleteRecording(recording.id);
                item.remove();
                showToast('Recording deleted', 'success');
                
                // Check if gallery is empty
                if (galleryGrid.children.length === 0) {
                    galleryGrid.innerHTML = '<p class="no-recordings">No recordings yet</p>';
                }
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete', 'error');
            }
        }
    });

    return item;
}

// Initialize on page load
window.addEventListener('load', async () => {
    try {
        initTheme();
        await storage.init();
        console.log('Storage initialized');
        await updateGallery();
    } catch (error) {
        console.error('Failed to initialize:', error);
        showToast('Failed to initialize storage', 'error');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    if (storage.db) {
        storage.cleanupSession(sessionId);
    }
});
