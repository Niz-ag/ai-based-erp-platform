import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';
import { PrismaService } from '../common/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

export interface InvoiceData {
  vendor?: string;
  vendorId?: string;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  total?: number;
  tax?: number;
  accountId?: string;
  journalEntryId?: string;
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
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private prisma: PrismaService,
    private financeService: FinanceService,
  ) {}
  
  async extractText(buffer: Buffer): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
      if (!text || text.trim().length === 0) {
        throw new BadRequestException('OCR extraction failed: No text detected in the uploaded image.');
      }
      return text;
    } catch (error) {
      this.logger.error('OCR Extraction failed:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('OCR extraction failed: The image could not be processed. Please ensure it is clear and contains text.');
    }
  }

  async mapAndCreateDraft(text: string, currentUser: CurrentUserData): Promise<InvoiceData> {
    const invoice = this.parseInvoiceData(text);

    // 1. Map Vendor
    if (invoice.vendor) {
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          name: { contains: invoice.vendor, mode: 'insensitive' },
        },
      });
      if (vendor) {
        invoice.vendorId = vendor.id;
      }
    }

    // 2. Map Account
    const expenseAccount = await this.prisma.account.findFirst({
      where: { 
        OR: [
          { code: '5100' },
          { type: 'EXPENSE', name: { contains: 'Supply', mode: 'insensitive' } },
          { type: 'EXPENSE' }
        ]
      },
    });

    if (expenseAccount) {
      invoice.accountId = expenseAccount.id;
    }

    // 3. Create Draft Journal Entry if we have total and account
    if (invoice.total && invoice.accountId) {
      const liabilityAccount = await this.prisma.account.findFirst({
        where: { code: '2000' },
      });
      const taxAccount = await this.prisma.account.findFirst({
        where: { code: '2100' }
      });

      if (liabilityAccount && taxAccount) {
        try {
          const taxAmount = invoice.total * 0.10;
          const entry = await this.financeService.createJournalEntry({
            description: `OCR Invoice: ${invoice.vendor || 'Unknown'} - ${invoice.invoiceNumber || 'No Number'}`,
            date: invoice.date ? new Date(invoice.date) : new Date(),
            lines: [
              {
                accountId: invoice.accountId,
                debit: invoice.total,
                description: `Expense from invoice ${invoice.invoiceNumber || ''}`,
              },
              {
                accountId: taxAccount.id,
                debit: taxAmount,
                description: `Tax liability from invoice ${invoice.invoiceNumber || ''}`,
              },
              {
                accountId: liabilityAccount.id,
                credit: invoice.total + taxAmount,
                description: `Accounts Payable from invoice ${invoice.invoiceNumber || ''}`,
              },
            ],
          }, currentUser);
          
          invoice.journalEntryId = entry.id;
        } catch (error) {
          this.logger.error('Failed to create draft journal entry:', error);
        }
      }
    }

    return invoice;
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
}
