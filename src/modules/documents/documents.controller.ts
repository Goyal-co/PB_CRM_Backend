import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { DocType } from '@common/types/supabase.types';
import { DocumentsService } from './documents.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryDocumentsDto,
  ): Promise<unknown> {
    return this.service.list(user, {
      booking_id: q.booking_id,
      type: q.type,
      is_verified: q.is_verified,
      page: q.page,
      limit: q.limit,
    });
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload document (multipart)' })
  @ApiResponse({ status: 201 })
  async upload(
    @CurrentUser() user: CurrentUserType,
    @Req() req: FastifyRequest,
  ): Promise<unknown> {
    let bookingId = '';
    let docType: DocType | undefined;
    let allotteeIndex = 0;
    let notes: string | undefined;
    let buffer: Buffer | undefined;
    let filename = 'upload.bin';
    let mime = 'application/octet-stream';

    const iterator = req.parts();
    for await (const part of iterator) {
      if (part.type === 'file' && part.fieldname === 'file') {
        buffer = await part.toBuffer();
        filename = part.filename ?? filename;
        mime = part.mimetype ?? mime;
      } else if (part.type === 'field') {
        const field = part.fieldname;
        const val = String(part.value ?? '');
        if (field === 'booking_id') {
          bookingId = val;
        } else if (field === 'type') {
          docType = val as DocType;
        } else if (field === 'allottee_index') {
          allotteeIndex = parseInt(val, 10) || 0;
        } else if (field === 'notes') {
          notes = val;
        }
      }
    }

    if (!bookingId || !docType || !buffer) {
      throw new BadRequestException({
        message: 'booking_id, type, and file are required',
        error: 'INVALID_UPLOAD',
      });
    }

    return this.service.handleUpload({
      user,
      bookingId,
      type: docType,
      buffer,
      filename,
      mime,
      allotteeIndex,
      notes,
    });
  }

  @Get(':id/signed-url')
  @ApiOperation({ summary: 'Fresh signed URL' })
  @ApiResponse({ status: 200 })
  async signed(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.signedUrl(user, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Document metadata + signed URL' })
  @ApiResponse({ status: 200 })
  async one(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.findOne(user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document and storage object' })
  @ApiResponse({ status: 200 })
  async remove(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.remove(user, id);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify or reject document' })
  @ApiResponse({ status: 200 })
  async verify(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
  ): Promise<unknown> {
    return this.service.verify(user, id, dto);
  }
}
