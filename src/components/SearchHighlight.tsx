import { searchTokens } from "@/lib/search";

function normalizedWithMap(value: string): { text: string; sourceIndexes: number[] } {
  let text = "";
  const sourceIndexes: number[] = [];
  [...value].forEach((character, sourceIndex) => {
    const normalized = character
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-ES");
    text += normalized;
    for (let index = 0; index < normalized.length; index += 1) sourceIndexes.push(sourceIndex);
  });
  return { text, sourceIndexes };
}

export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const tokens = searchTokens(query);
  if (!text || tokens.length === 0) return text;

  const characters = [...text];
  const highlighted = characters.map(() => false);
  const normalized = normalizedWithMap(text);

  for (const token of tokens) {
    let from = 0;
    while (from < normalized.text.length) {
      const match = normalized.text.indexOf(token, from);
      if (match < 0) break;
      const start = normalized.sourceIndexes[match];
      const end = normalized.sourceIndexes[match + token.length - 1];
      for (let index = start; index <= end; index += 1) highlighted[index] = true;
      from = match + token.length;
    }
  }

  const parts: Array<{ value: string; highlighted: boolean }> = [];
  characters.forEach((character, index) => {
    const active = highlighted[index];
    const last = parts.at(-1);
    if (last?.highlighted === active) last.value += character;
    else parts.push({ value: character, highlighted: active });
  });

  return parts.map((part, index) => part.highlighted
    ? <mark key={index} className="rounded bg-amber-300/45 px-0.5 text-inherit dark:bg-amber-400/30">{part.value}</mark>
    : <span key={index}>{part.value}</span>);
}

