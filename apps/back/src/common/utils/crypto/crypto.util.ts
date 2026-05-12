import * as CryptoJS from 'crypto-js';
import * as dotenv from "dotenv";

dotenv.config();

export function encryptData(data: any) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), process.env.SECRETKEY ?? '').toString();
}

export function decryptData(data: any) {
    const bytes = CryptoJS.AES.decrypt(data, process.env.SECRETKEY ?? '');
    if (bytes.toString()) {
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    }
    return data;
}

export function decryptDataKey(data: any) {
    const bytes = CryptoJS.AES.decrypt(data, process.env.SECRETKEY ?? '');
    if (bytes.toString()) {
        return bytes.toString(CryptoJS.enc.Utf8);
    }
    return data;
}