import { serve } from "./main/serve";

const command = process.argv[2];
if (command !== "serve") {
  console.error(`deputy: unknown command '${command ?? ""}'; only 'serve' is available`);
  process.exit(2);
}
process.exit(await serve());
