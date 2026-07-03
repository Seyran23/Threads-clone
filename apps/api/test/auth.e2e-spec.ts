import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';

import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let neo4j: Neo4jService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    neo4j = app.get(Neo4jService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e-' } } });
    await neo4j.run("MATCH (u:User) WHERE u.username STARTS WITH 'e2e' DETACH DELETE u");
    await app.close();
  });

  function uniqueUser() {
    const id = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
    return {
      email: `e2e-${id}@example.com`,
      username: `e2e${id}`,
      password: 'Sup3rSecret!Pass',
    };
  }

  function extractCookie(response: request.Response, name: string): string {
    const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = setCookie?.find((c) => c.startsWith(`${name}=`));
    if (!cookie) {
      throw new Error(`${name} cookie not found in response`);
    }
    return cookie.split(';')[0];
  }

  it('registers a user, sets cookies, and never returns the password hash', async () => {
    const user = uniqueUser();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    expect(response.body.user).toMatchObject({ email: user.email, username: user.username });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.accessToken).toBeUndefined();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    );
  });

  it('rejects registration with a password that fails the complexity rules', async () => {
    const user = uniqueUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, password: 'weak' })
      .expect(400);
  });

  it('rejects a duplicate email with 409', async () => {
    const user = uniqueUser();
    await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, username: `${user.username}dup` })
      .expect(409);

    expect(response.body.code).toBe('CONFLICT');
  });

  it('logs in with correct credentials, rejects incorrect ones', async () => {
    const user = uniqueUser();
    await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'WrongPassword123!' })
      .expect(401);
  });

  it('rotates on refresh, then detects reuse of the old token and revokes the whole session', async () => {
    const user = uniqueUser();
    const server = app.getHttpServer();

    const registerRes = await request(server).post('/auth/register').send(user).expect(201);
    const originalRefreshCookie = extractCookie(registerRes, 'refresh_token');

    const refreshRes = await request(server)
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(200);
    const rotatedRefreshCookie = extractCookie(refreshRes, 'refresh_token');
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);

    const replayRes = await request(server)
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(401);
    expect(replayRes.body.message).toMatch(/reuse detected/i);

    await request(server).post('/auth/refresh').set('Cookie', rotatedRefreshCookie).expect(401);
  });

  it('logs out, clearing cookies and revoking the session', async () => {
    const user = uniqueUser();
    const server = app.getHttpServer();

    const registerRes = await request(server).post('/auth/register').send(user).expect(201);
    const refreshCookie = extractCookie(registerRes, 'refresh_token');

    const logoutRes = await request(server)
      .post('/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(logoutRes.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('access_token=;')]),
    );

    await request(server).post('/auth/refresh').set('Cookie', refreshCookie).expect(401);
  });

  it('returns 401 when no refresh token cookie is present at all', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });
});
