# Device Firmware Provisioning Flow

## ESP states before/after register

1. `UNREGISTERED`
- No `deviceKey` in NVS
- Enter provisioning mode
- Receive `registrationCode` (temporary)
- Call `POST /api/device/register`

2. `REGISTERED_UNBOUND`
- `deviceKey` already stored in NVS
- Poll `GET /api/device/bootstrap`
- Wait until `ready=true`

3. `READY`
- Runtime config complete
- Enter run mode
- Send `POST /api/device/events`
- Poll `GET /api/device/config/version` and refresh bootstrap when changed

4. `RECOVERY`
- Use when local config is lost but `deviceKey` still exists
- Call `POST /api/device/recover`
- Restore config to NVS and return to normal flow

## Credential rules
- `registrationCode`: one-time onboarding only
- `x-device-key`: long-term device credential
- Store `x-device-key` in NVS
- Do not keep `registrationCode` after successful registration

## Agreed Recovery Strategy (2026-05-10)

Use this 2-layer approach:

1. Device key redundancy (primary + backup)
- Store `deviceKey` in 2 copies (NVS primary + NVS backup or separate partition)
- Keep `version` + `crc` for each copy
- If one copy is corrupted, recover from the other copy automatically

2. Short-lived technician provisioning token (last-resort)
- Technician triggers **Recover Device** from Portal
- Server issues short-lived token (5-10 minutes)
- ESP uses this token to exchange for a new `deviceKey`

### Next implementation note
- Next session: implement "attach/issue `deviceKey` during register flow" for smoother first provisioning.
