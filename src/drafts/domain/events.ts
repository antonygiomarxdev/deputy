import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { DraftKind, DraftNumber } from "./draft";

type Base = { readonly draft: DraftNumber; readonly draftKind: DraftKind; readonly chat: ChatId; readonly at: Instant };

export type DraftEvent =
  | (Base & { readonly type: "DraftProposed"; readonly text: string; readonly answersMessageId: string | null })
  | (Base & { readonly type: "DraftReplaced"; readonly replacedBy: DraftNumber })
  | (Base & { readonly type: "TextChanged"; readonly proposedText: string; readonly newText: string; readonly ownerWords: string })
  | (Base & { readonly type: "DraftRejected"; readonly ownerWords: string })
  | (Base & { readonly type: "ApprovalVoided"; readonly reason: "changed" | "replaced" | "rejected" | "held"; readonly approvalId: string; readonly sendId: string })
  | (Base & { readonly type: "Approved"; readonly approvalId: string; readonly sendId: string; readonly proposedText: string; readonly text: string; readonly ownerWords: string })
  | (Base & { readonly type: "SendStarted"; readonly sendId: string; readonly text: string })
  | (Base & { readonly type: "DraftSent"; readonly sendId: string; readonly text: string; readonly reason: string | null })
  | (Base & { readonly type: "OrderRecorded"; readonly orderId: string })
  | (Base & { readonly type: "SendFailed"; readonly reason: string })
  | (Base & { readonly type: "OutcomeUnknown"; readonly reason: string });
