// MP4 conversion utilities
export const mp4Utils = {
    async convertToMp4(webmBlob) {
        if (!webmBlob) {
            throw new Error('No WebM blob provided');
        }
        // Resolve potential worker locations. We'll try a few common spots.
        const candidateWorkerUrls = [
            // Prefer alongside this file: /public/js/ffmpeg-worker-mp4.js
            new URL('./ffmpeg-worker-mp4.js', import.meta.url).href,
            // Or at project root: /public/ffmpeg-worker-mp4.js
            new URL('../ffmpeg-worker-mp4.js', import.meta.url).href,
            // Fallbacks using origin (older code path)
            `${window.location.origin}/ffmpeg-worker-mp4.js`,
            `${window.location.origin}/js/ffmpeg-worker-mp4.js`
        ];
        if (window.location.protocol === 'file:') {
            console.warn('MP4 conversion: running from file:// may block Worker loading. Use a local web server.');
        }
        console.log('MP4: candidate worker URLs:', candidateWorkerUrls);
        
        return new Promise((resolve, reject) => {
            let worker;
            let urlIndex = -1;

            const cleanup = () => {
                if (worker) {
                    try {
                        worker.terminate();
                    } catch (e) {
                        console.error('Error terminating worker:', e);
                    }
                }
                worker = null;
            };

            const attachHandlers = () => {
                if (!worker) return;
                worker.onerror = (error) => {
                    console.warn('MP4 worker error at', candidateWorkerUrls[urlIndex], error);
                    cleanup();
                    // Try next candidate URL if available
                    tryNext();
                };

                worker.onmessage = (e) => {
                    if (!e.data) {
                        cleanup();
                        reject(new Error('Invalid worker message'));
                        return;
                    }

                    const { type } = e.data;
                    if (type !== 'stdout' && type !== 'stderr') {
                        console.log('Worker message:', type);
                    }

                    switch (type) {
                        case 'ready': {
                            console.log('Worker ready, starting conversion...');
                            const reader = new FileReader();

                            reader.onerror = (error) => {
                                console.error('FileReader error:', error);
                                cleanup();
                                reject(error);
                            };

                            reader.onload = () => {
                                console.log('File loaded, sending to worker...');
                                try {
                                    worker.postMessage({
                                        type: 'run',
                                        arguments: [
                                            '-i', 'input.webm',
                                            // NOTE: Copying codecs from WebM to MP4 is generally not valid (VP8/VP9 + Opus);
                                            // your ffmpeg build may need to transcode. This is kept minimal per request.
                                            '-c:v', 'copy',
                                            '-c:a', 'copy',
                                            'output.mp4'
                                        ],
                                        MEMFS: [{
                                            name: 'input.webm',
                                            data: new Uint8Array(reader.result)
                                        }]
                                    });
                                } catch (error) {
                                    console.error('Worker postMessage error:', error);
                                    cleanup();
                                    reject(error);
                                }
                            };

                            reader.readAsArrayBuffer(webmBlob);
                            break;
                        }

                        case 'stderr':
                            // ffmpeg logs/errors come through here; keep for debugging
                            console.debug('[ffmpeg]', e.data.data);
                            break;

                        case 'done': {
                            console.log('Conversion complete');
                            // ffmpeg.js returns output in e.data.MEMFS
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
                            console.error('Conversion error:', e.data);
                            cleanup();
                            reject(new Error(e.data.error || 'MP4 conversion failed'));
                            break;

                        default:
                            console.warn('Unknown worker message type:', type);
                            break;
                    }
                };
            };

            const tryNext = () => {
                urlIndex += 1;
                if (urlIndex >= candidateWorkerUrls.length) {
                    reject(new Error(
                        'MP4 worker not found. Place ffmpeg-worker-mp4.js at one of: ' + candidateWorkerUrls.join(', ')
                    ));
                    return;
                }
                const url = candidateWorkerUrls[urlIndex];
                try {
                    console.log('Attempting to load MP4 worker from:', url);
                    worker = new Worker(url);
                    attachHandlers();
                } catch (error) {
                    console.warn('Failed to create worker at', url, error);
                    cleanup();
                    tryNext();
                }
            };

            tryNext();
        });
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
