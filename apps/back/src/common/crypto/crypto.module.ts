import { Global, Module } from '@nestjs/common';
import { AesGcmService } from './aes-gcm.service';
import { Argon2Service } from './argon2.service';
import { HashChainService } from './hash-chain.service';
import { PseudonymService } from './pseudonym.service';

@Global()
@Module({
  providers: [AesGcmService, Argon2Service, HashChainService, PseudonymService],
  exports: [AesGcmService, Argon2Service, HashChainService, PseudonymService],
})
export class CryptoModule {}
