import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templatesDir = path.join(process.cwd(), 'templates');

  private compileTemplate(templateName: string, data: any): string {
    const filePath = path.join(this.templatesDir, `${templateName}.hbs`);
    if (!fs.existsSync(filePath)) {
      this.logger.error(`Template not found: ${filePath}`);
      throw new Error(`Email template ${templateName} not found`);
    }

    const source = fs.readFileSync(filePath, 'utf-8');
    const template = handlebars.compile(source);
    return template(data);
  }

  async sendWelcomeEmail(to: string, name: string) {
    const html = this.compileTemplate('welcome', { name });
    
    // Mock sending email
    this.logger.log(`Sending Welcome Email to: ${to}`);
    this.logger.debug(`HTML Content: ${html.substring(0, 100)}...`);
    
    // In a real scenario, you would use nodemailer or a similar library here
    this.logger.log('--- EMAIL SENT (MOCK) ---');
    this.logger.log(`To: ${to}`);
    this.logger.log(`Subject: Welcome to AMDOX`);
    // this.logger.log(`Body: ${html}`);
    this.logger.log('-------------------------');

    return { success: true, to };
    }

    async sendNotificationEmail(to: string, title: string, message: string, actionUrl?: string, actionText?: string) {
    const html = this.compileTemplate('notification', {
      title,
      message,
      actionUrl,
      actionText
    });

    // Mock sending email
    this.logger.log(`Sending Notification Email to: ${to}`);
    this.logger.debug(`HTML Content: ${html.substring(0, 100)}...`);

    this.logger.log('--- EMAIL SENT (MOCK) ---');
    this.logger.log(`To: ${to}`);
    this.logger.log(`Subject: ${title}`);
    // this.logger.log(`Body: ${html}`);
    this.logger.log('-------------------------');

    return { success: true, to };
    }
    }
