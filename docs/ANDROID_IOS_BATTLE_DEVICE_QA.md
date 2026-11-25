# Android / iOS Battle device QA

This checklist is for physical-device verification. GitHub Actions Expo exports only prove that platform bundles can be generated; they do not prove runtime WebSocket behavior on a handset.

## Test setup
- Use one Android phone and one iPhone, both on the latest test build from the same feature branch.
- Point both builds at the same non-production API environment with shared Redis and PostgreSQL.
- Use two separate test accounts. Do not use real player accounts or production data.
- Record device model, OS version, app build/commit, network type, and UTC test time.
- Keep API replica logs and Redis/PostgreSQL test-environment logs available.

## Required checks

| ID | Action | Expected result |
|---|---|---|
| MOB-01 | Sign in on both devices | Both authenticate; no repeated reconnect loop. |
| MOB-02 | Join the same ranked Battle queue | Both devices show the same match ID and first question. |
| MOB-03 | Submit answers from both devices | Each answer is accepted once and result appears on both devices. |
| MOB-04 | Tap answer twice quickly | Second answer is rejected; score is not duplicated. |
| MOB-05 | Lock the screen for 10–15 seconds during a question | App reconnects or shows a clear recoverable state; match state is restored. |
| MOB-06 | Switch Wi-Fi to mobile data during a question | Socket reconnects and current question/timer state is restored. |
| MOB-07 | Background then foreground the app | No duplicate player, match, answer, or reward is created. |
| MOB-08 | Force-stop one API replica in the test environment | Remaining replica continues the Battle; disconnected device can reconnect. |
| MOB-09 | Complete all 10 questions | Both devices show the same final result; each player receives one ranked reward. |
| MOB-10 | Repeat with Android and iOS roles reversed | Results remain consistent in both directions. |

## Pass criteria
- No unexplained disconnects, stuck loading states, duplicate answers, divergent question indexes, or different final scores.
- A reconnect restores the authoritative match state from the server.
- Database records show one finished match and one reward application per player.
- Capture screenshots/video and correlated API logs for every failure.

## Result record
For each check, record PASS / FAIL / NOT RUN, device details, timestamp, match ID, and evidence link. Do not mark a device test as passed based on simulator or Expo export alone.
