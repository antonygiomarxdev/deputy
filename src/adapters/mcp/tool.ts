import { z } from "zod";

export interface ToolResult {
  readonly text: string;
  readonly structured: Readonly<Record<string, unknown>>;
  readonly isError: boolean;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodRawShape;
  /** Already validated by `defineTool`; a bad input returns `isError: true` with the zod message. */
  run(args: unknown): Promise<ToolResult>;
}

export function defineTool<S extends z.ZodRawShape>(d: {
  name: string;
  description: string;
  input: S;
  run(args: z.infer<z.ZodObject<S>>): Promise<ToolResult>;
}): ToolDefinition {
  const schema = z.object(d.input);
  return {
    name: d.name,
    description: d.description,
    input: d.input,
    async run(args) {
      const parsed = schema.safeParse(args);
      if (!parsed.success) return { text: parsed.error.message, structured: {}, isError: true };
      return d.run(parsed.data);
    },
  };
}
