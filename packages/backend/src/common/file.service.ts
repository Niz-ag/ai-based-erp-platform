import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class FileService {
  private readonly uploadPath = 'uploads';

  async saveFile(file: Express.Multer.File, folder: string = 'avatars'): Promise<string> {
    const fullFolderPath = join(process.cwd(), this.uploadPath, folder);
    
    // Create folder if it doesn't exist
    await fs.mkdir(fullFolderPath, { recursive: true });

    const fileName = `${randomUUID()}${extname(file.originalname)}`;
    const filePath = join(fullFolderPath, fileName);

    await fs.writeFile(filePath, file.buffer);

    // Return the relative URL/path
    return `/uploads/${folder}/${fileName}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    
    const filePath = join(process.cwd(), fileUrl);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}
