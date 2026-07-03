import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { CreateRefreshTokenDto } from './dto/create-refresh-token.dto';
import { RefreshTokenRepository } from './refresh-token.repository';

describe('RefreshTokenRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: RefreshTokenRepository;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new RefreshTokenRepository(prisma);

    const user = await prisma.user.create({
      data: { email: 'repo-test@example.com', username: 'repotest', passwordHash: 'x' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany();
  });

  const makeDto = (overrides: Partial<CreateRefreshTokenDto> = {}): CreateRefreshTokenDto => ({
    userId,
    tokenHash: `hash-${Math.random()}`,
    familyId: `family-${Math.random()}`,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

  it('creates and finds a refresh token by hash', async () => {
    const dto = makeDto();
    const created = await repository.create(dto);

    const found = await repository.findByTokenHash(dto.tokenHash);

    expect(found?.id).toBe(created.id);
  });

  it('returns null for an unknown hash', async () => {
    const found = await repository.findByTokenHash('does-not-exist');

    expect(found).toBeNull();
  });

  it('marks a token as used', async () => {
    const created = await repository.create(makeDto());

    const updated = await repository.markUsed(created.id);

    expect(updated.used).toBe(true);
  });

  it('revokes every token in a family, and only that family', async () => {
    await repository.create(makeDto({ familyId: 'shared-family', tokenHash: 'a' }));
    await repository.create(makeDto({ familyId: 'shared-family', tokenHash: 'b' }));
    await repository.create(makeDto({ familyId: 'other-family', tokenHash: 'c' }));

    const result = await repository.revokeFamily('shared-family');

    expect(result.count).toBe(2);
    expect((await repository.findByTokenHash('a'))?.revoked).toBe(true);
    expect((await repository.findByTokenHash('b'))?.revoked).toBe(true);
    expect((await repository.findByTokenHash('c'))?.revoked).toBe(false);
  });

  it('rejects a duplicate tokenHash', async () => {
    const dto = makeDto();
    await repository.create(dto);

    await expect(repository.create(makeDto({ tokenHash: dto.tokenHash }))).rejects.toThrow();
  });
});
