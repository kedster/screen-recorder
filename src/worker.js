/**
 * Cloudflare Worker for Screen Recorder API
 * Handles file uploads and storage using R2
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight requests
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  return null;
}

// Generate unique filename
function generateFilename(originalName, mimeType) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  
  // Determine extension from mime type
  let ext = '.dat';
  if (mimeType === 'audio/mpeg' || originalName?.endsWith('.mp3')) ext = '.mp3';
  else if (mimeType?.includes('webm') || originalName?.endsWith('.webm')) ext = '.webm';
  else if (mimeType?.includes('mp4') || originalName?.endsWith('.mp4')) ext = '.mp4';
  
  const baseName = originalName || `recording_${timestamp}_${random}`;
  return baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;
}

// Handle file upload
async function handleUpload(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const customFilename = formData.get('filename');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filename = generateFilename(customFilename || file.name, file.type);
    const arrayBuffer = await file.arrayBuffer();

    // Store file in R2 bucket
    await env.RECORDINGS_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalName: file.name || '',
        uploadedAt: new Date().toISOString(),
        size: arrayBuffer.byteLength.toString(),
      },
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${filename}`,
      filename: filename 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle video upload (same as regular upload for now, without ffmpeg conversion)
async function handleVideoUpload(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const customFilename = formData.get('filename');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filename = generateFilename(customFilename || file.name, file.type);
    const arrayBuffer = await file.arrayBuffer();

    // Store file in R2 bucket
    await env.RECORDINGS_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalName: file.name || '',
        uploadedAt: new Date().toISOString(),
        size: arrayBuffer.byteLength.toString(),
        converted: 'false', // No server-side conversion in Workers
      },
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${filename}`,
      filename: filename,
      converted: false // No ffmpeg conversion available in Workers
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video upload error:', error);
    return new Response(JSON.stringify({ error: 'Video upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle file retrieval
async function handleFileRetrieval(filename, env) {
  try {
    const object = await env.RECORDINGS_BUCKET.get(filename);
    
    if (!object) {
      return new Response('Not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('File retrieval error:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Main handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route requests
    if (pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    
    if (pathname === '/upload-video' && request.method === 'POST') {
      return handleVideoUpload(request, env);
    }
    
    if (pathname.startsWith('/recordings/') && request.method === 'GET') {
      const filename = pathname.replace('/recordings/', '');
      return handleFileRetrieval(filename, env);
    }

    // Default response for unmatched routes
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders,
    });
  },
};