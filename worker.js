/**
 * Cloudflare Worker for Screen Recorder Backend
 * Handles file uploads and video conversion using Cloudflare's serverless platform
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Enhanced CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Range, X-Upload-Id, X-Chunk-Index, X-Total-Chunks',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Route handlers
      if (pathname === '/upload' && request.method === 'POST') {
        return await handleAudioUpload(request, env, corsHeaders);
      }
      
      if (pathname === '/upload-video' && request.method === 'POST') {
        return await handleVideoUpload(request, env, corsHeaders);
      }
      
      // Convert endpoint for MP4 conversion
      if (pathname === '/convert' && request.method === 'POST') {
        return await handleConvert(request, env, corsHeaders);
      }
      
      // New super function for chunked video processing
      if (pathname === '/process-video-chunks' && request.method === 'POST') {
        return await handleVideoChunkProcessing(request, env, corsHeaders);
      }
      
      // Chunked upload endpoints
      if (pathname === '/upload-chunk' && request.method === 'POST') {
        return await handleChunkUpload(request, env, corsHeaders);
      }
      
      if (pathname === '/finalize-upload' && request.method === 'POST') {
        return await handleUploadFinalization(request, env, corsHeaders);
      }
      
      // Upload status check for resumable uploads
      if (pathname.startsWith('/upload-status/') && request.method === 'GET') {
        return await handleUploadStatus(pathname, env, corsHeaders);
      }
      
      if (pathname.startsWith('/recordings/') && request.method === 'GET') {
        return await handleFileDownload(pathname, env, corsHeaders);
      }

      // Default 404 response
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders,
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders,
      });
    }
  }
};

/**
 * Handle audio file uploads
 */
async function handleAudioUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate filename with proper extension
    const timestamp = Date.now();
    const filename = formData.get('filename') || file.name || `recording_${timestamp}`;
    
    let ext = '.dat';
    if (file.type === 'audio/mpeg' || filename.endsWith('.mp3')) ext = '.mp3';
    else if (file.type.includes('webm') || filename.endsWith('.webm')) ext = '.webm';
    else if (file.type.includes('mp4') || filename.endsWith('.mp4')) ext = '.mp4';
    
    const finalName = filename.endsWith(ext) ? filename : (filename + ext);
    
    // Store file in R2 bucket
    const fileBuffer = await file.arrayBuffer();
    await env.RECORDINGS_BUCKET.put(finalName, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${finalName}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle video file uploads with optional conversion
 */
async function handleVideoUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = formData.get('filename') || file.name || `recording_${timestamp}`;
    const originalName = filename.endsWith('.webm') ? filename : (filename + '.webm');
    const mp4Name = originalName.replace(/\.webm$|\.dat$|$/, '.mp4');
    
    // Store original file in R2 bucket
    const fileBuffer = await file.arrayBuffer();
    await env.RECORDINGS_BUCKET.put(originalName, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'video/webm',
      },
    });

    // For now, return the original file since Cloudflare Workers
    // don't have ffmpeg built-in. In production, you could:
    // 1. Use a third-party conversion service
    // 2. Trigger a Durable Object for conversion
    // 3. Use client-side conversion only
    
    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${originalName}`,
      converted: false,
      note: 'Server-side video conversion not available in Cloudflare Workers. Consider client-side conversion.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle video conversion request (WebM to MP4)
 * Note: Cloudflare Workers don't support ffmpeg natively
 * This endpoint stores the file and returns it as-is
 * Client-side conversion using ffmpeg.wasm is recommended
 */
async function handleConvert(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = file.name || `recording_${timestamp}.webm`;
    
    // Store in R2 bucket
    const fileBuffer = await file.arrayBuffer();
    await env.RECORDINGS_BUCKET.put(filename, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'video/webm',
      },
    });

    // Return the WebM file directly since we can't convert server-side
    // The client should handle conversion using ffmpeg.wasm
    return new Response(fileBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'video/webm',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Convert error:', error);
    return new Response(JSON.stringify({ 
      error: 'Conversion failed',
      message: 'Server-side conversion not available. Please use client-side conversion.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle file downloads from R2 storage
 */
async function handleFileDownload(pathname, env, corsHeaders) {
  try {
    const filename = pathname.replace('/recordings/', '');
    
    const object = await env.RECORDINGS_BUCKET.get(filename);
    
    if (!object) {
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders,
      });
    }

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Content-Length', object.size);
    headers.set('Cache-Control', 'public, max-age=31536000');

    return new Response(object.body, { headers });

  } catch (error) {
    console.error('File download error:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle chunked upload for video streaming
 */
async function handleChunkUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk');
    const uploadId = formData.get('uploadId');
    const chunkIndex = parseInt(formData.get('chunkIndex'));
    const totalChunks = parseInt(formData.get('totalChunks'));
    
    if (!chunk || !uploadId || isNaN(chunkIndex)) {
      return new Response(JSON.stringify({ error: 'Missing required chunk data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store chunk in R2 with upload ID and chunk index
    const chunkKey = `uploads/${uploadId}/chunk_${chunkIndex.toString().padStart(4, '0')}`;
    const chunkBuffer = await chunk.arrayBuffer();
    
    await env.RECORDINGS_BUCKET.put(chunkKey, chunkBuffer, {
      httpMetadata: {
        contentType: 'application/octet-stream',
      },
      customMetadata: {
        uploadId,
        chunkIndex: chunkIndex.toString(),
        totalChunks: totalChunks.toString(),
        timestamp: Date.now().toString(),
      },
    });

    // Store upload metadata for tracking
    const metadataKey = `uploads/${uploadId}/metadata`;
    const metadata = {
      uploadId,
      totalChunks,
      chunksReceived: chunkIndex + 1, // This is simplified - in production you'd track all received chunks
      lastChunkIndex: chunkIndex,
      timestamp: Date.now(),
    };
    
    await env.RECORDINGS_BUCKET.put(metadataKey, JSON.stringify(metadata), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      uploadId,
      chunkIndex,
      received: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Chunk upload error:', error);
    return new Response(JSON.stringify({ error: 'Chunk upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle upload finalization and processing
 */
async function handleUploadFinalization(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { uploadId, filename, options = {} } = data;
    
    if (!uploadId) {
      return new Response(JSON.stringify({ error: 'Missing uploadId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get upload metadata
    const metadataKey = `uploads/${uploadId}/metadata`;
    const metadataObj = await env.RECORDINGS_BUCKET.get(metadataKey);
    
    if (!metadataObj) {
      return new Response(JSON.stringify({ error: 'Upload not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = JSON.parse(await metadataObj.text());
    
    // Reconstruct file from chunks
    const chunks = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkKey = `uploads/${uploadId}/chunk_${i.toString().padStart(4, '0')}`;
      const chunkObj = await env.RECORDINGS_BUCKET.get(chunkKey);
      
      if (!chunkObj) {
        return new Response(JSON.stringify({ error: `Missing chunk ${i}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      chunks.push(new Uint8Array(await chunkObj.arrayBuffer()));
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Generate final filename
    const timestamp = Date.now();
    const finalFilename = filename || `recording_${timestamp}.webm`;
    
    // Store the final combined file
    await env.RECORDINGS_BUCKET.put(`recordings/${finalFilename}`, combinedBuffer, {
      httpMetadata: {
        contentType: 'video/webm',
      },
      customMetadata: {
        originalUploadId: uploadId,
        processedAt: timestamp.toString(),
        ...options,
      },
    });

    // Clean up temporary chunks
    try {
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `uploads/${uploadId}/chunk_${i.toString().padStart(4, '0')}`;
        await env.RECORDINGS_BUCKET.delete(chunkKey);
      }
      await env.RECORDINGS_BUCKET.delete(metadataKey);
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
      // Don't fail the request for cleanup errors
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${finalFilename}`,
      uploadId,
      processed: true,
      size: totalLength,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload finalization error:', error);
    return new Response(JSON.stringify({ error: 'Upload finalization failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle upload status check for resumable uploads
 */
async function handleUploadStatus(pathname, env, corsHeaders) {
  try {
    const uploadId = pathname.replace('/upload-status/', '');
    
    const metadataKey = `uploads/${uploadId}/metadata`;
    const metadataObj = await env.RECORDINGS_BUCKET.get(metadataKey);
    
    if (!metadataObj) {
      return new Response(JSON.stringify({ error: 'Upload not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = JSON.parse(await metadataObj.text());
    
    // Check which chunks exist
    const receivedChunks = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkKey = `uploads/${uploadId}/chunk_${i.toString().padStart(4, '0')}`;
      const chunkObj = await env.RECORDINGS_BUCKET.get(chunkKey);
      if (chunkObj) {
        receivedChunks.push(i);
      }
    }

    return new Response(JSON.stringify({ 
      uploadId,
      totalChunks: metadata.totalChunks,
      receivedChunks,
      completedChunks: receivedChunks.length,
      isComplete: receivedChunks.length === metadata.totalChunks,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload status error:', error);
    return new Response(JSON.stringify({ error: 'Upload status check failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Super function for video chunk processing - handles everything in one call
 */
async function handleVideoChunkProcessing(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const filename = formData.get('filename');
    const options = formData.get('options');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse options if provided
    let processingOptions = {};
    if (options) {
      try {
        processingOptions = JSON.parse(options);
      } catch (e) {
        console.warn('Invalid options JSON:', e);
      }
    }

    // Generate filename
    const timestamp = Date.now();
    const finalFilename = filename || `recording_${timestamp}.webm`;
    
    // Process the video file
    const fileBuffer = await file.arrayBuffer();
    
    // Store the processed file directly
    await env.RECORDINGS_BUCKET.put(`recordings/${finalFilename}`, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'video/webm',
      },
      customMetadata: {
        processedAt: timestamp.toString(),
        processingOptions: JSON.stringify(processingOptions),
        originalSize: fileBuffer.byteLength.toString(),
      },
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${finalFilename}`,
      processed: true,
      size: fileBuffer.byteLength,
      filename: finalFilename,
      note: 'Video processed and stored successfully. Advanced processing (MP4 conversion, overlays) would require additional services.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video processing error:', error);
    return new Response(JSON.stringify({ error: 'Video processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}