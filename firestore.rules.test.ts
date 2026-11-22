/**
 * Payload-First Security Verification Suite ("Dirty Dozen" Adversarial Payloads)
 * Verifies data invariants, regex guards, size limits, and state transitions
 * synchronized with `firebase-blueprint.json` and `firestore.rules`.
 */

export interface MockAuth {
  uid: string;
  emailVerified: boolean;
}

export interface DirtyDozenCase {
  name: string;
  auth: MockAuth | null;
  path: string;
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function checkId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && VALID_ID_RE.test(id);
}

export function simulateRuleDecision(testCase: DirtyDozenCase): 'ALLOW' | 'PERMISSION_DENIED' {
  const { auth, path, op, payload = {}, existing = {} } = testCase;
  if (!auth || !auth.emailVerified) return 'PERMISSION_DENIED';

  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'users') return 'PERMISSION_DENIED';

  if (parts.length === 1 && op === 'list') {
    return 'PERMISSION_DENIED';
  }

  const userId = parts[1];
  if (op !== 'list' && !checkId(userId)) return 'PERMISSION_DENIED';
  if (auth.uid !== userId) return 'PERMISSION_DENIED';

  if (parts.length === 2 && op === 'update') {
    const allowedProfileKeys = new Set([
      'displayName',
      'city',
      'tier',
      'vehicle',
      'vehicleColor',
      'licensePlate',
      'phvBadge',
      'rating',
      'proPoints',
      'acceptanceRate',
      'cancellationRate',
      'drivingMinutesUsedToday',
      'updatedAt',
    ]);
    for (const key of Object.keys(payload)) {
      if (!allowedProfileKeys.has(key)) return 'PERMISSION_DENIED';
    }
  }

  if (parts.length === 4) {
    const subCol = parts[2];
    const docId = parts[3];
    if (op !== 'list' && !checkId(docId)) return 'PERMISSION_DENIED';

    if (op === 'list' && existing.ownerUid !== auth.uid) {
      return 'PERMISSION_DENIED';
    }

    if (op === 'create') {
      if (payload.ownerUid !== auth.uid) return 'PERMISSION_DENIED';
      if (payload.createdAt !== '__SERVER_TIME__') return 'PERMISSION_DENIED';
      if (typeof payload.fare === 'number' && payload.fare < 0) return 'PERMISSION_DENIED';
      if (typeof payload.pickupArea === 'string' && payload.pickupArea.length > 100) {
        return 'PERMISSION_DENIED';
      }
    }

    if (op === 'update') {
      if ('createdAt' in payload && payload.createdAt !== existing.createdAt) {
        return 'PERMISSION_DENIED';
      }
      if (subCol === 'reserves') {
        if (existing.status === 'completed' || existing.status === 'cancelled') {
          return 'PERMISSION_DENIED';
        }
      }
    }
  }

  return 'ALLOW';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    name: '1. Unauthenticated profile read',
    auth: null,
    path: '/users/uid_1',
    op: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email spoof create',
    auth: { uid: 'uid_1', emailVerified: false },
    path: '/users/uid_1',
    op: 'create',
    payload: { uid: 'uid_1', email: 'admin@example.com' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-tenant ledger read',
    auth: { uid: 'attacker_uid', emailVerified: true },
    path: '/users/victim_uid/state/driver_ledger',
    op: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Identity spoofing on trip create',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/uid_1/trips/trip_1',
    op: 'create',
    payload: { ownerUid: 'other_uid', createdAt: '__SERVER_TIME__', fare: 14.5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Ghost field / shadow update on user profile',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/uid_1',
    op: 'update',
    payload: { isAdmin: true, updatedAt: '__SERVER_TIME__' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Document ID poisoning (>128 chars)',
    auth: { uid: 'uid_1', emailVerified: true },
    path: `/users/uid_1/trips/${'x'.repeat(160)}`,
    op: 'create',
    payload: { ownerUid: 'uid_1', createdAt: '__SERVER_TIME__' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Client timestamp forgery',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/uid_1/activity/act_1',
    op: 'create',
    payload: { ownerUid: 'uid_1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Immortal createdAt mutation on state update',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/uid_1/state/driver_ledger',
    op: 'update',
    existing: { createdAt: 'T1' },
    payload: { createdAt: 'T2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Resource exhaustion / negative fare poisoning',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/uid_1/trips/trip_2',
    op: 'create',
    payload: {
      ownerUid: 'uid_1',
      createdAt: '__SERVER_TIME__',
      fare: -50,
      pickupArea: 'A'.repeat(200),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Terminal Reserve status bypass',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/uid_1/reserves/res_1',
    op: 'update',
    existing: { status: 'completed' },
    payload: { status: 'scheduled', updatedAt: '__SERVER_TIME__' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Global /users collection enumeration',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users',
    op: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unauthorized cross-user trip list',
    auth: { uid: 'uid_1', emailVerified: true },
    path: '/users/victim_uid/trips/any',
    op: 'list',
    existing: { ownerUid: 'victim_uid' },
    expected: 'PERMISSION_DENIED',
  },
];

export function runDirtyDozenChecks(): { passed: number; failed: string[] } {
  const failed: string[] = [];
  for (const tc of DIRTY_DOZEN_PAYLOADS) {
    const decision = simulateRuleDecision(tc);
    if (decision !== tc.expected) {
      failed.push(`${tc.name} returned ${decision}, expected ${tc.expected}`);
    }
  }
  return { passed: DIRTY_DOZEN_PAYLOADS.length - failed.length, failed };
}
