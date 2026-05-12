import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Base } from "../../../common/models/Base.model";

export class SaveProfessional {
    @ApiProperty()
    id: string;
}

export class SaveProfessionalResponse extends Base {
    @ApiPropertyOptional({ type: SaveProfessional })
    response?: SaveProfessional;
}