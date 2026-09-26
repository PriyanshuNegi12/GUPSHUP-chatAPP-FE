// Resizes/crops an image file to a square and compresses it to a small
// base64 data URL, entirely in the browser. No upload endpoint needed —
// the result is stored directly in the `avatar` string field.
export function imageToDataUrl(file, { size = 256, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // center-crop to a square before resizing, so the avatar isn't stretched
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

      // webp gives the smallest file for the quality; canvas falls back to
      // png automatically in the rare browser that can't encode webp
      const dataUrl = canvas.toDataURL('image/webp', quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image'));
    };

    img.src = objectUrl;
  });
}