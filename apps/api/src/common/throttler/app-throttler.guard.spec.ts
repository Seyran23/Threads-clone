import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard & { getTracker: (req: Record<string, unknown>) => Promise<string> };

  beforeEach(() => {
    guard = new AppThrottlerGuard({} as never, {} as never, {} as never) as unknown as typeof guard;
  });

  it('tracks by the authenticated user id when one is present', async () => {
    const tracker = await guard.getTracker({ user: { id: 'user-1' }, ip: '198.51.100.4' });

    expect(tracker).toBe('user-1');
  });

  it('falls back to the request IP when there is no authenticated user', async () => {
    const tracker = await guard.getTracker({ ip: '198.51.100.4' });

    expect(tracker).toBe('198.51.100.4');
  });
});
