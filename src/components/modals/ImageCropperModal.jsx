import React, { memo, useRef, useEffect, useCallback } from 'react';

const ImageCropperModal = memo(function ImageCropperModal({
  cropperImage,
  cropperType,
  cropPosition,
  setCropPosition,
  cropZoom,
  setCropZoom,
  onClose,
  handleCropComplete,
}) {
  const frameRef = useRef(null);
  const cropZoomRef = useRef(cropZoom);
  useEffect(() => { cropZoomRef.current = cropZoom; }, [cropZoom]);

  // Attach wheel listener with { passive: false } to allow preventDefault in Chrome
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newZoom = Math.max(1, Math.min(3, cropZoomRef.current + delta));
      setCropZoom(newZoom);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setCropZoom]);
  if (!cropperImage) return null;
  return (
<div className="cropper-overlay-global" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div className="cropper-modal" onClick={(e) => e.stopPropagation()}>
    <div className="cropper-header">
      <h3>{cropperType === 'profileAvatar' ? 'Crop Profile Photo' : cropperType === 'profileCover' ? 'Crop Cover Photo' : 'Crop Image'}</h3>
      <span className="cropper-ratio">{(cropperType === 'square' || cropperType === 'profileAvatar') ? '1:1 Square' : '3:1 Banner'}</span>
    </div>
    <div className="cropper-content">
      <div className="cropper-container">
        <div 
          className={`cropper-frame ${cropperType === 'profileAvatar' ? 'square profileAvatar' : cropperType === 'profileCover' ? 'banner' : cropperType}`}
          onMouseDown={(e) => {
            e.preventDefault();
            const img = e.currentTarget.querySelector('.cropper-image');
            img.dataset.dragging = 'true';
            img.dataset.startX = e.clientX;
            img.dataset.startY = e.clientY;
            img.dataset.origX = cropPosition.x;
            img.dataset.origY = cropPosition.y;
            img.style.cursor = 'grabbing';
            img.style.transition = 'none'; // Disable transition during drag
          }}
          onMouseMove={(e) => {
            const img = e.currentTarget.querySelector('.cropper-image');
            if (img.dataset.dragging !== 'true') return;
            const dx = e.clientX - parseFloat(img.dataset.startX);
            const dy = e.clientY - parseFloat(img.dataset.startY);
            const newX = parseFloat(img.dataset.origX) + dx;
            const newY = parseFloat(img.dataset.origY) + dy;
            img.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px)) scale(${cropZoom})`;
            img.dataset.currentX = newX;
            img.dataset.currentY = newY;
          }}
          onMouseUp={(e) => {
            const img = e.currentTarget.querySelector('.cropper-image');
            if (img.dataset.dragging === 'true') {
              img.dataset.dragging = 'false';
              img.style.cursor = 'grab';
              img.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
              const pX = parseFloat(img.dataset.currentX); const pY = parseFloat(img.dataset.currentY);
              setCropPosition({ x: isNaN(pX) ? cropPosition.x : pX, y: isNaN(pY) ? cropPosition.y : pY });
            }
          }}
          onMouseLeave={(e) => {
            const img = e.currentTarget.querySelector('.cropper-image');
            if (img && img.dataset.dragging === 'true') {
              img.dataset.dragging = 'false';
              img.style.cursor = 'grab';
              img.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
              const pX = parseFloat(img.dataset.currentX); const pY = parseFloat(img.dataset.currentY);
              setCropPosition({ x: isNaN(pX) ? cropPosition.x : pX, y: isNaN(pY) ? cropPosition.y : pY });
            }
          }}
          onTouchStart={(e) => {
            const img = e.currentTarget.querySelector('.cropper-image');
            const touch = e.touches[0];
            img.dataset.dragging = 'true';
            img.dataset.startX = touch.clientX;
            img.style.transition = 'none'; // Disable transition during drag
            img.dataset.startY = touch.clientY;
            img.dataset.origX = cropPosition.x;
            img.dataset.origY = cropPosition.y;
          }}
          onTouchMove={(e) => {
            const img = e.currentTarget.querySelector('.cropper-image');
            if (img.dataset.dragging !== 'true') return;
            const touch = e.touches[0];
            const dx = touch.clientX - parseFloat(img.dataset.startX);
            const dy = touch.clientY - parseFloat(img.dataset.startY);
            const newX = parseFloat(img.dataset.origX) + dx;
            const newY = parseFloat(img.dataset.origY) + dy;
            img.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px)) scale(${cropZoom})`;
            img.dataset.currentX = newX;
            img.dataset.currentY = newY;
          }}
          onTouchEnd={(e) => {
            const img = e.currentTarget.querySelector('.cropper-image');
            if (img.dataset.dragging === 'true') {
              img.dataset.dragging = 'false';
              img.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
              const pX = parseFloat(img.dataset.currentX); const pY = parseFloat(img.dataset.currentY);
              setCropPosition({ x: isNaN(pX) ? cropPosition.x : pX, y: isNaN(pY) ? cropPosition.y : pY });
            }
          }}
          ref={frameRef}
        >
          <img 
            src={cropperImage} 
            alt="Crop preview"
            className="cropper-image global-cropper-img"
            style={{
              transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px)) scale(${cropZoom})`,
              cursor: 'grab',
              transition: 'transform 0.1s ease-out'
            }}
            draggable={false}
          />
          <div className="cropper-grid-overlay">
            <div className="grid-h-1"></div>
            <div className="grid-h-2"></div>
            <div className="grid-v-1"></div>
            <div className="grid-v-2"></div>
          </div>
        </div>
      </div>
      <p className="cropper-hint">Drag to reposition • Scroll to zoom</p>
      <div className="cropper-controls smooth-zoom">
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setCropZoom(prev => Math.max(1, prev - 0.15))}
        >−</button>
        <input 
          type="range" 
          min="1" 
          max="3" 
          step="0.005"
          value={cropZoom}
          onChange={(e) => {
            const newZoom = parseFloat(e.target.value);
            // Direct DOM update for smooth visual feedback
            const img = document.querySelector('.global-cropper-img');
            if (img) {
              const x = cropPosition.x;
              const y = cropPosition.y;
              img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${newZoom})`;
            }
            setCropZoom(newZoom);
          }}
          className="zoom-slider"
        />
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setCropZoom(prev => Math.min(3, prev + 0.15))}
        >+</button>
      </div>
    </div>
    <div className="cropper-actions">
      <button type="button" className="cropper-btn cancel" onClick={() => { onClose(); }}>
        Cancel
      </button>
      <button type="button" className="cropper-btn apply" onClick={handleCropComplete}>
        Apply Crop
      </button>
    </div>
  </div>
</div>
  );
});

export default ImageCropperModal;
