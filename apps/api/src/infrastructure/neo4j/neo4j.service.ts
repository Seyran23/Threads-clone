import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import neo4j, { Driver } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver!: Driver;

  async onModuleInit() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD ?? 'neo4j'),
    );
    await this.driver.verifyConnectivity();
  }

  async onModuleDestroy() {
    await this.driver?.close();
  }

  getSession() {
    return this.driver.session();
  }

  async run<T = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }
}
