import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';

@Injectable()
export class CommunityStorageService {
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
  sign(method: 'GET' | 'PUT' | 'HEAD', key: string, expiresSeconds = 900) {
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
  async verify(userId: string, mediaKey: string, contentType: string, expectedSize: number) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
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
    return { verified: true, size: actualSize, mediaType: contentType };
  }

  async upload(userId: string, fileName: string, contentType: string, buffer: Buffer) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
    const extension = extensions[contentType];
    if (!extension || !new RegExp(`^[a-f0-9-]{36}\\.${extension}$`, 'i').test(fileName)) throw new BadRequestException('Media fayl turi yoki nomi noto‘g‘ri');
    const maxBytes = contentType.startsWith('video/') ? 30 * 1024 * 1024 : (contentType.startsWith('application/') ? 15 * 1024 * 1024 : 8 * 1024 * 1024);
    if (!buffer?.length || buffer.length > maxBytes) throw new BadRequestException(contentType.startsWith('video/') ? 'Video hajmi 30 MB dan oshmasin' : contentType.startsWith('application/') ? 'Hujjat hajmi 15 MB dan oshmasin' : 'Rasm hajmi 8 MB dan oshmasin');
    const key = `community/${userId}/${fileName}`;
    const response = await fetch(this.sign('PUT', key, 600), { method: 'PUT', headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' }, body: new Uint8Array(buffer) });
    if (!response.ok) throw new InternalServerErrorException('Media faylni saqlashda xatolik yuz berdi');
    return { mediaKey: key, mediaType: contentType };
  }
}
