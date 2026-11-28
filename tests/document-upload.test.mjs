import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocumentExtension, isSupportedDocumentName, resolveDocumentMimeType } from '../src/utils/documentUpload.mjs';

test('document extension is read safely from file names and paths', () => {
  assert.equal(getDocumentExtension('Lesson.PDF'), 'pdf');
  assert.equal(getDocumentExtension('content://provider/cache/notes.docx'), 'docx');
  assert.equal(getDocumentExtension('no-extension'), '');
});

test('known file extension overrides unreliable Android ZIP/octet-stream MIME values', () => {
  assert.equal(resolveDocumentMimeType('lesson.docx', 'application/zip'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(resolveDocumentMimeType('slides.pptx', 'application/octet-stream'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
});

test('known extensions provide canonical MIME values when provider MIME is missing', () => {
  assert.equal(resolveDocumentMimeType('scan.pdf', null), 'application/pdf');
  assert.equal(resolveDocumentMimeType('notes.md', ''), 'text/markdown');
  assert.equal(resolveDocumentMimeType('photo.jpeg', 'image/jpeg'), 'image/jpeg');
});

test('unsupported extensions are rejected before upload', () => {
  assert.equal(isSupportedDocumentName('report.docx'), true);
  assert.equal(isSupportedDocumentName('archive.zip'), false);
  assert.equal(isSupportedDocumentName('report'), false);
});
