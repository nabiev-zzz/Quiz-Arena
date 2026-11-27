import test from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayVideoSize, resolveCommunityVideoFit } from '../src/utils/communityVideoFit.mjs';

const portraitViewport = { width: 1080, height: 1920 };

test('portrait 9:16 video close to portrait viewport uses cover', () => {
  assert.equal(resolveCommunityVideoFit({ width: 1080, height: 1920 }, portraitViewport), 'cover');
});

test('landscape 16:9 video in portrait viewport uses contain', () => {
  assert.equal(resolveCommunityVideoFit({ width: 1920, height: 1080 }, portraitViewport), 'contain');
});

test('square video in portrait viewport uses contain', () => {
  assert.equal(resolveCommunityVideoFit({ width: 1000, height: 1000 }, portraitViewport), 'contain');
});

test('very tall video outside the tolerance uses contain', () => {
  assert.equal(resolveCommunityVideoFit({ width: 900, height: 2100 }, portraitViewport), 'contain');
});

test('very wide video outside the tolerance uses contain', () => {
  assert.equal(resolveCommunityVideoFit({ width: 2100, height: 900 }, portraitViewport), 'contain');
});

test('90 degree rotation swaps coded width and height', () => {
  const displaySize = getDisplayVideoSize({ width: 1920, height: 1080 }, 90);
  assert.deepEqual(displaySize, { width: 1080, height: 1920 });
  assert.equal(resolveCommunityVideoFit(displaySize, portraitViewport), 'cover');
});

test('270 degree rotation swaps coded width and height', () => {
  assert.deepEqual(getDisplayVideoSize({ width: 1920, height: 1080 }, 270), { width: 1080, height: 1920 });
});

test('missing or invalid dimensions do not choose a fit', () => {
  assert.equal(getDisplayVideoSize(null), null);
  assert.equal(getDisplayVideoSize({ width: 0, height: 1080 }), null);
  assert.equal(resolveCommunityVideoFit(null, portraitViewport), null);
  assert.equal(resolveCommunityVideoFit({ width: 1080, height: 1920 }, null), null);
});