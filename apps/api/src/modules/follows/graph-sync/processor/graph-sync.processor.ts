import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import { GraphSyncOutboxRepository } from '../graph-sync-outbox.repository';
import { GRAPH_SYNC_QUEUE_NAME } from '../graph-sync.constants';
import { FollowEventPayload } from '../interface/follow-event-payload.interface';
import { GraphSyncJobData } from '../interface/graph-sync-job-data.interface';

@Injectable()
export class GraphSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker<GraphSyncJobData>;

  constructor(
    private readonly connection: BullMqConnectionService,
    private readonly neo4j: Neo4jService,
    private readonly graphSyncOutboxRepository: GraphSyncOutboxRepository,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GraphSyncProcessor.name);
  }

  onModuleInit(): void {
    this.worker = new Worker<GraphSyncJobData>(
      GRAPH_SYNC_QUEUE_NAME,
      (job) => this.processJob(job),
      { connection: this.connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, outboxId: job?.data.outboxId, err },
        'Graph-sync job failed',
      );
    });
  }

  async processJob(job: Job<GraphSyncJobData>): Promise<void> {
    const { outboxId } = job.data;
    this.logger.info({ jobId: job.id, outboxId }, 'Graph-sync job picked up');

    const event = await this.graphSyncOutboxRepository.findById(this.prisma, outboxId);
    if (!event || event.status === 'COMPLETED') {
      this.logger.info({ outboxId }, 'Graph-sync event already completed or missing, skipping');
      return;
    }

    try {
      const { followerId, followeeId } = event.payload as unknown as FollowEventPayload;

      if (event.eventType === 'FOLLOW_CREATED') {
        await this.neo4j.run(
          'MATCH (a:User {id: $followerId}), (b:User {id: $followeeId}) ' +
            'MERGE (a)-[:FOLLOWS]->(b)',
          { followerId, followeeId },
        );
      } else if (event.eventType === 'FOLLOW_DELETED') {
        await this.neo4j.run(
          'MATCH (a:User {id: $followerId})-[r:FOLLOWS]->(b:User {id: $followeeId}) DELETE r',
          { followerId, followeeId },
        );
      }

      await this.graphSyncOutboxRepository.markCompleted(this.prisma, outboxId);
      this.logger.info({ outboxId, eventType: event.eventType }, 'Graph-sync event applied');
    } catch (err) {
      await this.graphSyncOutboxRepository.incrementAttempts(this.prisma, outboxId);
      this.logger.error(
        { outboxId, jobId: job.id, attempt: job.attemptsMade + 1, err },
        'Graph-sync event failed to apply',
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
