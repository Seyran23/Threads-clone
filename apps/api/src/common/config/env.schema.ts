import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.string().default('info'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  NEO4J_URI: z.string().min(1),
  NEO4J_USER: z.string().min(1),
  NEO4J_PASSWORD: z.string().min(1),

  JWT_ACCESS_TOKEN_TTL: z.string().min(1),
  JWT_REFRESH_TOKEN_TTL: z.string().min(1),
  JWT_ACCESS_PRIVATE_KEY: z.string().min(1),
  JWT_ACCESS_PUBLIC_KEY: z.string().min(1),
  JWT_REFRESH_PRIVATE_KEY: z.string().min(1),
  JWT_REFRESH_PUBLIC_KEY: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_PUBLIC_URL: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_ACCESS_SECRET: z.string().min(1),
  S3_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
