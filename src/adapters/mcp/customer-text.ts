/** The one helper that labels customer text for the agent: `& < >` are escaped, in that order, so the text cannot close the label. */
export function customerText(label: string, text: string): string {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<${label}>${escaped}</${label}>`;
}
