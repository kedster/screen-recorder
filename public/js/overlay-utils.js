// Overlay rendering utilities
export const overlayUtils = {
    async processIcon(file, maxSize = 64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions maintaining aspect ratio
                const { width, height } = this.calculateDimensions(img.width, img.height, maxSize);
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => resolve(createImageBitmap(blob)),
                    'image/png',
                    0.8
                );
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    },

    calculateDimensions(width, height, maxSize) {
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
            } else {
                width = (width / height) * maxSize;
                height = maxSize;
            }
        }
        return { width, height };
    },

    createGradientFill(ctx, width, height, colorStart, colorEnd) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, colorStart || '#4f46e5');
        gradient.addColorStop(1, colorEnd || '#9333ea');
        return gradient;
    },

    drawIcon(ctx, options, canvasWidth, canvasHeight) {
        if (!options.iconImage) return;

        const iconSize = 48;
        const padding = 16;
        const frameSize = options.frame ? (parseInt(options.frameSize) || 30) : 0;
        const x = canvasWidth - iconSize - padding - frameSize;
        const y = canvasHeight - (options.label ? 60 : padding) - iconSize - frameSize;
        
        ctx.save();
        ctx.globalAlpha = parseFloat(options.iconOpacity || 60) / 100;
        ctx.drawImage(options.iconImage, x, y, iconSize, iconSize);
        ctx.restore();
    },

    drawLabel(ctx, options, canvasWidth, canvasHeight) {
        if (!options.labelText) return;

        ctx.save();
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        
        const padding = 20;
        const frameSize = options.frame ? (parseInt(options.frameSize) || 30) : 0;
        const metrics = ctx.measureText(options.labelText);
        const x = canvasWidth - metrics.width - padding - frameSize;
        const y = canvasHeight - padding - frameSize;
        
        ctx.strokeText(options.labelText, x, y);
        ctx.fillText(options.labelText, x, y);
        ctx.restore();
    },

    // Create preview overlays for live preview
    updatePreview(previewContainer, options) {
        // Handle frame
        if (options.frame) {
            previewContainer.classList.add('with-frame');
            document.documentElement.style.setProperty('--frame-size', `${options.frameSize}px`);
            document.documentElement.style.setProperty('--frame-color-1', options.frameColorStart);
            document.documentElement.style.setProperty('--frame-color-2', options.frameColorEnd);
        } else {
            previewContainer.classList.remove('with-frame');
        }

        // Handle label
        if (options.label && options.labelText) {
            if (!previewContainer.querySelector('.preview-label')) {
                const labelEl = document.createElement('div');
                labelEl.className = 'preview-label';
                previewContainer.appendChild(labelEl);
            }
            previewContainer.querySelector('.preview-label').textContent = options.labelText;
            previewContainer.classList.add('with-label');
        } else {
            const labelEl = previewContainer.querySelector('.preview-label');
            if (labelEl) labelEl.remove();
            previewContainer.classList.remove('with-label');
        }

        // Handle icon
        if (options.icon && options.iconImage) {
            if (!previewContainer.querySelector('.preview-icon')) {
                const iconEl = document.createElement('div');
                iconEl.className = 'preview-icon';
                previewContainer.appendChild(iconEl);
            }
            const iconEl = previewContainer.querySelector('.preview-icon');
            iconEl.style.backgroundImage = `url(${options.iconImage})`;
            iconEl.style.opacity = options.iconOpacity / 100;
            previewContainer.classList.add('with-icon');
        } else {
            const iconEl = previewContainer.querySelector('.preview-icon');
            if (iconEl) iconEl.remove();
            previewContainer.classList.remove('with-icon');
        }
    },

    // Create a canvas that renders the video with optional frame/label/icon overlays
    // Returns a Canvas element; the caller may captureStream() from it
    createVideoCanvas(videoEl, options = {}) {
        console.log('[overlayUtils] createVideoCanvas: start', {
            width: videoEl?.videoWidth,
            height: videoEl?.videoHeight,
            readyState: videoEl?.readyState,
            options
        });

        const frameSize = options.frame ? (parseInt(options.frameSize) || 30) : 0;

        const baseWidth = Math.max(1, videoEl.videoWidth || 1280);
        const baseHeight = Math.max(1, videoEl.videoHeight || 720);

        const canvas = document.createElement('canvas');
        canvas.width = baseWidth + frameSize * 2;
        canvas.height = baseHeight + frameSize * 2;
        const ctx = canvas.getContext('2d');

    // Render loop (rAF)
    const render = () => {
            // Background/frame
            if (options.frame) {
                const grad = this.createGradientFill(ctx, canvas.width, canvas.height, options.frameColorStart, options.frameColorEnd);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Draw the video content inside the frame padding
            try {
                if ((videoEl.readyState ?? 0) >= 2) {
                    ctx.drawImage(
                        videoEl,
                        frameSize,
                        frameSize,
                        canvas.width - frameSize * 2,
                        canvas.height - frameSize * 2
                    );
                }
            } catch (e) {
                // Avoid crashing the render loop
                // console.warn('[overlayUtils] drawImage failed', e);
            }

            // Overlays
            try { this.drawLabel(ctx, options, canvas.width, canvas.height); } catch (_) {}
            try { this.drawIcon(ctx, options, canvas.width, canvas.height); } catch (_) {}

            // Continue rendering while the video is playing or until explicitly stopped
            if (!videoEl.ended && !videoEl.paused) {
                requestAnimationFrame(render);
            } else {
                // Draw one last frame to ensure overlays present at end
                try {
                    ctx.drawImage(
                        videoEl,
                        frameSize,
                        frameSize,
                        canvas.width - frameSize * 2,
                        canvas.height - frameSize * 2
                    );
                } catch (_) {}
                console.log('[overlayUtils] createVideoCanvas: video ended/paused, stopping rAF loop');
            }
        };

        requestAnimationFrame(render);

        // Render loop driven by video frames if available
    if (typeof videoEl.requestVideoFrameCallback === 'function') {
            const onFrame = () => {
                try {
                    // Background/frame
                    if (options.frame) {
                        const grad = this.createGradientFill(ctx, canvas.width, canvas.height, options.frameColorStart, options.frameColorEnd);
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    } else {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                    // Draw the video content
                    ctx.drawImage(
                        videoEl,
                        frameSize,
                        frameSize,
                        canvas.width - frameSize * 2,
                        canvas.height - frameSize * 2
                    );
                    // Overlays
                    try { this.drawLabel(ctx, options, canvas.width, canvas.height); } catch (_) {}
                    try { this.drawIcon(ctx, options, canvas.width, canvas.height); } catch (_) {}
                } catch (_) { /* ignore draw errors per-frame */ }
                if (!videoEl.ended && !videoEl.paused) videoEl.requestVideoFrameCallback(onFrame);
            };
            videoEl.requestVideoFrameCallback(onFrame);
        }
        console.log('[overlayUtils] createVideoCanvas: canvas ready', { width: canvas.width, height: canvas.height });
        return canvas;
    }
};
