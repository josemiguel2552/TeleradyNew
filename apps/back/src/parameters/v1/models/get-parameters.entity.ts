import { ApiProperty } from "@nestjs/swagger";
import { Base } from "../../../common/models/Base.model";

export class GetParameter {
    @ApiProperty()
    id: number;
    @ApiProperty()
    name: string;
}

export class GetParameterResponse extends Base {
    @ApiProperty({ type: GetParameter, isArray:true })
    response: GetParameter[];
}