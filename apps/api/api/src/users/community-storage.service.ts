import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

@Injectable()
export class CommunityStorageService {
  private readonly conversions = new Map<string, Promise<string>>();
  private config() {
    const endpoint = process.env.COMMUNITY_S3_ENDPOINT;
    const bucket = process.env.COMMUNITY_S3_BUCKET;
    const region = process.env.COMMUNITY_S3_REGION;
    const accessKey = process.env.COMMUNITY_S3_ACCESS_KEY_ID;
    const secretKey = process.env.COMMUNITY_S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !region || !accessKey || !secretKey) throw new InternalServerErrorException('Media storage sozlanmagan');
    return { endpoint: endpoint.replace(/\/$/, ''), bucket, region, accessKey, secretKey };
  }
  private encode(value: string) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  }
  private hmac(key: Buffer | string, value: string) { return createHmac('sha256', key).update(value).digest(); }
  createKey(userId: string, extension: string) { return `community/${userId}/${randomUUID()}.${extension}`; }
  sign(method: 'GET' | 'PUT' | 'HEAD' | 'DELETE', key: string, expiresSeconds = 900) {
    const { endpoint, bucket, region, accessKey, secretKey } = this.config();
    const base = new URL(endpoint);
    const canonicalUri = `${base.pathname.replace(/\/$/, '')}/${key.split('/').map((part) => this.encode(part)).join('/')}`;
    const host = `${bucket}.${base.host}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const params: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${accessKey}/${scope}`,
      'X-Amz-Date': amzDate, 'X-Amz-Expires': String(expiresSeconds), 'X-Amz-SignedHeaders': 'host',
    };
    const canonicalQuery = Object.keys(params).sort().map((name) => `${this.encode(name)}=${this.encode(params[name])}`).join('&');
    const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const kDate = this.hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = this.hmac(kDate, region);
    const kService = this.hmac(kRegion, 's3');
    const kSigning = this.hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    return `${base.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
  async delete(mediaKey: string) {
    if (!/^community\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}(?:\.playable)?\.(?:jpg|png|webp|mp4|mov|webm|pdf|doc|docx|m4a)$/i.test(mediaKey)) {
      throw new BadRequestException('Media fayl kaliti noto‘g‘ri');
    }
    const response = await fetch(this.sign('DELETE', mediaKey, 300), { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new InternalServerErrorException('O‘chirilgan media faylni saqlash joyidan bekor qilib bo‘lmadi');
    }
    return { deleted: response.status !== 404 };
  }

  async verify(userId: string, mediaKey: string, contentType: string, expectedSize: number) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'audio/mp4': 'm4a', 'audio/webm': 'webm' };
    const extension = extensions[contentType];
    const prefix = `community/${userId}/`;
    if (!extension || !mediaKey.startsWith(prefix) || !new RegExp(`^[a-f0-9-]{36}\\.${extension}$`, 'i').test(mediaKey.slice(prefix.length))) {
      throw new BadRequestException('Media fayl egasi yoki turi noto‘g‘ri');
    }
    const maxBytes = contentType.startsWith('video/') ? 30 * 1024 * 1024 : contentType.startsWith('application/') ? 15 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > maxBytes) {
      throw new BadRequestException('Media fayl hajmi noto‘g‘ri');
    }
    const response = await fetch(this.sign('HEAD', mediaKey, 300), { method: 'HEAD' });
    if (!response.ok) throw new BadRequestException('Server faylni to‘liq qabul qilmagan. Qayta yuklang.');
    const actualSize = Number(response.headers.get('content-length'));
    const actualType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!Number.isSafeInteger(actualSize) || actualSize !== expectedSize) {
      throw new BadRequestException('Yuklangan fayl hajmi asl faylga mos emas. Qayta yuklang.');
    }
    if (actualType && actualType !== contentType.toLowerCase()) {
      throw new BadRequestException('Yuklangan fayl formati asl faylga mos emas. Qayta yuklang.');
    }
    if (contentType.startsWith('video/')) {
      const playbackMediaKey = await this.ensureCompatibleVideo(userId, mediaKey);
      return { verified: true, size: actualSize, mediaType: contentType, playbackMediaKey, playbackMediaType: 'video/mp4' };
    }
    return { verified: true, size: actualSize, mediaType: contentType };
  }

  async ensureCompatibleVideo(userId: string, sourceKey: string): Promise<string> {
    if (sourceKey.endsWith('.playable.mp4')) return sourceKey;
    const conversionKey = `${userId}:${sourceKey}`;
    const pending = this.conversions.get(conversionKey);
    if (pending) return pending;
    const conversion = this.createCompatibleVideo(userId, sourceKey).finally(() => this.conversions.delete(conversionKey));
    this.conversions.set(conversionKey, conversion);
    return conversion;
  }

  private async createCompatibleVideo(userId: string, sourceKey: string): Promise<string> {
    const playbackKey = sourceKey.replace(/\.[^.]+$/, '.playable.mp4');
    const existing = await fetch(this.sign('HEAD', playbackKey, 300), { method: 'HEAD' }).catch(() => null);
    if (existing?.ok && Number(existing.headers.get('content-length')) > 0) return playbackKey;

    const ffmpegBinary = ffmpegPath;
    if (!ffmpegBinary) throw new InternalServerErrorException('Video formatini moslashtirish xizmati mavjud emas');
    const sourceResponse = await fetch(this.sign('GET', sourceKey, 600));
    if (!sourceResponse.ok) throw new InternalServerErrorException('Asl video faylni saqlash joyidan o‘qib bo‘lmadi');
    const source = Buffer.from(await sourceResponse.arrayBuffer());
    if (!source.length || source.length > 30 * 1024 * 1024) throw new BadRequestException('Asl video fayl hajmi noto‘g‘ri');

    const directory = await mkdtemp(join(tmpdir(), 'zelqen-video-'));
    const inputPath = join(directory, 'source-video');
    const outputPath = join(directory, 'playable.mp4');
    try {
      await writeFile(inputPath, source);
      await new Promise<void>((resolve, reject) => {
        const child = spawn(ffmpegBinary, [
          '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
          '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
          '-vf', "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
          '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
          '-movflags', '+faststart', '-max_muxing_queue_size', '1024', outputPath,
        ], { stdio: 'ignore' });
        const timeout = setTimeout(() => child.kill('SIGKILL'), 120_000);
        child.once('error', (error: Error) => { clearTimeout(timeout); reject(error); });
        child.once('close', (code: number | null) => {
          clearTimeout(timeout);
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg video conversion failed (exit ${code})`));
        });
      });
      const playable = await readFile(outputPath);
      if (!playable.length || playable.length > 120 * 1024 * 1024) throw new BadRequestException('Moslashtirilgan video hajmi ruxsat etilgan chegaradan oshdi');
      const response = await fetch(this.sign('PUT', playbackKey, 600), {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=31536000, immutable' },
        body: new Uint8Array(playable),
      });
      if (!response.ok) throw new InternalServerErrorException('Moslashtirilgan videoni saqlab bo‘lmadi');
      return playbackKey;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
      throw new BadRequestException('Bu video formati ochilmadi. MP4, H.264 formatidagi videoni tanlang.');
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async fetchVideoStream(mediaKey: string, range?: string) {
    const headers: Record<string, string> = {};
    if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
    const response = await fetch(this.sign('GET', mediaKey, 600), { headers });
    if (!response.ok && response.status !== 206) {
      throw new InternalServerErrorException('Video oqimini saqlash joyidan olib bo‘lmadi');
    }
    return {
      status: response.status,
      body: response.body,
      contentType: response.headers.get('content-type') || 'video/mp4',
      contentLength: response.headers.get('content-length'),
      contentRange: response.headers.get('content-range'),
      acceptRanges: response.headers.get('accept-ranges') || 'bytes',
    };
  }

  async upload(userId: string, fileName: string, contentType: string, buffer: Buffer) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'audio/mp4': 'm4a', 'audio/webm': 'webm' };
    const extension = extensions[contentType];
    if (!extension || !new RegExp(`^[a-f0-9-]{36}\\.${extension}$`, 'i').test(fileName)) throw new BadRequestException('Media fayl turi yoki nomi noto‘g‘ri');
    const maxBytes = contentType.startsWith('video/') ? 30 * 1024 * 1024 : (contentType.startsWith('application/') ? 15 * 1024 * 1024 : 8 * 1024 * 1024);
    if (!buffer?.length || buffer.length > maxBytes) throw new BadRequestException(contentType.startsWith('video/') ? 'Video hajmi 30 MB dan oshmasin' : contentType.startsWith('application/') ? 'Hujjat hajmi 15 MB dan oshmasin' : contentType.startsWith('audio/') ? 'Ovozli xabar hajmi 8 MB dan oshmasin' : 'Rasm hajmi 8 MB dan oshmasin');
    const key = `community/${userId}/${fileName}`;
    const response = await fetch(this.sign('PUT', key, 600), { method: 'PUT', headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' }, body: new Uint8Array(buffer) });
    if (!response.ok) throw new InternalServerErrorException('Media faylni saqlashda xatolik yuz berdi');
    return { mediaKey: key, mediaType: contentType };
  }
}
