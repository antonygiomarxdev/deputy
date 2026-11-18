export class StaleDraft extends Error {
  constructor(readonly draft: number) {
    super(`draft ${draft} changed`);
  }
}

export class LeaseLost extends Error {
  constructor() {
    super("lease lost");
  }
}

export class LogUnavailable extends Error {
  constructor(cause?: unknown) {
    super("drafts log unavailable", { cause });
  }
}
