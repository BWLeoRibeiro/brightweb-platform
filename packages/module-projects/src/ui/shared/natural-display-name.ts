const LOWERCASE_NAME_PARTICLES = new Set(["a", "as", "da", "das", "de", "do", "dos", "e", "em"]);

/**
 * Normalizes legacy all-caps names for display without altering intentionally
 * mixed-case brands such as BSCork or iServices. Short uppercase words remain
 * acronyms, while Portuguese name particles stay lowercase.
 */
export function formatNaturalDisplayName(value: string, locale = "pt-PT"): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const letters = Array.from(trimmed).filter((character) => (
    character.toLocaleLowerCase(locale) !== character.toLocaleUpperCase(locale)
  ));
  const isAllUppercase = letters.length > 0 && letters.every((character) => (
    character === character.toLocaleUpperCase(locale)
  ));
  if (!isAllUppercase) return trimmed;

  let wordIndex = 0;
  return trimmed.replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
    const lower = word.toLocaleLowerCase(locale);
    const currentIndex = wordIndex++;
    if (currentIndex > 0 && LOWERCASE_NAME_PARTICLES.has(lower)) return lower;
    if (Array.from(word).length <= 3 && !LOWERCASE_NAME_PARTICLES.has(lower)) {
      return word.toLocaleUpperCase(locale);
    }
    const [first = "", ...rest] = Array.from(lower);
    return `${first.toLocaleUpperCase(locale)}${rest.join("")}`;
  });
}
