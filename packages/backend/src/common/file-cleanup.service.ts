import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  async deleteFile(fileUrl: string | null | undefined): Promise<void> {
    if (!fileUrl) return;
    
    // Strip leading slash if present to avoid absolute path resolution issues
    const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
    const filePath = join(process.cwd(), relativePath);
    
    try {
      await fs.unlink(filePath);
      this.logger.log(`Successfully deleted old file: ${filePath}`);
    } catch (error) {
      // Ignore if file doesn't exist
      this.logger.debug(`File not found or could not be deleted: ${filePath}`);
    }
  }
}
