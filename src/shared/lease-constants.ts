export const LEASE_RENEW_MS = 10_000; // a renewal is one tiny write; six a minute cost nothing
export const LEASE_TTL_MS = 30_000; // three renewals: a stall of 20 s does not lose the lease
