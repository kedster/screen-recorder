/**
 * Cloudflare Pages Function for MP4 Conversion
 * Converts WebM recordings to MP4 using ffmpeg.wasm
 * 
 * Endpoint: /api/convert
 */

// Note: ffmpeg.wasm runs in the browser, not in Cloudflare Workers/Pages Functions
// This is a placeholder that will forward to the worker for conversion
// In production, this should be handled by the Cloudflare Worker with R2 storage

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Get the worker URL from environment variables
    const workerUrl = env.WORKER_URL || 'http://localhost:8787';
    
    // Forward the conversion request to the worker
    const workerRequest = new Request(`${workerUrl}/convert`, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    });

    const response = await fetch(workerRequest);
    return response;

  } catch (error) {
    console.error('Error in convert function:', error);
    
    // Return error response
    return new Response(JSON.stringify({ 
      error: 'Conversion service unavailable',
      message: error.message 
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
