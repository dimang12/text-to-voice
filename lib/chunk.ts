const SENTENCE_END = /(?<=[.!?…]["')\]]?)\s+/;

/**
 * Split text into chunks no longer than maxLen, preferring sentence boundaries,
 * then falling back to whitespace, then to hard cuts.
 */
export function chunkText(text: string, maxLen: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= maxLen) return normalized ? [normalized] : [];

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of normalized.split(SENTENCE_END)) {
    if (sentence.length > maxLen) {
      push();
      for (const piece of splitLong(sentence, maxLen)) chunks.push(piece);
      continue;
    }
    if ((current + " " + sentence).trim().length > maxLen) push();
    current = current ? `${current} ${sentence}` : sentence;
  }
  push();
  return chunks;
}

function splitLong(text: string, maxLen: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(" ", maxLen);
    if (cut < maxLen / 2) cut = maxLen;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
