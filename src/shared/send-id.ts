export type SendId = string & { readonly __sendId: true };

export function parseSendId(raw: string): SendId | null {
  return raw.length >= 1 && raw.length <= 100 ? (raw as SendId) : null;
}
