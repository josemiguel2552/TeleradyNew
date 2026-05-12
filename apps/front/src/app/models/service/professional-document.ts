export interface UploadDocumentPayload {
    fileName: string;
    fileBase64: string;
    documentTypeId: number;
}

export interface UploadDocumentResult {
    driveId: string;
}

export interface DocumentType {
    documentTypeId: number;
    driveId: string
}
