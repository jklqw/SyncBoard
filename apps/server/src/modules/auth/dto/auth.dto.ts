import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/, {
    message: 'Username must be 3-32 characters: letters, numbers or underscore',
  })
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
