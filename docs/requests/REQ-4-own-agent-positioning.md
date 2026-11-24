# REQ-4: Each business's own agent, never a general assistant

Status: Open
Links: [Say it in the README, listing and tool instructions](https://github.com/antonygiomarxdev/deputy/issues/149), [Get written reads on provider and Meta terms](https://github.com/antonygiomarxdev/deputy/issues/144)

## Summary

Deputy is the agent of one business, using the owner's own AI subscription. It learns from the owner and takes what the owner hands it (a Google Sheet, for example). It is not a general-purpose assistant. Prompt injection must be stated clearly (REQ-5).

Last change: 2026-11-24, first draft from the owner's words

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
> lo que se quiere con esto es que vos tengas tu propio agente de IA para tu negocio, no algo como que funcione de manera general. Y de hecho tenemos que tener ahí bien claro el tema de prompt injection

> vos tenés tu suscripción de Claude o de ChatGPT o la que sea, tenés tu negocio, no tenés tiempo de estarle contestando a todos y te apoyas en deputy para hacer para contestar y él aprende de lo que vos le decís y vos le puedes pasar lo que necesites, es decir, si necesitas un Google Sheet, le pasas el Google Sheet

## The problem behind it
The owner has no time to answer every customer. The product must say plainly what it is, for the owner and for Meta's rules on AI providers.

## Evidence
Meta's terms section 4.7 target AI providers whose AI is the primary offering. A business using its own agent looks out of scope, but Meta decides at its sole discretion. A written read from Kapso, Anthropic and OpenAI is not yet obtained (research, 2026-11-24).

## Decision
Open. Waits for the owner.
