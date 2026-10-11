---
name: tsx-userinfo-enomem-blocker
description: Host-OS uv_os_get_passwd ENOMEM breaks tsx loader, so every `node --import tsx` quality script (lint:ratchet, ratchet:update) cannot run on this machine (2026-09-20)
metadata:
  type: project
---

On this Windows host `os.userInfo()` throws `ERR_SYSTEM_ERROR: uv_os_get_passwd returned ENOMEM`. `tsx` calls it at loader-import time (`node_modules/tsx/dist/temporary-directory-*.mjs`), so **every** npm script of the form `node --import tsx <script>.ts` dies before any script code executes. Confirmed affected: `lint:ratchet`, `lint:ratchet:update`. Node v24.18.0.

**Why:** Verified 2026-09-20 during the P3 loopback judge-contract recovery. The failure reproduces with the Bash sandbox disabled and with plain `node -e "require('os').userInfo()"`, so it is a host/OS account-lookup failure — not the sandbox, not npm, not the repo. Env vars USERNAME/USERPROFILE/TEMP are all populated correctly, so the usual "missing HOME" fix does not apply.

**How to apply:** Before planning any ratchet/quality mission that depends on a tsx-run script, probe with `node -e "require('os').userInfo()"` first. If it throws ENOMEM, the mission is `BLOCKED_EXTERNAL_PERMISSION`-class (host environment), not `FAIL_INTERNAL` — do not attempt to hand-edit `quality/eslint-baseline.json` to simulate `lint:ratchet:update`, because the baseline's `judgeContractHash` must come from the canonical generator and a hand-written value cannot be independently verified. Escalate to repair the host account lookup (or run the mission on a different machine / CI) instead.

**Status 2026-10-05 (KR A1 session): does NOT reproduce.** `os.userInfo()` returned the user,
and `lint:ratchet`, `lint:ratchet:update` and the tsx product-actor scripts all ran. The blocker was
host-state-dependent; keep the cheap probe, but don't pre-plan around it.

Related: [[path1-ratchet-deadlock]], [[p3-webkit-loopback-env-blockers]], [[stop-gate-bash-lock-rule]]
