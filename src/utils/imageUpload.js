import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.6;

/**
 * Compress an image file using Canvas.
 * Resizes to max 800px width, converts to JPEG at 0.6 quality.
 * Returns a Promise<Blob>.
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload a compressed quiz question image to Firebase Storage.
 * Path: quizImages/{uniqueId}.jpg
 * Returns { downloadURL } on success.
 */
export function uploadQuizImage(blob, onProgress) {
  const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, `quizImages/${uniqueId}.jpg`);
      const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
      task.on('state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(percent);
        },
        (error) => { reject(error); },
        () => {
          getDownloadURL(task.snapshot.ref)
            .then((downloadURL) => resolve({ downloadURL }))
            .catch(reject);
        }
      );
    } catch (error) { reject(error); }
  });
}

/**
 * Upload a compressed image to Firebase Storage.
 * Path: boards/{boardCode}/{postId}.jpg
 * Returns { downloadURL } on success.
 * onProgress(percent) called during upload (0-100).
 */
export function uploadImage(boardCode, postId, blob, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, `boards/${boardCode}/${postId}.jpg`);
      const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

      task.on('state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(percent);
        },
        (error) => {
          console.error('[imageUpload] Upload error:', error);
          reject(error);
        },
        () => {
          getDownloadURL(task.snapshot.ref)
            .then((downloadURL) => resolve({ downloadURL }))
            .catch(reject);
        }
      );
    } catch (error) {
      console.error('[imageUpload] Setup error:', error);
      reject(error);
    }
  });
}
