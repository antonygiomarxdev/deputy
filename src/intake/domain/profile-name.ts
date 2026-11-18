export const PROFILE_NAME_MAX_GRAPHEMES = 80; // D28: enough for a full name; a long name cannot push the excerpt out of view

export function cutProfileName(name: string): string {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(name)];
  return graphemes.length <= PROFILE_NAME_MAX_GRAPHEMES
    ? name
    : graphemes.slice(0, PROFILE_NAME_MAX_GRAPHEMES).map((s) => s.segment).join("");
}
