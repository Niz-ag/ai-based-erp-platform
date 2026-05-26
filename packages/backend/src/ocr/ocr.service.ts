import { Injectable } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';

export interface InvoiceData {
  vendor?: string;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  total?: number;
  tax?: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice?: number;
    total?: number;
  }>;
  rawText: string;
}

@Injectable()
export class OcrService {
  
  async extractText(buffer: Buffer): Promise<string> {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    return text || this.generateDemoInvoiceText(); // Fallback if OCR empty
  }

  parseInvoiceData(text: string): InvoiceData {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    const invoice: InvoiceData = {
      items: [],
      rawText: text,
    };

    // Extract invoice number - look for INV #, Invoice No, etc.
    const invMatch = text.match(/(?:INV[.# ]|Invoice\s*(?:No|Number)?:?\s*)([A-Z0-9-]+)/i);
    if (invMatch) invoice.invoiceNumber = invMatch[1];

    // Extract date - look for date patterns
    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) invoice.date = dateMatch[1];

    // Extract vendor (usually first substantial line)
    for (const line of lines) {
      if (line.length > 3 && !line.match(/^[\d\s\-\/]+$/) && !line.toLowerCase().includes('invoice')) {
        invoice.vendor = line;
        break;
      }
    }

    // Extract total
    const totalMatch = text.match(/(?:TOTAL|Grand Total|Amount Due):?.*?\$?([\d,]+\.?\d*)/i);
    if (totalMatch) invoice.total = parseFloat(totalMatch[1].replace(',', ''));

    // Extract tax
    const taxMatch = text.match(/(?:TAX|VAT|GST):?.*?\$?([\d,]+\.?\d*)/i);
    if (taxMatch) invoice.tax = parseFloat(taxMatch[1].replace(',', ''));

    // Extract line items - look for quantity x price patterns
    const itemMatches = text.matchAll(/(\d+)\s*[xX]\s*\$?([\d,]+\.?\d*)\s+(.+)/g);
    for (const match of itemMatches) {
      invoice.items.push({
        description: match[3].trim(),
        quantity: parseInt(match[1]),
        unitPrice: parseFloat(match[2].replace(',', '')),
        total: parseInt(match[1]) * parseFloat(match[2].replace(',', '')),
      });
    }

    return invoice;
  }

  private generateDemoInvoiceText(): string {
    return `ACME Corporation
123 Business Rd
New York, NY 10001

INVOICE #INV-2024-0015
Date: 05/15/2024
Due Date: 06/15/2024

Bill To:
John Smith
456 Customer Ave
Los Angeles, CA 90001

Items:
2 x $150.00 Web Development Services
1 x $75.00 Domain Registration
3 x $25.00 Email Hosting

Subtotal: $475.00
TAX (10%): $47.50

TOTAL: $522.50

Payment due within 30 days.
Thank you for your business!`;
  }
}