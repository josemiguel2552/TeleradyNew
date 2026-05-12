import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Seconds until the access token expires.' })
  expiresIn!: number;

  @ApiProperty({ type: () => UserSummaryDto })
  user!: UserSummaryDto;
}

export class UserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  hospitals!: string[];

  @ApiProperty({ required: false, nullable: true })
  professionalId!: string | null;

  @ApiProperty()
  mfaEnabled!: boolean;
}

export class RegisterHospitalResponseDto {
  @ApiProperty()
  hospitalId!: string;

  @ApiProperty()
  adminUserId!: string;
}
