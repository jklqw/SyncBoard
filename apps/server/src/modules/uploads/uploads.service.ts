import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import DOMPurify from 'isomorphic-dompurify';
import sharp from 'sharp';
import { ENV, type Env } from '../../common/config/env.schema';
import { IMAGE_MAX_DIMENSION, UPLOAD_MAX_BYTES } from '../../common/constants/limits';

export type ImageKind = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg';

export interface StoredImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

const EXTENSION: Record<ImageKind, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  gif: 'gif',
  svg: 'svg',
};

const CONTENT_TYPE: Record<ImageKind, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Magic-byte sniffing — client-supplied MIME types and extensions are never
 * trusted. SVG is detected textually and sanitized separately.
 */
export function sniffImageKind(buffer: Buffer): ImageKind | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return 'gif';

  const head = buffer.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!DOCTYPE svg')) {
    return 'svg';
  }
  return null;
}

function sanitizeSvg(buffer: Buffer): string {
  const dirty = buffer.toString('utf8');
  const clean = DOMPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'href', 'xlink:href'],
  });
  if (!clean.includes('<svg')) {
    throw new BadRequestException('SVG payload did not survive sanitization');
  }
  return clean;
}

@Injectable()
export class UploadsService {
  private readonly s3: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    const useSsl = env.MINIO_USE_SSL;
    this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: `${useSsl ? 'https' : 'http'}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY,
        secretAccessKey: env.MINIO_SECRET_KEY,
      },
    });
  }

  /**
   * Validate magic bytes, re-encode rasters through sharp (strips EXIF/GPS and
   * neutralizes polyglot payloads), sanitize SVGs, then store in object storage.
   */
  async store(boardId: string, file: { buffer: Buffer; size: number }): Promise<StoredImage> {
    if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES) {
      throw new PayloadTooLargeException(`Images must be between 1 byte and ${UPLOAD_MAX_BYTES} bytes`);
    }

    const kind = sniffImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException('Unsupported image format — use PNG, JPEG, WebP, GIF, or SVG');
    }

    const id = randomUUID();
    const key = `boards/${boardId}/${id}.${EXTENSION[kind]}`;
    let body: Buffer | string = file.buffer;
    let width = 0;
    let height = 0;

    if (kind === 'svg') {
      body = sanitizeSvg(file.buffer);
      const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(body)?.[1];
      const dims = viewBox?.trim().split(/[\s,]+/).map(Number);
      width = dims?.[2] ?? 0;
      height = dims?.[3] ?? 0;
    } else if (kind === 'gif') {
      // sharp only decodes the first GIF frame; pass animated GIFs through
      // unchanged after magic-byte verification.
      const meta = await sharp(file.buffer, { animated: false }).metadata().catch(() => null);
      width = meta?.width ?? 0;
      height = meta?.height ?? 0;
    } else {
      let pipeline = sharp(file.buffer, {
        limitInputPixels: IMAGE_MAX_DIMENSION * IMAGE_MAX_DIMENSION,
      }).rotate();
      const meta = await pipeline.metadata();
      if (!meta.width || !meta.height) {
        throw new BadRequestException('Could not decode image dimensions');
      }
      if (meta.width > IMAGE_MAX_DIMENSION || meta.height > IMAGE_MAX_DIMENSION) {
        throw new BadRequestException(
          `Image dimensions must not exceed ${IMAGE_MAX_DIMENSION}px`,
        );
      }
      width = meta.width;
      height = meta.height;
      pipeline =
        kind === 'png'
          ? pipeline.png({ compressionLevel: 9 })
          : kind === 'jpeg'
            ? pipeline.jpeg({ quality: 90, mozjpeg: true })
            : pipeline.webp({ quality: 90 });
      body = await pipeline.toBuffer();
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.env.MINIO_BUCKET,
        Key: key,
        Body: body,
        ContentType: CONTENT_TYPE[kind],
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      id,
      url: `${this.env.MINIO_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
      width,
      height,
    };
  }
}
