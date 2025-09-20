/**
 * Chunked Upload Utility for reliable video streaming to backend
 * Handles resumable uploads, network failures, and progress tracking
 */

export class ChunkedUploader {
    constructor(options = {}) {
        this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB chunks by default
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        this.baseUrl = options.baseUrl || '';
        this.onProgress = options.onProgress || (() => {});
        this.onError = options.onError || (() => {});
        this.onComplete = options.onComplete || (() => {});
    }

    /**
     * Generate unique upload ID
     */
    generateUploadId() {
        return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Split blob into chunks
     */
    createChunks(blob) {
        const chunks = [];
        let offset = 0;
        
        while (offset < blob.size) {
            const chunk = blob.slice(offset, offset + this.chunkSize);
            chunks.push(chunk);
            offset += this.chunkSize;
        }
        
        return chunks;
    }

    /**
     * Upload a single chunk with retry logic
     */
    async uploadChunk(chunk, uploadId, chunkIndex, totalChunks, retryCount = 0) {
        try {
            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('uploadId', uploadId);
            formData.append('chunkIndex', chunkIndex.toString());
            formData.append('totalChunks', totalChunks.toString());

            const response = await fetch(`${this.baseUrl}/upload-chunk`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.ok) {
                throw new Error(result.error || 'Chunk upload failed');
            }

            return result;

        } catch (error) {
            console.error(`Chunk ${chunkIndex} upload failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                // Exponential backoff
                const delay = this.retryDelay * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.uploadChunk(chunk, uploadId, chunkIndex, totalChunks, retryCount + 1);
            } else {
                throw new Error(`Chunk ${chunkIndex} failed after ${this.maxRetries + 1} attempts: ${error.message}`);
            }
        }
    }

    /**
     * Check upload status for resumable functionality
     */
    async checkUploadStatus(uploadId) {
        try {
            const response = await fetch(`${this.baseUrl}/upload-status/${uploadId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { exists: false };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return { exists: true, ...result };

        } catch (error) {
            console.error('Upload status check failed:', error);
            return { exists: false, error: error.message };
        }
    }

    /**
     * Finalize the upload by combining chunks
     */
    async finalizeUpload(uploadId, filename, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/finalize-upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uploadId,
                    filename,
                    options,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.ok) {
                throw new Error(result.error || 'Upload finalization failed');
            }

            return result;

        } catch (error) {
            console.error('Upload finalization failed:', error);
            throw error;
        }
    }

    /**
     * Main upload method with resumable support
     */
    async upload(blob, filename, options = {}) {
        const uploadId = this.generateUploadId();
        
        try {
            console.log(`Starting chunked upload: ${uploadId}`);
            
            // Create chunks
            const chunks = this.createChunks(blob);
            const totalChunks = chunks.length;
            
            console.log(`Upload ${uploadId}: ${totalChunks} chunks, ${this.chunkSize} bytes each`);
            
            // Check if we need to resume an existing upload
            let resumeFrom = 0;
            if (options.resumable) {
                const status = await this.checkUploadStatus(uploadId);
                if (status.exists) {
                    resumeFrom = status.completedChunks || 0;
                    console.log(`Resuming upload from chunk ${resumeFrom}`);
                }
            }

            // Upload chunks
            const uploadPromises = [];
            for (let i = resumeFrom; i < chunks.length; i++) {
                const promise = this.uploadChunk(chunks[i], uploadId, i, totalChunks)
                    .then(result => {
                        const progress = ((i + 1) / totalChunks) * 100;
                        this.onProgress({
                            uploadId,
                            chunkIndex: i,
                            totalChunks,
                            progress,
                            chunksCompleted: i + 1,
                        });
                        return result;
                    });
                
                uploadPromises.push(promise);
                
                // Optional: Limit concurrent uploads to prevent overwhelming the server
                if (options.maxConcurrent && uploadPromises.length >= options.maxConcurrent) {
                    await Promise.race(uploadPromises);
                    // Remove completed promises
                    const settled = await Promise.allSettled(uploadPromises);
                    uploadPromises.length = 0;
                    uploadPromises.push(...settled.filter(p => p.status === 'pending').map(p => p.value));
                }
            }

            // Wait for all chunks to complete
            await Promise.all(uploadPromises);
            
            console.log(`All chunks uploaded for ${uploadId}, finalizing...`);
            
            // Finalize the upload
            const result = await this.finalizeUpload(uploadId, filename, options);
            
            console.log(`Upload ${uploadId} completed successfully:`, result);
            
            this.onComplete({
                uploadId,
                filename: result.filename,
                path: result.path,
                size: result.size,
            });
            
            return result;

        } catch (error) {
            console.error(`Upload ${uploadId} failed:`, error);
            this.onError({
                uploadId,
                error: error.message,
                filename,
            });
            throw error;
        }
    }

    /**
     * Simple non-chunked upload for smaller files or fallback
     */
    async uploadDirect(blob, filename, options = {}) {
        try {
            console.log('Using direct upload for:', filename);
            
            const formData = new FormData();
            formData.append('file', blob, filename);
            if (options) {
                formData.append('options', JSON.stringify(options));
            }
            if (filename) {
                formData.append('filename', filename);
            }

            const response = await fetch(`${this.baseUrl}/process-video-chunks`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.ok) {
                throw new Error(result.error || 'Direct upload failed');
            }

            this.onComplete({
                filename: result.filename,
                path: result.path,
                size: result.size,
                direct: true,
            });

            return result;

        } catch (error) {
            console.error('Direct upload failed:', error);
            this.onError({
                error: error.message,
                filename,
                direct: true,
            });
            throw error;
        }
    }

    /**
     * Smart upload - chooses chunked or direct based on file size
     */
    async smartUpload(blob, filename, options = {}) {
        const sizeThreshold = options.chunkThreshold || 5 * 1024 * 1024; // 5MB default
        
        if (blob.size <= sizeThreshold) {
            console.log(`File size ${blob.size} bytes <= ${sizeThreshold}, using direct upload`);
            return this.uploadDirect(blob, filename, options);
        } else {
            console.log(`File size ${blob.size} bytes > ${sizeThreshold}, using chunked upload`);
            return this.upload(blob, filename, options);
        }
    }
}

// Export a default instance for convenience
export const chunkedUploader = new ChunkedUploader();