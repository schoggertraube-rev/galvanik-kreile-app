export type TextHighlight = {
  word: string;
  type: "kunde" | "auftrag" | "material" | "thema" | "zeit" | "aktion";
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildHighlightedHtml(text: string, highlights: TextHighlight[]): string {
  if (!text || highlights.length === 0) return escapeHtml(text);
  const matches: Array<{ start: number; end: number; type: TextHighlight["type"] }> = [];
  for (const highlight of highlights) {
    if (!highlight.word) continue;
    const pattern = highlight.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(pattern, "gi");
    for (const match of text.matchAll(regex)) {
      if (match.index !== undefined && match[0].length > 0) {
        matches.push({ start: match.index, end: match.index + match[0].length, type: highlight.type });
      }
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  let cursor = 0;
  let html = "";
  for (const match of matches) {
    if (match.start < cursor) continue;
    html += escapeHtml(text.slice(cursor, match.start));
    html += `<mark class="${match.type}">${escapeHtml(text.slice(match.start, match.end))}</mark>`;
    cursor = match.end;
  }
  return html + escapeHtml(text.slice(cursor));
}
