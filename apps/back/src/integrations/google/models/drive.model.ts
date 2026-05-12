export interface FileBh {
    data: Buffer;
    name: string;
    mimeType: string;
}

export interface Folders {
    [key: string]: string;
}

export interface FileResDrive {
    id: string;
    link: string;
}