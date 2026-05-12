import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

/**
 * Adapter around google-auth-library's JWT client.
 *
 * Legacy integration with Google Drive — to be retired in Sprint 2 once
 * documents migrate to S3-compatible storage.
 */
@Injectable()
export class AuthGoogleService {
  private readonly jwtClient: JWT;

  constructor(config: ConfigService) {
    const clientEmail = config.get<string>('GOOGLE_CLIENT_EMAIL');
    const privateKeyRaw = config.get<string>('GOOGLE_PRIVATE_KEY');

    if (!clientEmail || !privateKeyRaw) {
      throw new Error(
        'GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set to use the Drive integration.',
      );
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    this.jwtClient = new google.auth.JWT(clientEmail, undefined, privateKey, [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
  }

  getClient(): JWT {
    return this.jwtClient;
  }
}
