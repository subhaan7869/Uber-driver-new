# Security Specification — Uber Driver UK Firestore Rules

## 1. Data Invariants

1. **Strict Ownership & Email Verification Gate**:
   - Every user document (`/users/{userId}`) and subcollection document (`/users/{userId}/state/{stateId}`, `/users/{userId}/trips/{tripId}`, `/users/{userId}/activity/{activityId}`, `/users/{userId}/reserves/{reserveId}`) belongs exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
   - Unauthenticated requests and unverified tokens (`email_verified != true`) are denied across all paths.
2. **PII Isolation & Zero Blanket Reads**:
   - No `allow read: if isSignedIn();` rules exist anywhere.
   - `list` operations on `/users` are completely disabled (`allow list: if false;`), and subcollection `allow list` rules explicitly enforce `resource.data.ownerUid == request.auth.uid` without `get()` or `exists()`.
3. **Document ID Hardening (`isValidId`)**:
   - Every single-document target ID (`userId`, `stateId`, `tripId`, `activityId`, `reserveId`) must match `^[a-zA-Z0-9_\\-]+$` and `.size() <= 128`.
4. **Immutable Ownership & Temporal Integrity**:
   - `uid` / `ownerUid` must equal `request.auth.uid` on create and remain identical on update.
   - `createdAt` must equal `request.time` on create and remain immutable on update.
   - `updatedAt` must equal `request.time` on both create and update.
5. **Action-Based Updates & Terminal State Locking**:
   - `/users/{userId}` and `/users/{userId}/state/{stateId}` updates validate the entire payload with `isValid*()` and restrict modified keys via `affectedKeys().hasOnly(...)`.
   - `/users/{userId}/reserves/{reserveId}` locks once `status` reaches `'completed'` or `'cancelled'`.
   - `/users/{userId}/trips/{tripId}` and `/users/{userId}/activity/{activityId}` are append-only (`allow update: if false;`).

## 2. The "Dirty Dozen" Attack Payloads (All Expected: `PERMISSION_DENIED`)

1. **Unauthenticated Profile Read (`GET /users/uid_1`)**: `auth = null` -> Denied by `isVerifiedUser()`.
2. **Unverified Email Spoof (`CREATE /users/uid_1`)**: `auth = { uid: 'uid_1', token: { email_verified: false } }` -> Denied by `isVerifiedUser()`.
3. **Cross-Tenant Read (`GET /users/victim_uid/state/driver_ledger`)**: `auth = { uid: 'attacker_uid', token: { email_verified: true } }` -> Denied by `isOwner(userId)`.
4. **Identity Spoofing (`CREATE /users/uid_1/trips/trip_1`)**: `ownerUid: 'other_uid'` while authenticated as `uid_1` -> Denied by `isValidCompletedTripRecord()`.
5. **Ghost Field / Shadow Update (`UPDATE /users/uid_1`)**: Adding unexpected key `isAdmin: true` -> Denied by `hasOnly(...)` / `affectedKeys().hasOnly(...)`.
6. **ID Poisoning (`CREATE /users/uid_1/trips/' + 'x'.repeat(300)`)**: Path ID exceeds 128 chars or contains invalid characters -> Denied by `isValidId(tripId)`.
7. **Timestamp Forgery (`CREATE /users/uid_1/activity/act_1`)**: Client supplies arbitrary past `createdAt` instead of `request.time` -> Denied by `data.createdAt == request.time`.
8. **Immortal Field Mutation (`UPDATE /users/uid_1/state/driver_ledger`)**: Changing `createdAt` or `ownerUid` -> Denied by immutability check.
9. **Type / Bounds Exhaustion (`CREATE /users/uid_1/trips/trip_1`)**: 1MB string in `pickupArea` or negative `fare: -50` -> Denied by size & numeric bounds checks.
10. **Terminal State Bypass (`UPDATE /users/uid_1/reserves/res_1`)**: Attempting to change `status` from `'completed'` back to `'scheduled'` -> Denied by terminal lock `!isTerminalReserveStatus(existing().status)`.
11. **Collection Enumeration (`LIST /users`)**: Querying `/users` to scrape emails -> Denied by `allow list: if false;`.
12. **Unfiltered Subcollection List (`LIST /users/victim_uid/trips`)**: Attempting list without matching `ownerUid == request.auth.uid` -> Denied by `resource.data.ownerUid == request.auth.uid`.
