import { ApiProperty } from "@nestjs/swagger";
import { Base } from "../../../common/models/Base.model";

export class Validate {
    @ApiProperty()
    exists: boolean
}

export class ValidateResponse extends Base {
    @ApiProperty({ type: Validate })
    response: Validate;
}