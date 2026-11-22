import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class InviteMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  username?: string;

  @IsEnum(Role, { message: 'role must be a valid board role' })
  role!: Role;
}

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role!: Role;
}

export class ShareLinkDto {
  @IsIn([Role.VIEWER, Role.COMMENTER, Role.EDITOR], {
    message: 'role must be VIEWER, COMMENTER, or EDITOR',
  })
  role!: Role;
}
