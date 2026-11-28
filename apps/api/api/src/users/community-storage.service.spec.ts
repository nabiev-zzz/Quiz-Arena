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

  it('immediately revokes an existing signed attachment URL by deleting its storage object', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const service = new CommunityStorageService();
    await expect(service.delete('community/user-123/123e4567-e89b-12d3-a456-426614174000.pdf'))
      .resolves.toEqual({ deleted: true });
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('X-Amz-Expires=300'), { method: 'DELETE' });
  });

  it('rejects storage deletion keys outside the owned community media namespace', async () => {
    const service = new CommunityStorageService();
    await expect(service.delete('invalid-storage-key')).rejects.toBeInstanceOf(BadRequestException);
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

  it.each([
    ['audio/mp4', 'm4a'],
    ['audio/webm', 'webm'],
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['application/pdf', 'pdf'],
    ['application/msword', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ])('stores direct chat media type %s under the authenticated user', async (contentType, extension) => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    const service = new CommunityStorageService();
    const fileName = `123e4567-e89b-12d3-a456-426614174000.${extension}`;
    const result = await service.upload('user-123', fileName, contentType, Buffer.from('media-data'));
    expect(result).toEqual({ mediaKey: `community/user-123/${fileName}`, mediaType: contentType });
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


  it('proxies byte-range video requests to storage and preserves partial response headers', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { 'content-type': 'video/mp4', 'content-length': '3', 'content-range': 'bytes 0-2/10', 'accept-ranges': 'bytes' },
    }));
    const service = new CommunityStorageService();
    const result = await service.fetchVideoStream('community/user-123/clip.playable.mp4', 'bytes=0-2');
    expect(result).toMatchObject({ status: 206, contentType: 'video/mp4', contentLength: '3', contentRange: 'bytes 0-2/10', acceptRanges: 'bytes' });
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('clip.playable.mp4'), { headers: { Range: 'bytes=0-2' } });
  });


  it('accepts verified owner-scoped audio uploads for voice messages', async () => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'content-length': '2048', 'content-type': 'audio/mp4' },
    }));
    const service = new CommunityStorageService();
    const result = await service.verify('user-123', 'community/user-123/123e4567-e89b-12d3-a456-426614174000.m4a', 'audio/mp4', 2048);
    expect(result).toEqual({ verified: true, size: 2048, mediaType: 'audio/mp4' });
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('123e4567-e89b-12d3-a456-426614174000.m4a'), { method: 'HEAD' });
  });


  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['application/pdf', 'pdf'],
    ['application/msword', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ])('verifies owner-scoped attachment type %s', async (contentType, extension) => {
    Object.assign(process.env, {
      COMMUNITY_S3_ENDPOINT: 'https://storage.example.test',
      COMMUNITY_S3_BUCKET: 'zelqen-media',
      COMMUNITY_S3_REGION: 'auto',
      COMMUNITY_S3_ACCESS_KEY_ID: 'test-access',
      COMMUNITY_S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'content-length': '2048', 'content-type': contentType },
    }));
    const service = new CommunityStorageService();
    const key = `community/user-123/123e4567-e89b-12d3-a456-426614174000.${extension}`;
    await expect(service.verify('user-123', key, contentType, 2048)).resolves.toEqual({ verified: true, size: 2048, mediaType: contentType });
  });

  it('rejects voice messages uploaded under another user media prefix', async () => {
    const service = new CommunityStorageService();
    await expect(service.verify('user-123', 'community/another-user/123e4567-e89b-12d3-a456-426614174000.m4a', 'audio/mp4', 2048))
      .rejects.toBeInstanceOf(BadRequestException);
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
