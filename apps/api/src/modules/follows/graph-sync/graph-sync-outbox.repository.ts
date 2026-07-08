import { Injectable } from '@nestjs/common';

import { GraphSyncOutbox } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { CreateGraphSyncEventDto } from '../dto/create-graph-sync-event.dto';

import { GRAPH_SYNC_MAX_ATTEMPTS, GRAPH_SYNC_STUCK_THRESHOLD_MS } from './graph-sync.constants';

@Injectable()
export class GraphSyncOutboxRepository {
  create(tx: PrismaClientOrTx, data: CreateGraphSyncEventDto): Promise<GraphSyncOutbox> {
    return tx.graphSyncOutbox.create({
      data: { eventType: data.eventType, payload: data.payload },
    });
  }

  findById(tx: PrismaClientOrTx, id: string): Promise<GraphSyncOutbox | null> {
    return tx.graphSyncOutbox.findUnique({ where: { id } });
  }

  markCompleted(tx: PrismaClientOrTx, id: string): Promise<GraphSyncOutbox> {
    return tx.graphSyncOutbox.update({ where: { id }, data: { status: 'COMPLETED' } });
  }

  async incrementAttempts(tx: PrismaClientOrTx, id: string): Promise<GraphSyncOutbox> {
    const updated = await tx.graphSyncOutbox.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });

    if (updated.attempts >= GRAPH_SYNC_MAX_ATTEMPTS) {
      return tx.graphSyncOutbox.update({ where: { id }, data: { status: 'FAILED' } });
    }
    return updated;
  }

  findStuckPending(tx: PrismaClientOrTx): Promise<GraphSyncOutbox[]> {
    return tx.graphSyncOutbox.findMany({
      where: {
        status: 'PENDING',
        updatedAt: { lt: new Date(Date.now() - GRAPH_SYNC_STUCK_THRESHOLD_MS) },
      },
    });
  }
}
