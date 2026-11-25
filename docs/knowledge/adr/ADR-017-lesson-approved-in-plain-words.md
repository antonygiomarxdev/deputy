# ADR-017: A lesson is approved in plain words, by state

## Status
Accepted (2026-11-25)

## Summary

`keep_lesson` takes the proposal number as an argument.

## Context
Owner decision D27: the owner answers a lesson in their own words, not only "yes", with no number. The agent interprets the answer, learning how the owner speaks, and asks when in doubt. An answer that names no lesson approves only when exactly one lesson is waiting and the agent just asked about it; otherwise the agent asks which one. Deputy cannot read a "yes" in every language (D20), so the rule must rest on Deputy's own state. The Drafts number rule for sending drafts does not change. From TP-02 TD-5.

## Decision
- `keep_lesson` takes the proposal number as an argument. The owner's words need no number.
- It is accepted when the proposal is the only lesson proposal in state `waiting` and it was shown at most 10 minutes ago (`LESSON_ASK_WINDOW`). A reply in the same conversation comes within minutes, and after ten the question may be buried.
- Two or more waiting: refused with `which_lesson`, which lists each one's number, kind and wording. The owner's next words must then hold the chosen number.
- Shown longer ago: refused with `ask_again`; the agent shows it again.
- `change_lesson` and `delete_lesson` need the owner's words and no number.
- The words are still non-empty, at most 1000 characters, and equal neither the wording nor a stored customer message.
- A lesson has a `kind` (`currency`, `price`, `wording`, `other`) shown with the wording.

## Options considered
- Keep the number in the words: the friction the owner rejected.
- Read the words for a yes: a word list per language.

## Consequences
- Easier: the owner answers like in a conversation.
- Harder: a "yes" meant for something else within 10 minutes can keep the lesson. The wording was shown, the lesson can be edited or deleted, and the log holds the words.
- Watch: the agent must show each lesson alone when several wait.
