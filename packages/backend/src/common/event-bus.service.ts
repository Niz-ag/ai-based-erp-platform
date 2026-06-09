import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface ModelEvent {
  model: string;
  operation: string;
  data: any;
  tenantId: string;
}

@Injectable()
export class EventBusService {
  private modelEvents = new Subject<ModelEvent>();

  emitModelEvent(event: ModelEvent) {
    this.modelEvents.next(event);
  }

  onModelEvent() {
    return this.modelEvents.asObservable();
  }
}
