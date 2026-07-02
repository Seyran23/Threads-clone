import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ConflictException } from '@/common/exceptions/app.exception';
import { User } from '@/generated/prisma';
import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly neo4j: Neo4jService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsersService.name);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const [existingEmail, existingUsername] = await Promise.all([
      this.usersRepository.findByEmail(data.email),
      this.usersRepository.findByUsername(data.username),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    const user = await this.usersRepository.create(data);

    try {
      await this.neo4j.run('CREATE (u:User {id: $id, username: $username})', {
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      this.logger.error({ err: error, userId: user.id }, 'Failed to create Neo4j User node');
    }

    return user;
  }
}
