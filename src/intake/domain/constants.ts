/** Each value has its reason from TP-03 "Settles without a choice". */
export const PAGE_SIZE = 100; // the largest page Kapso accepts: fewest requests against 100 per minute
export const OVERLAP_MS = 600_000; // five default periods; covers provider lag only
export const RUN_BUDGET_MS = 60_000; // one rate-limit window
export const CALLER_WAIT_MS = 20_000; // the 15-second request timeout plus 5 seconds to store; below the 60-second tool timeout
export const TELL_OWNER_AFTER_MS = 600_000; // five default periods of a refusal streak before an interruption is worth it
export const MAX_PAGES = 2_000; // 200,000 items per listing at 100 per page; 20 minutes of reading at 100 requests a minute
export const DEFAULT_PERIOD_MINUTES = 2; // FR-INTAKE-03-10
export const MIN_PERIOD_MINUTES = 1; // one listing, one message read and one outbound page is at least three requests per run (FR-INTAKE-03-21)
export const READ_RESERVE = 10; // 10 per cent of the limit, about three sends in the same minute
export const RATE_LIMIT_DEFAULT_WAIT_MS = 60_000; // a 429 with no Retry-After: the plan limit is counted per minute (TP-04)
export const CHAT_LOOKUP_WINDOW_MS = 86_400_000; // CatchUpChat with no stored conversation looks at the last 24 hours (TP-03)
export const PACE_MARGIN_MS = 1_000; // the Date header has whole-second resolution
export const MAX_PART = 4_000; // UTF-16 code units per sent part: Meta limits a body to 4096 characters and does not say how it counts, code units are never fewer than code points, 96 spare
export const SPLIT_LOOKBACK_UNITS = 500; // about the last line of a long paragraph; a part gains nothing by being shorter
export const OUTGOING_SKEW_MS = 120_000; // the provider stamps a message with its own clock; covers a laptop clock off by a minute plus the 15 s request timeout (same as Drafts TP-03)
