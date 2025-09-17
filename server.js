const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files and set proper MIME types for ES modules
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));

// Ensure recordings dir exists
const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, recordingsDir);
  },
  filename: function (req, file, cb) {
    // Keep provided filename or timestamp
  const orig = req.body.filename || file.originalname || `recording_${Date.now()}`;
  // ensure extension from original mimetype if possible
  let ext = '.dat';
  if (file.mimetype === 'audio/mpeg' || orig.endsWith('.mp3')) ext = '.mp3';
  else if (file.mimetype.includes('webm') || orig.endsWith('.webm')) ext = '.webm';
  else if (file.mimetype.includes('mp4') || orig.endsWith('.mp4')) ext = '.mp4';
  const name = orig.endsWith(ext) ? orig : (orig + ext);
  cb(null, name);
  }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ ok: true, path: `/recordings/${req.file.filename}` });
});

// Video upload with optional server-side conversion to MP4 using ffmpeg if present
const { execFile, exec } = require('child_process');

app.post('/upload-video', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const savedPath = path.join(recordingsDir, req.file.filename);
  const outName = req.file.filename.replace(/\.webm$|\.dat$|$/, '.mp4');
  const outPath = path.join(recordingsDir, outName);

  // First check if the uploaded file is a valid media file
  execFile('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', savedPath], (probeErr, probeStdout, probeStderr) => {
    if (probeErr) {
      console.warn('File validation failed (not a valid media file):', probeErr.message);
      return res.json({ 
        ok: true, 
        path: `/recordings/${req.file.filename}`, 
        converted: false,
        error: 'Invalid media file - cannot convert to MP4'
      });
    }

    // File is valid, proceed with conversion
    console.log('Converting valid media file to MP4...');
    execFile('ffmpeg', [
      '-y', '-i', savedPath,
      '-c:v', 'libx264',        // Re-encode video to H.264 (required for MP4)
      '-preset', 'fast',        // Faster encoding
      '-crf', '23',             // Good quality balance
      '-c:a', 'aac',            // Re-encode audio to AAC (required for MP4)
      '-b:a', '128k',           // Audio bitrate
      '-movflags', '+faststart', // Optimize for web streaming
      outPath
    ], (err, stdout, stderr) => {
      if (err) {
        console.warn('ffmpeg conversion failed:', err.message);
        console.warn('ffmpeg stderr:', stderr);
        return res.json({ 
          ok: true, 
          path: `/recordings/${req.file.filename}`, 
          converted: false,
          error: 'MP4 conversion failed - ffmpeg error'
        });
      }
      
      console.log('MP4 conversion successful:', outName);
      // Optionally remove original
      try { fs.unlinkSync(savedPath); } catch(e) { console.warn('Could not delete original file:', e.message); }
      res.json({ ok: true, path: `/recordings/${outName}`, converted: true });
    });
  });
});

app.get('/recordings/:name', (req, res) => {
  const p = path.join(recordingsDir, req.params.name);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

// Version check endpoint for diagnostics
app.get('/api/versions', (req, res) => {
  const { exec } = require('child_process');
  
  const versionInfo = {
    nodejs: process.version,
    platform: process.platform,
    arch: process.arch,
    timestamp: new Date().toISOString()
  };

  // Check ffmpeg version
  exec('ffmpeg -version', (err, stdout, stderr) => {
    if (err) {
      versionInfo.ffmpeg = { available: false, error: err.message };
    } else {
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      versionInfo.ffmpeg = { 
        available: true, 
        version: versionMatch ? versionMatch[1] : 'unknown',
        fullOutput: stdout.split('\n')[0] // First line only
      };
    }

    // Check ffprobe version
    exec('ffprobe -version', (probeErr, probeStdout, probeStderr) => {
      if (probeErr) {
        versionInfo.ffprobe = { available: false, error: probeErr.message };
      } else {
        const probeVersionMatch = probeStdout.match(/ffprobe version ([^\s]+)/);
        versionInfo.ffprobe = { 
          available: true, 
          version: probeVersionMatch ? probeVersionMatch[1] : 'unknown'
        };
      }

      // Return comprehensive version info
      res.json(versionInfo);
    });
  });
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
