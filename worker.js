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

    console.log(`Stored WebM file: ${originalName} (${fileBuffer.byteLength} bytes)`);

    // Attempt server-side conversion using online conversion service
    let conversionResult = null;
    let conversionError = null;

    try {
      if (env.CLOUDCONVERT_API_KEY) {
        conversionResult = await convertVideoWithCloudConvert(fileBuffer, originalName, mp4Name, env);
      } else {
        console.log('CloudConvert API key not configured, skipping server-side conversion');
        conversionError = 'Server-side conversion not configured';
      }
    } catch (error) {
      console.error('Server-side conversion failed:', error);
      conversionError = error.message;
    }

    // If conversion was successful, return the MP4 path
    if (conversionResult && conversionResult.success) {
      return new Response(JSON.stringify({ 
        ok: true, 
        path: `/recordings/${mp4Name}`,
        originalPath: `/recordings/${originalName}`,
        converted: true,
        conversionTime: conversionResult.duration,
        note: 'Successfully converted WebM to MP4'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If conversion failed, return original file with clear messaging
    return new Response(JSON.stringify({ 
      ok: true, 
      path: `/recordings/${originalName}`,
      converted: false,
      error: conversionError || 'Server-side conversion not available',
      note: 'Original WebM file stored. Client-side conversion recommended for MP4 format.'
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
 * Convert video using CloudConvert API
 * This is an optional enhancement that requires API key configuration
 */
async function convertVideoWithCloudConvert(fileBuffer, originalName, mp4Name, env) {
  const startTime = Date.now();
  
  try {
    const apiKey = env.CLOUDCONVERT_API_KEY;
    const baseUrl = 'https://api.cloudconvert.com/v2';
    
    // Step 1: Create a job
    const jobResponse = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': {
            operation: 'import/upload'
          },
          'convert-video': {
            operation: 'convert',
            input: 'import-file',
            output_format: 'mp4',
            options: {
              video_codec: 'h264',
              audio_codec: 'aac',
              preset: 'web'
            }
          },
          'export-file': {
            operation: 'export/url',
            input: 'convert-video'
          }
        }
      })
    });
    
    if (!jobResponse.ok) {
      throw new Error(`CloudConvert job creation failed: ${jobResponse.status}`);
    }
    
    const job = await jobResponse.json();
    
    // Step 2: Upload the file
    const importTask = job.data.tasks.find(t => t.name === 'import-file');
    const uploadResponse = await fetch(importTask.result.form.url, {
      method: 'POST',
      body: (() => {
        const formData = new FormData();
        Object.entries(importTask.result.form.parameters).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('file', new Blob([fileBuffer], { type: 'video/webm' }), originalName);
        return formData;
      })()
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`CloudConvert upload failed: ${uploadResponse.status}`);
    }
    
    // Step 3: Wait for conversion to complete (with timeout)
    const maxWaitTime = 120000; // 2 minutes
    let elapsed = 0;
    
    while (elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      elapsed += 2000;
      
      const statusResponse = await fetch(`${baseUrl}/jobs/${job.data.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      const status = await statusResponse.json();
      
      if (status.data.status === 'finished') {
        // Step 4: Download the converted file
        const exportTask = status.data.tasks.find(t => t.name === 'export-file');
        const downloadUrl = exportTask.result.files[0].url;
        
        const downloadResponse = await fetch(downloadUrl);
        if (!downloadResponse.ok) {
          throw new Error(`Download failed: ${downloadResponse.status}`);
        }
        
        const mp4Buffer = await downloadResponse.arrayBuffer();
        
        // Store the converted MP4 file
        await env.RECORDINGS_BUCKET.put(mp4Name, mp4Buffer, {
          httpMetadata: {
            contentType: 'video/mp4',
          },
        });
        
        console.log(`Successfully converted and stored: ${mp4Name}`);
        
        return {
          success: true,
          duration: Date.now() - startTime
        };
      }
      
      if (status.data.status === 'error') {
        throw new Error('CloudConvert job failed');
      }
    }
    
    throw new Error('CloudConvert conversion timeout');
    
  } catch (error) {
    console.error('CloudConvert conversion error:', error);
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
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