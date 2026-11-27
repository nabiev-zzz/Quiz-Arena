import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { CommunityStorageService } from './community-storage.service';

describe('CommunityStorageService video uploads', () => {
  const original = {
    endpoint: process.env.COMMUNITY_S3_ENDPOINT,
    bucket: process.env.COMMUNITY_S3_BUCKET,
    region: process.env.COMMUNITY_S3_REGION,
    accessKey: process.env.COMMUNITY_S3_ACCESS_KEY_ID,
    secretKey: process.env.COMMUNITY_S3_SECRET_ACCESS_KEY,
  };
  afterEach(() => {
    process.env.COMMUNITY_S3_ENDPOINT = original.endpoint;
    process.env.COMMUNITY_S3_BUCKET = original.bucket;
    process.env.COMMUNITY_S3_REGION = original.region;
    process.env.COMMUNITY_S3_ACCESS_KEY_ID = original.accessKey;
    process.env.COMMUNITY_S3_SECRET_ACCESS_KEY = original.secretKey;
    jest.restoreAllMocks();
  });

  it('creates a signed upload URL for the owner-specific media key', () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const service = new CommunityStorageService();
    const key = service.createKey('user-123', 'mp4');
    const url = service.sign('PUT', key, 900);
    expect(key).toMatch(/^community\/user-123\/[a-f0-9-]{36}\.mp4$/i);
    expect(url).toContain('zelqen-media.storage.example.test/community/user-123/');
    expect(url).toContain('X-Amz-Expires=900');
  });

  it('stores uploaded video with a playable content type and long-lived cache metadata', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    const service = new CommunityStorageService();
    const result = await service.upload('user-123', '123e4567-e89b-12d3-a456-426614174000.mp4', 'video/mp4', Buffer.from('mp4-data'));

    expect(result).toEqual({ mediaKey: 'community/user-123/123e4567-e89b-12d3-a456-426614174000.mp4', mediaType: 'video/mp4' });
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('community/user-123/123e4567-e89b-12d3-a456-426614174000.mp4'), expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=31536000, immutable' },
    }));
  });

  it('verifies the exact stored video byte size before a clip is published', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'content-length': '4096', 'content-type': 'video/mp4' },
    }));
    const service = new CommunityStorageService();
    jest.spyOn(service as unknown as { createCompatibleVideo: (userId: string, key: string) => Promise<string> }, 'createCompatibleVideo')
      .mockResolvedValue('community/user-123/123e4567-e89b-12d3-a456-426614174000.playable.mp4');
    const result = await service.verify('user-123', 'community/user-123/123e4567-e89b-12d3-a456-426614174000.mp4', 'video/mp4', 4096);
    expect(result).toEqual({
      verified: true, size: 4096, mediaType: 'video/mp4',
      playbackMediaKey: 'community/user-123/123e4567-e89b-12d3-a456-426614174000.playable.mp4',
      playbackMediaType: 'video/mp4',
    });
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('X-Amz-Algorithm=AWS4-HMAC-SHA256'), { method: 'HEAD' });
  });

  it('rejects verification requests for another user media key', async () => {
    const service = new CommunityStorageService();
    await expect(service.verify('user-123', 'community/another-user/123e4567-e89b-12d3-a456-426614174000.mp4', 'video/mp4', 4096))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a video whose stored byte size differs from the original file', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'content-length': '4000', 'content-type': 'video/mp4' },
    }));
    const service = new CommunityStorageService();
    await expect(service.verify('user-123', 'community/user-123/123e4567-e89b-12d3-a456-426614174000.mp4', 'video/mp4', 4096))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects video uploads above the supported 30 MB limit', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const service = new CommunityStorageService();
    await expect(service.upload('user-123', '123e4567-e89b-12d3-a456-426614174000.mp4', 'video/mp4', Buffer.alloc(30 * 1024 * 1024 + 1)))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
