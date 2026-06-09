import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('ocr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('invoice')
  @Roles('superadmin', 'admin', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  async parseInvoice(
    @UploadedFile() file: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    const text = await this.ocrService.extractText(file.buffer);
    const invoice = await this.ocrService.mapAndCreateDraft(text, currentUser);
    return invoice;
  }

  @Post('invoice/text')
  @Roles('superadmin', 'admin', 'manager')
  async parseInvoiceText(
    @Body() body: { text: string },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    const invoice = await this.ocrService.mapAndCreateDraft(body.text, currentUser);
    return invoice;
  }
}