import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AuditService } from './audit.service';
import { Logger } from '@nestjs/common';
import { tenantContextStorage } from '../common/tenant-context';

@Processor('audit')
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(private readonly auditService: AuditService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'log-mutation':
        // Ensure tenant context is available for the Prisma extension
        return await tenantContextStorage.run(
          { tenantId: job.data.tenantId, userId: job.data.userId },
          () => this.auditService.processLog(job.data),
        );
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
