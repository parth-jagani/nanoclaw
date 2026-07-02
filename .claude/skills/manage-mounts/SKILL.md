---
name: manage-mounts
description: Configure which host directories agent containers can access. View, add, or remove mount allowlist entries. Triggers on "mounts", "mount allowlist", "agent access to directories", "container mounts".
---

# Manage Mounts

Configure which host directories NanoClaw agent containers can access. The mount allowlist lives at `~/.config/nanoclaw/mount-allowlist.json`.

## Show Current Config

```bash
cat ~/.config/nanoclaw/mount-allowlist.json 2>/dev/null || echo "No mount allowlist configured"
```

Show the current config to the user in a readable format: which directories are allowed, whether non-main agents are read-only.

## Add Directories

Ask which directories the user wants agents to access. For each path:
- Validate the path exists
- Ask if it should be read-only for non-main agents (default: yes)

Build the JSON config and write it:

```bash
pnpm exec tsx setup/index.ts --step mounts --force -- --json '{"allowedRoots":[{"path":"/path/to/dir","readOnly":false}],"blockedPatterns":[],"nonMainReadOnly":true}'
```

Use `--force` to overwrite the existing config.

## Remove Directories

Read the current config, show it, ask which entry to remove, then write the updated config through the same write path (build the trimmed JSON and pass it to `--step mounts --force -- --json`):

```bash
pnpm exec tsx setup/index.ts --step mounts --force -- --json '{"allowedRoots":[],"blockedPatterns":[],"nonMainReadOnly":true}'
```

## Reset to Empty

```bash
pnpm exec tsx setup/index.ts --step mounts --force -- --empty
```

## After Changes — Required 3-Step Protocol

Mount changes require **all three** steps. Missing any one means the change won't take effect.

**1. Update the DB** (`additional_mounts` in `container_configs` — `ncl groups config update` does not handle this field, use direct SQL):
```bash
pnpm exec tsx scripts/q.ts data/v2.db "UPDATE container_configs SET additional_mounts = '<json>' WHERE agent_group_id = '<id>'"
```

**2. Update the allowlist file** (`~/.config/nanoclaw/mount-allowlist.json`) — add the new host path as an allowed root. The file is edited directly (JSON).

**3. Restart the host service** — the allowlist is cached in memory and never reloads until the process restarts. `ncl groups restart` only kills the agent container, NOT the host.

```bash
# Linux (this install)
systemctl --user restart nanoclaw-v2-2515390d.service
systemctl --user status nanoclaw-v2-2515390d.service   # verify running

# macOS
source setup/lib/install-slug.sh
launchctl kickstart -k gui/$(id -u)/$(launchd_label)
```

After the host restarts, send any message to the agent — it will spawn a fresh container with the new mount wired in.
