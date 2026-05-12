import { UploadDocument } from "../models/upload-document.dto";

export class UploadDocumentCommand {
  constructor(public readonly data: UploadDocument) {}
}
