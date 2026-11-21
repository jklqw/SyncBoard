import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { RequireBoardRole } from '../../common/decorators/require-board-role.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { BoardRoleGuard } from '../../common/guards/board-role.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UPLOAD_MAX_BYTES } from '../../common/constants/limits';
import { UploadsService } from './uploads.service';

@Controller('boards')
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post(':boardId/uploads')
  @RequireBoardRole(Role.EDITOR)
  @RateLimit({ keyPrefix: 'uploads', limit: 30, windowMs: 60_000 })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
    }),
  )
  upload(
    @Param('boardId') boardId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Missing file — send multipart field "file"');
    }
    return this.uploads.store(boardId, { buffer: file.buffer, size: file.size });
  }
}
