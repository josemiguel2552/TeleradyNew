import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Base } from "../../../common/models/Base.model";

export class UploadDocumentResult {
    @ApiProperty()
    driveId: string;
}

export class UploadDocumentResponse extends Base {
    @ApiPropertyOptional({ type: UploadDocumentResult })
    response?: UploadDocumentResult;
}