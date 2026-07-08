import { GraphSyncEventType } from '@/generated/prisma';

export class CreateGraphSyncEventDto {
  eventType!: GraphSyncEventType;
  payload!: Record<string, string>;
}
