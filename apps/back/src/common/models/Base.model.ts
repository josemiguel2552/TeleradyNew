import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Base {
    @ApiProperty()
    ok: boolean;
    @ApiProperty()
    message: string;
    @ApiPropertyOptional()
    showMessagePlan?: boolean;
}