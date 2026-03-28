// S4-02: Photo proof capture and upload service
// Handles camera/gallery image picking, compression, and Firebase Storage upload.
// Never called from components directly — use via service layer.

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// ── Constants ────────────────────────────────────────────────────────────────

const COMPRESSED_WIDTH = 800;
const JPEG_QUALITY = 0.8;

// ── Image Picking ────────────────────────────────────────────────────────────

/**
 * Launches the device camera, captures a photo, compresses it to
 * 800px wide at 80% JPEG quality, and returns the local URI.
 * Returns null if the user cancels.
 */
export async function pickImageFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission not granted');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    allowsEditing: false,
    quality: 1, // capture at full quality; we compress below
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return compressImage(result.assets[0].uri);
}

/**
 * Opens the device gallery, lets the user pick an image, compresses it to
 * 800px wide at 80% JPEG quality, and returns the local URI.
 * Returns null if the user cancels.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Gallery permission not granted');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return compressImage(result.assets[0].uri);
}

// ── Compression ──────────────────────────────────────────────────────────────

async function compressImage(uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: COMPRESSED_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return manipulated.uri;
}

// ── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads a local image to Firebase Storage at:
 *   families/{familyId}/taskProofs/{claimId}/proof.jpg
 *
 * Returns the download URL on success.
 * Optionally accepts an onProgress callback (0-100).
 */
export async function uploadTaskProof(
  familyId: string,
  claimId: string,
  localUri: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Convert local URI to blob
  const response = await fetch(localUri);
  const blob = await response.blob();

  const storagePath = `families/${familyId}/taskProofs/${claimId}/proof.jpg`;
  const storageRef = ref(storage, storagePath);

  return new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(percent);
      },
      (error) => {
        console.error('[storage] Upload failed:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}
