import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class AesGcmService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    const hex = config.getOrThrow<string>('ENCRYPTION_MASTER_KEY');
    const key = Buffer.from(hex, 'hex');
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `ENCRYPTION_MASTER_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars)`,
      );
    }
    this.masterKey = key;
  }

  encrypt(plaintext: string | Buffer, aad?: string): EncryptedPayload {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.masterKey, iv) as CipherGCM;
    if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
    const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload, aad?: string): Buffer {
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    if (iv.length !== IV_BYTES) throw new Error('Invalid IV length');
    if (tag.length !== TAG_BYTES) throw new Error('Invalid auth tag length');

    const decipher = createDecipheriv(ALGO, this.masterKey, iv) as DecipherGCM;
    decipher.setAuthTag(tag);
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  decryptString(payload: EncryptedPayload, aad?: string): string {
    return this.decrypt(payload, aad).toString('utf8');
  }

  pack(payload: EncryptedPayload): string {
    return `gcm:v1:${payload.iv}:${payload.tag}:${payload.ciphertext}`;
  }

  unpack(packed: string): EncryptedPayload {
    const parts = packed.split(':');
    if (parts.length !== 5 || parts[0] !== 'gcm' || parts[1] !== 'v1') {
      throw new Error('Invalid packed ciphertext');
    }
    return { iv: parts[2], tag: parts[3], ciphertext: parts[4] };
  }
}
