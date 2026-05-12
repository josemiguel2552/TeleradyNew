import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

// OWASP 2024 recommended argon2id parameters.
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 4,
};

@Injectable()
export class Argon2Service {
  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password, HASH_OPTIONS);
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, HASH_OPTIONS);
  }
}
