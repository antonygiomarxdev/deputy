import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "./config.js";

export type Author = "customer" | "deputy" | "owner" | "owner_app";
export interface Entry { t: string; from: Author; text: string }

/** Per-chat history (JSONL) and state (pauses, seen IDs). Lives in data/, outside Claude's context. */
export class Conversations {
  private dir = resolve(config.dataDir, "conversations");
  private statePath = resolve(config.dataDir, "state.json");
  private state: { paused: Record<string, number | null>; seen: string[] } = { paused: {}, seen: [] };

  constructor() {
    mkdirSync(this.dir, { recursive: true });
    if (existsSync(this.statePath)) {
      try { this.state = { ...this.state, ...JSON.parse(readFileSync(this.statePath, "utf8")) }; } catch {}
    }
  }

  private save() {
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  private file(chat: string) {
    return resolve(this.dir, `${chat.replace(/[^\d]/g, "") || "unknown"}.jsonl`);
  }

  /** true if this message was already processed (Meta retries webhooks). */
  seen(id: string): boolean {
    if (this.state.seen.includes(id)) return true;
    this.state.seen.push(id);
    if (this.state.seen.length > 1000) this.state.seen = this.state.seen.slice(-500);
    this.save();
    return false;
  }

  add(chat: string, from: Author, text: string) {
    appendFileSync(this.file(chat), JSON.stringify({ t: new Date().toISOString(), from, text } satisfies Entry) + "\n");
  }

  history(chat: string, limit = 20): Entry[] {
    const f = this.file(chat);
    if (!existsSync(f)) return [];
    return readFileSync(f, "utf8").trim().split("\n").filter(Boolean).slice(-limit).map((l) => JSON.parse(l));
  }

  /** Pause Deputy in a chat. `minutes` null = until resumed by hand. */
  pause(chat: string, minutes: number | null) {
    this.state.paused[chat] = minutes === null ? null : Date.now() + minutes * 60_000;
    this.save();
  }

  resume(chat: string) {
    delete this.state.paused[chat];
    this.save();
  }

  isPaused(chat: string): boolean {
    if (!(chat in this.state.paused)) return false;
    const until = this.state.paused[chat];
    if (until !== null && until < Date.now()) {
      this.resume(chat);
      return false;
    }
    return true;
  }

  pausedNow(): string[] {
    return Object.keys(this.state.paused).filter((c) => this.isPaused(c));
  }
}
