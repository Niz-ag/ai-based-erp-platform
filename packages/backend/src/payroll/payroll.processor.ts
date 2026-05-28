import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PayrollService } from './payroll.service';
import { Logger } from '@nestjs/common';
import { tenantContextStorage } from '../common/tenant-context';

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(private readonly payrollService: PayrollService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    return tenantContextStorage.run({ tenantId: job.data.tenantId }, async () => {
      switch (job.name) {
        case 'process-run':
          this.logger.log(`Starting payroll processing for run: ${job.data.runId} (Tenant: ${job.data.tenantId})`);
          await this.payrollService.processPayrollRun(job.data.runId, job.data.tenantId);
          this.logger.log(`Finished payroll processing for run: ${job.data.runId}`);
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
      }
    });
  }
}
