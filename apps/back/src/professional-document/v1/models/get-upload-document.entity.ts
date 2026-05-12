import { ApiProperty } from "@nestjs/swagger";
import { Base } from "../../../common/models/Base.model";

export class UploadedDocument {
  @ApiProperty()
  documentTypeId: number;
  @ApiProperty()
  driveId: string;
}

export class GetUploadedDocumentsResponse extends Base {
  @ApiProperty({ type: [UploadedDocument] })
  response: UploadedDocument[]; 
}
