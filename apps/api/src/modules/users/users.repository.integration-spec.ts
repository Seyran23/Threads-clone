import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UsersRepository } from './users.repository';

describe('UsersRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: UsersRepository;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new UsersRepository(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  const makeDto = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => ({
    email: `user-${Math.random()}@example.com`,
    username: `user${Math.random().toString(36).slice(2)}`,
    passwordHash: 'hash',
    ...overrides,
  });

  it('creates a user and finds it by id, email, and username', async () => {
    const dto = makeDto();
    const created = await repository.create(dto);

    expect((await repository.findById(created.id))?.id).toBe(created.id);
    expect((await repository.findByEmail(dto.email))?.id).toBe(created.id);
    expect((await repository.findByUsername(dto.username))?.id).toBe(created.id);
  });

  it('returns null for a user that does not exist', async () => {
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
    expect(await repository.findByUsername('nobody')).toBeNull();
    expect(await repository.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('rejects a duplicate email', async () => {
    const dto = makeDto();
    await repository.create(dto);

    await expect(repository.create(makeDto({ email: dto.email }))).rejects.toThrow();
  });

  it('rejects a duplicate username', async () => {
    const dto = makeDto();
    await repository.create(dto);

    await expect(repository.create(makeDto({ username: dto.username }))).rejects.toThrow();
  });
});
