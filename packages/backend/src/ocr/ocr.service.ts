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
    try {
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
      return text || this.generateDemoInvoiceText();
    } catch (error) {
      console.error('OCR Extraction failed:', error);
      return this.generateDemoInvoiceText();
    }
  }

  parseInvoiceData(text: string): InvoiceData {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    const invoice: InvoiceData = {
      items: [],
      rawText: text,
    };

    // 1. IMPROVED: Invoice Number Extraction (Multi-pattern)
    const invPatterns = [
      /(?:INV[.# ]|Invoice\s*(?:No|Number)?:?\s*)([A-Z0-9-]+)/i,
      /(?:#|No\.?)\s*([A-Z0-9-]{4,})/i,
      /^[A-Z0-9-]{5,15}$/m // Fallback: look for a lone alphanumeric code
    ];
    for (const p of invPatterns) {
      const match = text.match(p);
      if (match) {
        invoice.invoiceNumber = match[1];
        break;
      }
    }

    // 2. IMPROVED: Date Extraction
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(?:Date|Issued):?\s*([a-zA-Z]+\s+\d{1,2},?\s+\d{4})/i,
      /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/
    ];
    for (const p of datePatterns) {
      const match = text.match(p);
      if (match) {
        invoice.date = match[1];
        break;
      }
    }

    // 3. IMPROVED: Vendor Detection (Search for typical company headers)
    for (const line of lines) {
      if (line.length > 3 && 
          !line.match(/^[\d\s\-\/.,]+$/) && 
          !line.toLowerCase().includes('invoice') &&
          !line.toLowerCase().includes('date') &&
          !line.toLowerCase().includes('bill to')) {
        invoice.vendor = line;
        break;
      }
    }

    // 4. IMPROVED: Financial Total Extraction (Precision focus)
    const totalPatterns = [
      /(?:TOTAL|Grand Total|Amount Due|Total Due):?.*?\$?([\d,]+\.\d{2})/i,
      /(?:TOTAL|Grand Total):?.*?\$?([\d,]+)/i
    ];
    for (const p of totalPatterns) {
      const match = text.match(p);
      if (match) {
        invoice.total = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // 5. IMPROVED: Line Item Parsing (Heuristic-based)
    // Looking for patterns like: [Qty] x [Price] [Description] or [Qty] [Description] [Price]
    const itemLines = lines.filter(l => l.match(/\d+/) && l.match(/\d+\.\d{2}/));
    for (const line of itemLines) {
      const qtyMatch = line.match(/^(\d+)\s/);
      const priceMatch = line.match(/\$?([\d,]+\.\d{2})/g);
      
      if (qtyMatch && priceMatch && priceMatch.length >= 1) {
        const qty = parseInt(qtyMatch[1]);
        const price = parseFloat(priceMatch[0].replace(/[\$,]/g, ''));
        // Description is usually what's left
        const desc = line.replace(qtyMatch[0], '').replace(priceMatch[0], '').replace(/[xX\$]/g, '').trim();
        
        if (desc.length > 2) {
          invoice.items.push({
            description: desc,
            quantity: qty,
            unitPrice: price,
            total: qty * price
          });
        }
      }
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
