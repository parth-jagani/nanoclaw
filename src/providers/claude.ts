import { homedir } from 'node:os';
import { join } from 'node:path';

import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('claude', () => {
  const dotenv = readEnvFile(['ANTHROPIC_BASE_URL']);
  const env: Record<string, string> = {};
  const mounts = [];

  if (dotenv.ANTHROPIC_BASE_URL) {
    // Custom endpoint via OneCLI proxy (header injection).
    env.ANTHROPIC_BASE_URL = dotenv.ANTHROPIC_BASE_URL;
    env.ANTHROPIC_AUTH_TOKEN = 'placeholder';
  } else {
    // Use Claude.ai subscription OAuth credentials from the host.
    // Mount only the credentials file (not the whole .claude dir) as a nested
    // mount inside the per-group .claude-shared dir already at /home/node/.claude.
    // Read-write so the SDK can refresh the token when it expires.
    // Bypass OneCLI proxy for Anthropic — OAuth auth needs a direct connection.
    mounts.push({
      hostPath: join(homedir(), '.claude', '.credentials.json'),
      containerPath: '/home/node/.claude/.credentials.json',
      readonly: false,
    });
    // Clear the placeholder OneCLI injects — OAuth auth doesn't use an API key.
    env.ANTHROPIC_API_KEY = '';
    env.NO_PROXY = 'api.anthropic.com';
    env.no_proxy = 'api.anthropic.com';
  }

  return { env, mounts };
});
