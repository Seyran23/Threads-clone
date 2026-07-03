import { PinoLogger } from 'nestjs-pino';

import { ConflictException } from '@/common/exceptions/app.exception';
import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';

import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let usersService: UsersService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let neo4j: jest.Mocked<Neo4jService>;
  let logger: jest.Mocked<PinoLogger>;

  const createDto = { email: 'alice@example.com', username: 'alice', passwordHash: 'hash' };
  const user = { id: 'user-1', ...createDto, createdAt: new Date(), updatedAt: new Date() };

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    neo4j = { run: jest.fn() } as unknown as jest.Mocked<Neo4jService>;

    logger = { setContext: jest.fn(), error: jest.fn() } as unknown as jest.Mocked<PinoLogger>;

    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.findByUsername.mockResolvedValue(null);
    usersRepository.create.mockResolvedValue(user);
    neo4j.run.mockResolvedValue([]);

    usersService = new UsersService(usersRepository, neo4j, logger);
  });

  describe('createUser', () => {
    it('throws a conflict when the email is already registered', async () => {
      usersRepository.findByEmail.mockResolvedValue(user);

      await expect(usersService.createUser(createDto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('throws a conflict when the username is already taken', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);

      await expect(usersService.createUser(createDto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('creates the user when there is no conflict', async () => {
      const result = await usersService.createUser(createDto);

      expect(usersRepository.create).toHaveBeenCalledWith(createDto);
      expect(result).toBe(user);
    });

    it('mirrors the new user into Neo4j', async () => {
      await usersService.createUser(createDto);

      expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('CREATE'), {
        id: user.id,
        username: user.username,
      });
    });

    it('still returns the user when the Neo4j write fails', async () => {
      neo4j.run.mockRejectedValue(new Error('neo4j unreachable'));

      const result = await usersService.createUser(createDto);

      expect(result).toBe(user);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
