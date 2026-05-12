import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { decryptDataKey } from '../../../common/utils/crypto/crypto.util';

@Injectable()
export class AuthGoogleService {
    private readonly jwtClient: JWT;

    constructor() {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;

        if (!clientEmail || !privateKey) {
            throw new Error('Google client email or private key is not defined in environment variables.');
        }

        this.jwtClient = new google.auth.JWT(
            clientEmail,
            undefined,
            decryptDataKey(privateKey).replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
        );
    }

    getClient(): JWT {
        return this.jwtClient;
    }
}
