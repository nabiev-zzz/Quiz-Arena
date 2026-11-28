const MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
});

export function getDocumentExtension(name = '') {
  const cleanName = String(name).split(/[\\/]/).pop() || '';
  const dot = cleanName.lastIndexOf('.');
  return dot > 0 ? cleanName.slice(dot + 1).toLowerCase() : '';
}

export function resolveDocumentMimeType(name, suppliedMimeType) {
  const extensionMime = MIME_BY_EXTENSION[getDocumentExtension(name)];
  const supplied = String(suppliedMimeType || '').split(';')[0].trim().toLowerCase();
  // The extension is checked against the actual file signature by the API.
  // Android document providers often report ZIP/octet-stream for Office files.
  return extensionMime || supplied || 'application/octet-stream';
}

export function isSupportedDocumentName(name) {
  return Object.hasOwn(MIME_BY_EXTENSION, getDocumentExtension(name));
}
