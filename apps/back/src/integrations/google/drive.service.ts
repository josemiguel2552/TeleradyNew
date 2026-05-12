import { Injectable } from '@nestjs/common';
import { drive_v3, google } from 'googleapis';
import { Readable } from 'stream';
import { AuthGoogleService } from './auth-google/auth-google.service';
import type { FileBh, FileResDrive, Folders } from './models/drive.model';

/**
 * Thin wrapper around Google Drive v3.
 *
 * Legacy adapter — to be retired in Sprint 2 once documents move to MinIO/S3.
 * Until then, every user-controlled value that enters Drive's `q` query is
 * escaped via `escapeDriveLiteral` to prevent search injection.
 */
@Injectable()
export class DriveService {
  drive: drive_v3.Drive;

  constructor(private readonly authGoogleService: AuthGoogleService) {
    const auth = this.authGoogleService.getClient();
    this.drive = google.drive({ version: 'v3', auth });
  }

  async saveFile(file: FileBh, folderId: string): Promise<FileResDrive> {
    const responseFiles = await this.drive.files.list({
      q: `name=${escapeDriveLiteral(file.name)} and ${escapeDriveLiteral(folderId)} in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, webViewLink)',
    });

    if (responseFiles.data.files && responseFiles.data.files.length > 0) {
      const fileId = responseFiles.data.files[0].id ?? undefined;
      const fileLink = responseFiles.data.files[0].webViewLink ?? undefined;
      await this.drive.files.update({
        fileId: fileId,
        media: {
          mimeType: file.mimeType,
          body: this.bufferToStream(file.data),
        },
      });
      return { id: fileId ?? '', link: fileLink ?? '' };
    }

    const fileMetadata = {
      name: file.name,
      parents: [folderId],
    };
    const media = {
      mimeType: file.mimeType,
      body: this.bufferToStream(file.data),
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });
    return { id: response.data.id ?? '', link: response.data.webViewLink ?? '' };
  }

  private bufferToStream(buffer: Buffer): Readable {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  async getFileById(idFile: string, inBase64: boolean = false): Promise<string | Buffer | null> {
    const file: Buffer = await this.getFileAsBuffer(idFile);
    return inBase64 ? file.toString('base64') : file;
  }

  async getFileByName(
    name: string,
    folderId: string,
    inBase64: boolean = false,
  ): Promise<string | Buffer | null> {
    const responseFiles = await this.drive.files.list({
      q: `name=${escapeDriveLiteral(name)} and ${escapeDriveLiteral(folderId)} in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    if (responseFiles.data.files && responseFiles.data.files.length > 0) {
      const fileId = responseFiles.data.files[0].id ?? '';
      const file: Buffer = await this.getFileAsBuffer(fileId);
      return inBase64 ? file.toString('base64') : file;
    }
    return null;
  }

  private async getFileAsBuffer(idFile: string): Promise<Buffer> {
    const response = await this.drive.files.get(
      {
        fileId: idFile,
        alt: 'media',
      },
      { responseType: 'stream' },
    );

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      response.data
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
  }

  async getIdFolderLast(namesFolder: Folders, idParentFolder: string): Promise<string> {
    let idFolder = idParentFolder;
    const folderNames = Object.values(namesFolder);

    for (const name of folderNames) {
      idFolder = await this.getIdFolder(name, idFolder);
    }

    return idFolder;
  }

  async getIdFolder(folderName: string, idParentFolder: string): Promise<string> {
    const response = await this.drive.files.list({
      q: `name=${escapeDriveLiteral(folderName)} and ${escapeDriveLiteral(idParentFolder)} in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id ?? '';
    }
    return this.createFolder(folderName, idParentFolder);
  }

  private async createFolder(folderName: string, idParentFolder: string): Promise<string> {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [idParentFolder],
    };
    const folder = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    return folder.data.id ?? '';
  }

  async deleteFileIfExists(baseName: string, folderId: string): Promise<void> {
    const files = await this.listFilesInFolder(folderId);
    const match = files.find((file) => file.name.startsWith(baseName));
    if (match) {
      await this.deleteFile(match.id);
    }
  }

  async listFilesInFolder(folderId: string): Promise<{ id: string; name: string }[]> {
    const response = await this.drive.files.list({
      q: `${escapeDriveLiteral(folderId)} in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });
    return response.data.files?.map((f) => ({ id: f.id!, name: f.name! })) || [];
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
  }
}

/**
 * Escapes a user-controlled value for use in a Drive `q` string literal.
 *
 * Drive accepts strings wrapped in single quotes, with `\` and `'` escaped
 * by a leading backslash. We additionally strip embedded NULs that would
 * confuse the parser.
 */
export function escapeDriveLiteral(value: string): string {
  const safe = String(value).replace(/\0/g, '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${safe}'`;
}
