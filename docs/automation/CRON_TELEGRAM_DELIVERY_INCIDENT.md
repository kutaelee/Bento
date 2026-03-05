# Cron Telegram delivery incident ("⚠️ ✉️ Message failed")

## Root cause (captured)
The cron run attempted to call the `message` tool directly **without a target**, resulting in a tool error.

From session log:
- jobId: `<REDACTED_UUID>`
- sessionKey: `agent:audrey:cron:<REDACTED_UUID>:run:<REDACTED_UUID>`
- log file: `<LOCAL_PATH>`
- excerpt:

```json
{"tool":"message","error":"Action send requires a target."}
```

## Cron config snapshot
- `sessionTarget`: `isolated`
- `delivery.mode`: `announce`
- `delivery.channel`: `telegram`
- `delivery.to`: `telegram:<REDACTED_CHAT_ID>`

(See: `<LOCAL_PATH>`)

## Fix (prompt-level)
- Enforce: **do not call `message` tool** from cron runs.
- Output plain text only; delivery is handled by the cron delivery config.

## Evidence
- Source log: `<LOCAL_PATH>`
- Cron job config: `<LOCAL_PATH>`

## Verification (post-fix)
- openclaw cron runs (latest): <LOCAL_PATH> (see `openclaw cron runs --id a517...`)
- Observed: 2 consecutive runs with status=ok and no 'Message failed' after prompt hardening.
