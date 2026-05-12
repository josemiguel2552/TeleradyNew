import { Injectable } from '@nestjs/common';
import { drive_v3, google } from 'googleapis';
import { AuthGoogleService } from './auth-google/auth-google.service';
import { Readable } from 'stream';
import { FileBh, FileResDrive, Folders } from './models/drive.model';

@Injectable()
export class DriveService {
    drive: drive_v3.Drive;

    constructor(private readonly authGoogleService: AuthGoogleService) {
        const auth = this.authGoogleService.getClient();
        this.drive = google.drive({ version: 'v3', auth });
    }

    async saveFile(file: FileBh, folderId: string): Promise<FileResDrive> {
        const responseFiles = await this.drive.files.list({
            q: `name='${file.name}' and '${folderId}' in parents and trashed=false`,
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
        else {
            const fileMetadata = {
                name: file.name,
                parents: [folderId]
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
            return { id: response.data.id ?? '', link: response.data.webViewLink ?? '', };
        }
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

    async getFileByName(name: string, folderId: string, inBase64: boolean = false): Promise<string | Buffer | null> {
        const responseFiles = await this.drive.files.list({
            q: `name='${name}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        if (responseFiles.data.files && responseFiles.data.files.length > 0) {
            const fileId = responseFiles.data.files[0].id ?? '';
            const file: Buffer = await this.getFileAsBuffer(fileId);
            return inBase64 ? file.toString('base64') : file;
        }
        else {
            return null;
        }
    }

    private async getFileAsBuffer(idFile: string): Promise<Buffer> {
        const response = await this.drive.files.get({
            fileId: idFile,
            alt: 'media'
        }, { responseType: 'stream' });

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
        const folderNames = Object.values(namesFolder)

        for (const name of folderNames) {
            idFolder = await this.getIdFolder(name, idFolder);
        }

        return idFolder;
    }

    async getIdFolder(folderName: string, idParentFolder: string): Promise<string> {
        const response = await this.drive.files.list({
            q: `name='${folderName}' and '${idParentFolder}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id ?? '';
        } else {
            return this.createFolder(folderName, idParentFolder);
        }
    }

    private async createFolder(folderName: string, idParentFolder: string): Promise<string> {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [idParentFolder]
        };
        const folder = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id'
        });
        return folder.data.id ?? '';
    }

    async deleteFileIfExists(baseName: string, folderId: string): Promise<void> {
        const files = await this.listFilesInFolder(folderId);
        const match = files.find(file => file.name.startsWith(baseName));
        if (match) {
          await this.deleteFile(match.id);
        }
    }
    
    async listFilesInFolder(folderId: string): Promise<{ id: string; name: string }[]> {
        const response = await this.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          spaces: 'drive',
          fields: 'files(id, name)',
        });
        return response.data.files?.map(f => ({ id: f.id!, name: f.name! })) || [];
    }
    
    async deleteFile(fileId: string): Promise<void> {
        await this.drive.files.delete({ fileId });
    }     
}
