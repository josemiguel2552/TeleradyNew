import { Test, TestingModule } from '@nestjs/testing';
import { DriveService, escapeDriveLiteral } from './drive.service';
import { google } from 'googleapis';
import { AuthGoogleService } from './auth-google/auth-google.service';
import { Readable } from 'stream';

describe('escapeDriveLiteral', () => {
  it('wraps benign strings in single quotes', () => {
    expect(escapeDriveLiteral('hello')).toBe("'hello'");
  });

  it('escapes embedded single quotes', () => {
    expect(escapeDriveLiteral("O'Brien")).toBe("'O\\'Brien'");
  });

  it('escapes backslashes', () => {
    expect(escapeDriveLiteral('foo\\bar')).toBe("'foo\\\\bar'");
  });

  it('neutralises attempts to break out of the literal', () => {
    const injected = `bad' and 'a'='a`;
    const escaped = escapeDriveLiteral(injected);
    expect(escaped).toBe("'bad\\' and \\'a\\'=\\'a'");
  });
});

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn().mockReturnValue({
      files: {
        list: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
      },
    }),
  },
}));

describe('DriveService', () => {
  let service: DriveService;
  let mockDriveFiles: any;
  let authGoogleServiceMock: Partial<AuthGoogleService>;

  beforeEach(async () => {
    authGoogleServiceMock = {
      getClient: jest.fn(),
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [DriveService, { provide: AuthGoogleService, useValue: authGoogleServiceMock }],
    }).compile();

    service = module.get<DriveService>(DriveService);
    mockDriveFiles = google.drive({ version: 'v3' }).files;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveFile', () => {
    const mockFile = {
      name: 'test-file.txt',
      mimeType: 'text/plain',
      data: Buffer.from('test content'),
    };
    const mockFolderId = 'mock-folder-id';

    it('should update an existing file if it already exists in the folder', async () => {
      const mockFileId = 'existing-file-id';
      const mockFileLink = 'https://drive.google.com/file/d/existing-file-id/view';

      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [{ id: mockFileId, webViewLink: mockFileLink }],
        },
      });

      mockDriveFiles.update.mockResolvedValueOnce({});

      const result = await service.saveFile(mockFile, mockFolderId);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFile.name}' and '${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, webViewLink)',
      });
      expect(mockDriveFiles.update).toHaveBeenCalledWith({
        fileId: mockFileId,
        media: {
          mimeType: mockFile.mimeType,
          body: expect.anything(),
        },
      });
      expect(result).toEqual({ id: mockFileId, link: mockFileLink });
    });

    it('should create a new file if it does not exist in the folder', async () => {
      const mockNewFileId = 'new-file-id';
      const mockNewFileLink = 'https://drive.google.com/file/d/new-file-id/view';

      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [],
        },
      });

      mockDriveFiles.create.mockResolvedValueOnce({
        data: {
          id: mockNewFileId,
          webViewLink: mockNewFileLink,
        },
      });

      const result = await service.saveFile(mockFile, mockFolderId);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFile.name}' and '${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, webViewLink)',
      });
      expect(mockDriveFiles.create).toHaveBeenCalledWith({
        requestBody: {
          name: mockFile.name,
          parents: [mockFolderId],
        },
        media: {
          mimeType: mockFile.mimeType,
          body: expect.anything(),
        },
        fields: 'id, webViewLink',
      });
      expect(result).toEqual({ id: mockNewFileId, link: mockNewFileLink });
    });
  });

  describe('getFileById', () => {
    const mockFileId = 'mock-file-id';
    const mockFileBuffer = Buffer.from('mock file content');

    it('should return the file as a Buffer if inBase64 is false', async () => {
      const mockStream = new Readable();
      mockStream.push(mockFileBuffer);
      mockStream.push(null); // Indica el final del flujo

      mockDriveFiles.get.mockResolvedValueOnce({
        data: mockStream,
      });

      const result = await service.getFileById(mockFileId, false);

      expect(mockDriveFiles.get).toHaveBeenCalledWith(
        { fileId: mockFileId, alt: 'media' },
        { responseType: 'stream' }
      );
      expect(result).toEqual(mockFileBuffer);
    });

    it('should return the file as a Base64 string if inBase64 is true', async () => {
      const mockStream = new Readable();
      mockStream.push(mockFileBuffer);
      mockStream.push(null);

      mockDriveFiles.get.mockResolvedValueOnce({
        data: mockStream,
      });

      const result = await service.getFileById(mockFileId, true);

      expect(mockDriveFiles.get).toHaveBeenCalledWith(
        { fileId: mockFileId, alt: 'media' },
        { responseType: 'stream' }
      );
      expect(result).toEqual(mockFileBuffer.toString('base64'));
    });
  });

  describe('getFileByName', () => {
    const mockFileName = 'test-file.txt';
    const mockFolderId = 'mock-folder-id';
    const mockFileId = 'mock-file-id';
    const mockFileBuffer = Buffer.from('mock file content');

    it('should return the file as a Buffer if inBase64 is false', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [{ id: mockFileId, name: mockFileName }],
        },
      });

      jest.spyOn(service as any, 'getFileAsBuffer').mockResolvedValueOnce(mockFileBuffer);

      const result = await service.getFileByName(mockFileName, mockFolderId, false);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFileName}' and '${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      expect(result).toEqual(mockFileBuffer);
    });

    it('should return the file as a Base64 string if inBase64 is true', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [{ id: mockFileId, name: mockFileName }],
        },
      });

      jest.spyOn(service as any, 'getFileAsBuffer').mockResolvedValueOnce(mockFileBuffer);

      const result = await service.getFileByName(mockFileName, mockFolderId, true);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFileName}' and '${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      expect(result).toEqual(mockFileBuffer.toString('base64'));
    });

    it('should return null if the file does not exist', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [],
        },
      });

      const result = await service.getFileByName(mockFileName, mockFolderId, false);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFileName}' and '${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      expect(result).toBeNull();
    });
  });

  describe('getIdFolderLast', () => {
    const mockFolders = { folder1: 'Folder A', folder2: 'Folder B' };
    const mockParentFolderId = 'parent-folder-id';
    const mockFolderIdA = 'folder-id-a';
    const mockFolderIdB = 'folder-id-b';

    it('should return the ID of the last folder in the hierarchy', async () => {
      jest.spyOn(service, 'getIdFolder').mockResolvedValueOnce(mockFolderIdA);
      jest.spyOn(service, 'getIdFolder').mockResolvedValueOnce(mockFolderIdB);

      const result = await service.getIdFolderLast(mockFolders, mockParentFolderId);

      expect(service.getIdFolder).toHaveBeenCalledTimes(2);
      expect(service.getIdFolder).toHaveBeenCalledWith('Folder A', mockParentFolderId);
      expect(service.getIdFolder).toHaveBeenCalledWith('Folder B', mockFolderIdA);
      expect(result).toBe(mockFolderIdB);
    });

    it('should throw an error if getIdFolder fails', async () => {
      jest.spyOn(service, 'getIdFolder').mockRejectedValueOnce(new Error('Folder not found'));

      await expect(service.getIdFolderLast(mockFolders, mockParentFolderId)).rejects.toThrow('Folder not found');
      expect(service.getIdFolder).toHaveBeenCalledWith('Folder A', mockParentFolderId);
    });
  });

  describe('getIdFolder', () => {
    const mockFolderName = 'Test Folder';
    const mockParentFolderId = 'parent-folder-id';
    const mockFolderId = 'folder-id';

    it('should return the folder ID if the folder exists', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [{ id: mockFolderId, name: mockFolderName }],
        },
      });

      const result = await service.getIdFolder(mockFolderName, mockParentFolderId);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFolderName}' and '${mockParentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });
      expect(result).toBe(mockFolderId);
    });

    it('should create the folder and return its ID if the folder does not exist', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [],
        },
      });

      mockDriveFiles.create.mockResolvedValueOnce({
        data: {
          id: mockFolderId,
        },
      });

      const result = await service.getIdFolder(mockFolderName, mockParentFolderId);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFolderName}' and '${mockParentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      expect(mockDriveFiles.create).toHaveBeenCalledWith({
        requestBody: {
          name: mockFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mockParentFolderId],
        },
        fields: 'id',
      });

      expect(result).toBe(mockFolderId);
    });

    it('should throw an error if folder creation fails', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [],
        },
      });

      mockDriveFiles.create.mockRejectedValueOnce(new Error('Failed to create folder'));

      await expect(service.getIdFolder(mockFolderName, mockParentFolderId)).rejects.toThrow('Failed to create folder');

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `name='${mockFolderName}' and '${mockParentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      expect(mockDriveFiles.create).toHaveBeenCalledWith({
        requestBody: {
          name: mockFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mockParentFolderId],
        },
        fields: 'id',
      });
    });
  });

  describe('deleteFileIfExists', () => {
    const mockFolderId = 'mock-folder-id';
    const mockBaseName = 'test-file';
    const mockFileId = 'mock-file-id';

    it('should delete the file if it exists in the folder', async () => {
      const mockFiles = [
        { id: mockFileId, name: `${mockBaseName}-123.txt` },
        { id: 'another-file-id', name: 'unrelated-file.txt' },
      ];

      jest.spyOn(service, 'listFilesInFolder').mockResolvedValueOnce(mockFiles);
      jest.spyOn(service, 'deleteFile').mockResolvedValueOnce();

      await service.deleteFileIfExists(mockBaseName, mockFolderId);

      expect(service.listFilesInFolder).toHaveBeenCalledWith(mockFolderId);
      expect(service.deleteFile).toHaveBeenCalledWith(mockFileId);
    });

    it('should not delete any file if no matching file is found', async () => {
      const mockFiles = [
        { id: 'another-file-id', name: 'unrelated-file.txt' },
      ];

      jest.spyOn(service, 'listFilesInFolder').mockResolvedValueOnce(mockFiles);
      jest.spyOn(service, 'deleteFile').mockResolvedValueOnce();

      await service.deleteFileIfExists(mockBaseName, mockFolderId);

      expect(service.listFilesInFolder).toHaveBeenCalledWith(mockFolderId);
      expect(service.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle errors when listing files', async () => {
      jest.spyOn(service, 'listFilesInFolder').mockRejectedValueOnce(new Error('Failed to list files'));
      jest.spyOn(service, 'deleteFile').mockResolvedValueOnce();

      await expect(service.deleteFileIfExists(mockBaseName, mockFolderId)).rejects.toThrow('Failed to list files');

      expect(service.listFilesInFolder).toHaveBeenCalledWith(mockFolderId);
      expect(service.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle errors when deleting a file', async () => {
      const mockFiles = [
        { id: mockFileId, name: `${mockBaseName}-123.txt` },
      ];

      jest.spyOn(service, 'listFilesInFolder').mockResolvedValueOnce(mockFiles);
      jest.spyOn(service, 'deleteFile').mockRejectedValueOnce(new Error('Failed to delete file'));

      await expect(service.deleteFileIfExists(mockBaseName, mockFolderId)).rejects.toThrow('Failed to delete file');

      expect(service.listFilesInFolder).toHaveBeenCalledWith(mockFolderId);
      expect(service.deleteFile).toHaveBeenCalledWith(mockFileId);
    });
  });

  describe('listFilesInFolder', () => {
    const mockFolderId = 'mock-folder-id';
    const mockFiles = [
      { id: 'file-id-1', name: 'file1.txt' },
      { id: 'file-id-2', name: 'file2.txt' },
    ];

    it('should return a list of files in the folder', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: mockFiles,
        },
      });

      const result = await service.listFilesInFolder(mockFolderId);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `'${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });
      expect(result).toEqual(mockFiles);
    });

    it('should return an empty array if no files are found', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({
        data: {
          files: [],
        },
      });

      const result = await service.listFilesInFolder(mockFolderId);

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `'${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });
      expect(result).toEqual([]);
    });

    it('should handle errors when listing files', async () => {
      mockDriveFiles.list.mockRejectedValueOnce(new Error('Failed to list files'));

      await expect(service.listFilesInFolder(mockFolderId)).rejects.toThrow('Failed to list files');

      expect(mockDriveFiles.list).toHaveBeenCalledWith({
        q: `'${mockFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });
    });
  });

  describe('deleteFile', () => {
    const mockFileId = 'mock-file-id';

    it('should delete the file with the given ID', async () => {
      mockDriveFiles.delete.mockResolvedValueOnce({});

      await service.deleteFile(mockFileId);

      expect(mockDriveFiles.delete).toHaveBeenCalledWith({
        fileId: mockFileId,
      });
    });

    it('should handle errors when deleting a file', async () => {
      mockDriveFiles.delete.mockRejectedValueOnce(new Error('Failed to delete file'));

      await expect(service.deleteFile(mockFileId)).rejects.toThrow('Failed to delete file');

      expect(mockDriveFiles.delete).toHaveBeenCalledWith({
        fileId: mockFileId,
      });
    });
  });
});


