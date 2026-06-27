import type { ReactNode } from "react";

export function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let index = lowerText.indexOf(lowerQuery);

  while (index !== -1) {
    if (index > start) {
      parts.push(text.slice(start, index));
    }
    parts.push(
      <mark
        key={`${index}-${lowerQuery}`}
        className="bg-[#5b2eff]/35 text-[#dcd4ff] rounded px-0.5 font-bold"
      >
        {text.slice(index, index + lowerQuery.length)}
      </mark>
    );
    start = index + lowerQuery.length;
    index = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return <>{parts}</>;
}
