/**
 * Cloudflare Worker for Screen Recorder Backend
 * Handles file uploads and video conversion using Cloudflare's serverless platform
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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