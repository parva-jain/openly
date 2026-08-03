// Mirrors openly/content_types.py — the type drives whether `mark` captures a
// session window by default. Keep values in sync with the Python enum.
export const CONTENT_TYPES = {
  progress_update: { sessionAnchored: true },
  origin_narrative: { sessionAnchored: false },
  learning_reflection: { sessionAnchored: false },
  concept_explainer: { sessionAnchored: false },
} as const;

export type ContentType = keyof typeof CONTENT_TYPES;

export function isContentType(value: string): value is ContentType {
  return value in CONTENT_TYPES;
}
export function isSessionAnchored(type: ContentType): boolean {
  return CONTENT_TYPES[type].sessionAnchored;
}
export function contentTypeNames(): string[] {
  return Object.keys(CONTENT_TYPES);
}
