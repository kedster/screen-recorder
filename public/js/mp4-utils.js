// MP4 conversion utilities
export const mp4Utils = {
    async convertToMp4(webmBlob) {
        if (!webmBlob) {
            throw new Error('No WebM blob provided');
        }
        
        console.log('Attempting client-side MP4 conversion...');
        
        try {
            // Try client-side conversion first
            return await this.convertClientSide(webmBlob);
        } catch (clientError) {
            console.log('Client-side conversion failed, trying server-side:', clientError.message);
            
            try {
                // Fall back to server-side conversion
                return await this.convertServerSide(webmBlob);
            } catch (serverError) {
                console.error('Both client and server conversion failed:', serverError);
                // Return original blob as fallback
                console.log('Returning original WebM file');
                throw new Error('MP4 conversion failed: ' + serverError.message);
            }
        }
    },

    async convertClientSide(webmBlob) {
        // Try to use ffmpeg worker for client-side conversion
        const workerUrl = new URL('./ffmpeg-worker-mp4.js', import.meta.url).href;
        
        return new Promise((resolve, reject) => {
            let worker;
            let timeoutId;

            const cleanup = () => {
                if (worker) {
                    try {
                        worker.terminate();
                    } catch (e) {
                        console.error('Error terminating worker:', e);
                    }
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                worker = null;
            };

            try {
                worker = new Worker(workerUrl);
                
                // Set a timeout for the conversion
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error('Client-side conversion timeout'));
                }, 30000); // 30 second timeout

                worker.onerror = (error) => {
                    cleanup();
                    reject(new Error('Worker error: ' + error.message));
                };

                worker.onmessage = (e) => {
                    if (!e.data) {
                        cleanup();
                        reject(new Error('Invalid worker message'));
                        return;
                    }

                    const { type } = e.data;

                    switch (type) {
                        case 'ready': {
                            // Worker is ready, start conversion
                            const reader = new FileReader();
                            reader.onload = () => {
                                try {
                                    worker.postMessage({
                                        type: 'run',
                                        MEMFS: [{
                                            name: 'input.webm',
                                            data: new Uint8Array(reader.result)
                                        }]
                                    });
                                } catch (error) {
                                    cleanup();
                                    reject(error);
                                }
                            };
                            reader.onerror = () => {
                                cleanup();
                                reject(new Error('Failed to read WebM file'));
                            };
                            reader.readAsArrayBuffer(webmBlob);
                            break;
                        }

                        case 'done': {
                            const memfs = e.data.MEMFS || e.data.data?.MEMFS;
                            const outFile = Array.isArray(memfs)
                                ? (memfs.find(f => f.name === 'output.mp4') || memfs[0])
                                : null;
                            if (outFile?.data) {
                                const mp4Blob = new Blob([outFile.data], { type: 'video/mp4' });
                                cleanup();
                                resolve(mp4Blob);
                            } else {
                                cleanup();
                                reject(new Error('No data in conversion result'));
                            }
                            break;
                        }

                        case 'error':
                            cleanup();
                            reject(new Error(e.data.error || 'Client-side conversion failed'));
                            break;

                        default:
                            // Ignore other message types
                            break;
                    }
                };

            } catch (error) {
                cleanup();
                reject(new Error('Failed to create worker: ' + error.message));
            }
        });
    },

    async convertServerSide(webmBlob) {
        console.log('Attempting server-side MP4 conversion...');
        
        const formData = new FormData();
        formData.append('file', webmBlob, 'recording.webm');
        
        const response = await fetch('/upload-video', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Server conversion failed: ' + response.statusText);
        }
        
        const result = await response.json();
        
        if (!result.ok) {
            throw new Error('Server conversion failed: ' + (result.error || 'Unknown error'));
        }
        
        // Download the converted file
        const videoResponse = await fetch(result.path);
        if (!videoResponse.ok) {
            throw new Error('Failed to download converted video');
        }
        
        const mp4Blob = await videoResponse.blob();
        
        if (result.converted) {
            console.log('Server-side conversion successful');
        } else {
            console.log('Server returned original file (ffmpeg not available)');
        }
        
        return mp4Blob;
    },

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
        const l = float32Array.length;
        const buf = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            buf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return buf;
    },

    loadLameJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/lamejs@1.2.0/lame.min.js';
            script.onload = () => setTimeout(resolve, 50);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
};
