import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('ocr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('invoice')
  @Roles('superadmin', 'admin', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  async parseInvoice(@UploadedFile() file: any) {
    const text = await this.ocrService.extractText(file.buffer);
    const invoice = this.ocrService.parseInvoiceData(text);
    return invoice;
  }

  @Post('invoice/text')
  @Roles('superadmin', 'admin', 'manager')
  async parseInvoiceText(@Body() body: { text: string }) {
    const invoice = this.ocrService.parseInvoiceData(body.text);
    return invoice;
  }
}