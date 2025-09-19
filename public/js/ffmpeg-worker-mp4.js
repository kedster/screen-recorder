// FFmpeg worker for client-side MP4 conversion using FFmpeg.wasm
// This worker provides WebM to MP4 conversion in the browser

console.log('FFmpeg worker loaded - attempting to load FFmpeg.wasm');

let ffmpegInstance = null;
let isLoading = false;

// Try to load FFmpeg.wasm dynamically
async function loadFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    if (isLoading) {
        // Wait for ongoing load
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return ffmpegInstance;
    }
    
    isLoading = true;
    
    try {
        // Import FFmpeg.wasm from CDN using dynamic import in worker
        const response = await fetch('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
        if (!response.ok) throw new Error('Failed to fetch FFmpeg.js');
        
        const scriptText = await response.text();
        
        // Execute the script in worker context
        eval(scriptText);
        
        if (typeof FFmpegWASM === 'undefined') {
            throw new Error('FFmpeg.wasm not properly loaded');
        }
        
        const { FFmpeg } = FFmpegWASM;
        const ffmpeg = new FFmpeg();
        
        // Set up logging
        ffmpeg.on('log', ({ message }) => {
            console.log('FFmpeg:', message);
        });
        
        ffmpeg.on('progress', ({ progress }) => {
            self.postMessage({
                type: 'progress',
                progress: Math.round(progress * 100)
            });
        });
        
        // Load FFmpeg with CoreURL and WasmURL
        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
            classWorkerURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js'
        });
        
        ffmpegInstance = ffmpeg;
        isLoading = false;
        
        console.log('FFmpeg.wasm loaded successfully');
        return ffmpeg;
        
    } catch (error) {
        isLoading = false;
        console.error('Failed to load FFmpeg.wasm:', error);
        throw new Error(`FFmpeg.wasm not available: ${error.message}`);
    }
}

self.onmessage = async function(e) {
    const { type } = e.data;
    
    if (type === 'run') {
        try {
            const { MEMFS } = e.data;
            const inputFile = MEMFS[0];
            
            if (!inputFile || !inputFile.data) {
                throw new Error('No input file data provided');
            }
            
            console.log('Starting MP4 conversion...');
            self.postMessage({ type: 'progress', progress: 10 });
            
            // Load FFmpeg if not already loaded
            const ffmpeg = await loadFFmpeg();
            self.postMessage({ type: 'progress', progress: 30 });
            
            // Write input file to MEMFS
            await ffmpeg.writeFile('input.webm', new Uint8Array(inputFile.data));
            self.postMessage({ type: 'progress', progress: 40 });
            
            // Run FFmpeg conversion: WebM to MP4 with H.264 video and AAC audio
            await ffmpeg.exec([
                '-i', 'input.webm',
                '-c:v', 'libx264',          // H.264 video codec
                '-preset', 'ultrafast',     // Fastest encoding preset for real-time
                '-crf', '28',               // Slightly lower quality for speed
                '-c:a', 'aac',              // AAC audio codec  
                '-b:a', '128k',             // Audio bitrate
                '-movflags', '+faststart',  // Optimize for web streaming
                '-y',                       // Overwrite output file
                'output.mp4'
            ]);
            
            self.postMessage({ type: 'progress', progress: 85 });
            
            // Read the output file
            const outputData = await ffmpeg.readFile('output.mp4');
            
            // Clean up MEMFS
            try {
                await ffmpeg.deleteFile('input.webm');
                await ffmpeg.deleteFile('output.mp4');
            } catch (cleanupError) {
                console.warn('Cleanup warning:', cleanupError.message);
            }
            
            console.log('MP4 conversion completed successfully');
            self.postMessage({ type: 'progress', progress: 100 });
            
            // Send result back to main thread
            self.postMessage({
                type: 'done',
                MEMFS: [{
                    name: 'output.mp4',
                    data: outputData
                }]
            });
            
        } catch (error) {
            console.error('FFmpeg conversion failed:', error);
            self.postMessage({
                type: 'error',
                error: error.message || 'Client-side MP4 conversion failed'
            });
        }
    }
};

// Try to preload FFmpeg and signal readiness
(async function preload() {
    try {
        await loadFFmpeg();
        console.log('FFmpeg preloaded successfully');
        self.postMessage({ type: 'ready' });
    } catch (error) {
        console.log('FFmpeg preload failed, will try on demand:', error.message);
        // Signal readiness anyway - we'll try to load on demand
        self.postMessage({ 
            type: 'ready', 
            warning: 'FFmpeg preload failed, will attempt on-demand loading' 
        });
    }
})();