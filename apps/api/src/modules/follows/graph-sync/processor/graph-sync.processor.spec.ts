import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import { GraphSyncOutboxRepository } from '../graph-sync-outbox.repository';
import { GraphSyncJobData } from '../interface/graph-sync-job-data.interface';

import { GraphSyncProcessor } from './graph-sync.processor';

jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

describe('GraphSyncProcessor', () => {
  let processor: GraphSyncProcessor;
  let neo4j: jest.Mocked<Neo4jService>;
  let graphSyncOutboxRepository: jest.Mocked<GraphSyncOutboxRepository>;
  let prisma: PrismaService;
  let logger: jest.Mocked<PinoLogger>;

  const followCreatedEvent = {
    id: 'outbox-1',
    eventType: 'FOLLOW_CREATED',
    payload: { followerId: 'user-1', followeeId: 'user-2' },
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const job = {
    id: 'job-1',
    data: { outboxId: 'outbox-1' },
    attemptsMade: 0,
  } as Job<GraphSyncJobData>;

  beforeEach(() => {
    neo4j = { run: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<Neo4jService>;

    graphSyncOutboxRepository = {
      findById: jest.fn().mockResolvedValue(followCreatedEvent),
      markCompleted: jest.fn(),
      incrementAttempts: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncOutboxRepository>;

    prisma = {} as PrismaService;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    processor = new GraphSyncProcessor(
      {} as BullMqConnectionService,
      neo4j,
      graphSyncOutboxRepository,
      prisma,
      logger,
    );
  });

  it('skips when the outbox row no longer exists', async () => {
    graphSyncOutboxRepository.findById.mockResolvedValue(null);

    await processor.processJob(job);

    expect(neo4j.run).not.toHaveBeenCalled();
    expect(graphSyncOutboxRepository.markCompleted).not.toHaveBeenCalled();
  });

  it('skips when the outbox row is already COMPLETED', async () => {
    graphSyncOutboxRepository.findById.mockResolvedValue({
      ...followCreatedEvent,
      status: 'COMPLETED',
    } as never);

    await processor.processJob(job);

    expect(neo4j.run).not.toHaveBeenCalled();
  });

  it('applies FOLLOW_CREATED as a Cypher MERGE and marks the row COMPLETED', async () => {
    await processor.processJob(job);

    expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('MERGE'), {
      followerId: 'user-1',
      followeeId: 'user-2',
    });
    expect(graphSyncOutboxRepository.markCompleted).toHaveBeenCalledWith(prisma, 'outbox-1');
  });

  it('applies FOLLOW_DELETED as a Cypher DELETE and marks the row COMPLETED', async () => {
    graphSyncOutboxRepository.findById.mockResolvedValue({
      ...followCreatedEvent,
      eventType: 'FOLLOW_DELETED',
    } as never);

    await processor.processJob(job);

    expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('DELETE'), {
      followerId: 'user-1',
      followeeId: 'user-2',
    });
    expect(graphSyncOutboxRepository.markCompleted).toHaveBeenCalledWith(prisma, 'outbox-1');
  });

  it('increments attempts and rethrows when the Neo4j write fails, so BullMQ retries it', async () => {
    neo4j.run.mockRejectedValue(new Error('Neo4j unreachable'));

    await expect(processor.processJob(job)).rejects.toThrow('Neo4j unreachable');

    expect(graphSyncOutboxRepository.incrementAttempts).toHaveBeenCalledWith(prisma, 'outbox-1');
    expect(graphSyncOutboxRepository.markCompleted).not.toHaveBeenCalled();
  });
});
