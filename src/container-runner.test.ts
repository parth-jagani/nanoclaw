import { describe, expect, it } from 'vitest';

import {
  decideOneCliFailureAction,
  isOneCliConnectivityError,
  ONECLI_FAILURE_ESCALATE_MS,
  ONECLI_REMEDIATION_COOLDOWN_MS,
  resolveProviderName,
} from './container-runner.js';

describe('resolveProviderName', () => {
  it('prefers session over container config', () => {
    expect(resolveProviderName('codex', 'claude')).toBe('codex');
  });

  it('falls back to container config when session is null', () => {
    expect(resolveProviderName(null, 'opencode')).toBe('opencode');
  });

  it('defaults to claude when nothing is set', () => {
    expect(resolveProviderName(null, undefined)).toBe('claude');
  });

  it('lowercases the resolved name', () => {
    expect(resolveProviderName('CODEX', null)).toBe('codex');
    expect(resolveProviderName(null, 'Claude')).toBe('claude');
  });

  it('treats empty string as unset (falls through)', () => {
    expect(resolveProviderName('', 'opencode')).toBe('opencode');
    expect(resolveProviderName(null, '')).toBe('claude');
  });
});

describe('isOneCliConnectivityError', () => {
  it('recognizes the OneCLI SDK "fetch failed" shape', () => {
    expect(isOneCliConnectivityError({ type: 'OneCLIError', message: 'fetch failed' })).toBe(true);
  });

  it('rejects other OneCLIError messages (real API errors, not connectivity)', () => {
    expect(isOneCliConnectivityError({ type: 'OneCLIError', message: 'unauthorized' })).toBe(false);
  });

  it('rejects non-OneCLI errors', () => {
    expect(isOneCliConnectivityError(new Error('fetch failed'))).toBe(false);
    expect(isOneCliConnectivityError(null)).toBe(false);
    expect(isOneCliConnectivityError('fetch failed')).toBe(false);
  });
});

describe('decideOneCliFailureAction', () => {
  const connErr = { type: 'OneCLIError', message: 'fetch failed' };

  it('ignores non-connectivity errors regardless of streak state', () => {
    const decision = decideOneCliFailureAction({
      err: new Error('boom'),
      now: 1_000_000,
      streakStartedAt: 900_000,
      lastRemediationAt: 0,
    });
    expect(decision).toEqual({ action: 'ignore' });
  });

  it('starts a new streak on the first connectivity failure', () => {
    const decision = decideOneCliFailureAction({
      err: connErr,
      now: 1_000_000,
      streakStartedAt: null,
      lastRemediationAt: 0,
    });
    expect(decision).toEqual({ action: 'track-start' });
  });

  it('waits while the streak is below the escalation threshold', () => {
    const now = 1_000_000;
    const decision = decideOneCliFailureAction({
      err: connErr,
      now,
      streakStartedAt: now - (ONECLI_FAILURE_ESCALATE_MS - 1),
      lastRemediationAt: 0,
    });
    expect(decision).toEqual({ action: 'wait' });
  });

  it('remediates once the streak clears the escalation threshold', () => {
    const now = 1_000_000;
    const decision = decideOneCliFailureAction({
      err: connErr,
      now,
      streakStartedAt: now - ONECLI_FAILURE_ESCALATE_MS,
      lastRemediationAt: 0,
    });
    expect(decision).toEqual({ action: 'remediate' });
  });

  it('withholds remediation during the cooldown window even if the streak qualifies', () => {
    const now = 1_000_000;
    const decision = decideOneCliFailureAction({
      err: connErr,
      now,
      streakStartedAt: now - ONECLI_FAILURE_ESCALATE_MS,
      lastRemediationAt: now - (ONECLI_REMEDIATION_COOLDOWN_MS - 1),
    });
    expect(decision).toEqual({ action: 'wait' });
  });

  it('remediates again once the cooldown window has fully elapsed', () => {
    const now = 1_000_000;
    const decision = decideOneCliFailureAction({
      err: connErr,
      now,
      streakStartedAt: now - ONECLI_FAILURE_ESCALATE_MS,
      lastRemediationAt: now - ONECLI_REMEDIATION_COOLDOWN_MS,
    });
    expect(decision).toEqual({ action: 'remediate' });
  });
});
