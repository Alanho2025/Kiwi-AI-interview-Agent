export const RECORDING_SYNC_TAG = 'kiwi-recording-upload';

export const registerRecordingUploadServiceWorker = async ({ serviceWorker = navigator?.serviceWorker } = {}) => {
  if (!serviceWorker?.register) return null;
  return serviceWorker.register('/recording-upload-worker.js');
};

export const requestRecordingBackgroundSync = async ({ serviceWorker = navigator?.serviceWorker } = {}) => {
  if (!serviceWorker?.ready) return null;
  const registration = await serviceWorker.ready;
  if (!registration?.sync?.register) return null;
  await registration.sync.register(RECORDING_SYNC_TAG);
  return registration;
};
