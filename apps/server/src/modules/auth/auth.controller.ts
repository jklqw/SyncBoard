import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { requireUser } from '../../common/types';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { toPublicUser } from './public-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @RateLimit({ keyPrefix: 'auth:register', limit: 5, windowMs: 60_000 })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.register(dto, req, res);
  }

  @Post('login')
  @RateLimit({
    keyPrefix: 'auth:login',
    limit: 5,
    windowMs: 60_000,
    keyFromBody: 'identifier',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, req, res);
  }

  @Post('refresh')
  @UseGuards(CsrfGuard)
  @RateLimit({ keyPrefix: 'auth:refresh', limit: 30, windowMs: 60_000 })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refresh(req, res);
  }

  @Post('logout')
  @UseGuards(CsrfGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return toPublicUser(requireUser(req));
  }
}
