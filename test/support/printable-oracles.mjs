const letterMarkNumberPunctuationOrSymbol = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;
const defaultIgnorable = /^\p{Default_Ignorable_Code_Point}$/u;

export function runtimePrints(codePoint) {
  const character = String.fromCodePoint(codePoint);
  return codePoint === 0x20 || (letterMarkNumberPunctuationOrSymbol.test(character) && !defaultIgnorable.test(character));
}

export const drawingNoInk = [
  { codePoint: 0x2800, name: 'BRAILLE PATTERN BLANK', category: 'So', blankIn: 'CoreText with Menlo, and in Chromium, Firefox and WebKit' },
  { codePoint: 0xfffc, name: 'OBJECT REPLACEMENT CHARACTER', category: 'So', blankIn: 'CoreText with Menlo and in Chromium, while Firefox, and WebKit with the Noto fonts, draw a glyph for it' },
  { codePoint: 0x13441, name: 'EGYPTIAN HIEROGLYPH FULL BLANK', category: 'Lo', blankIn: 'Chromium, Firefox and WebKit with Noto Sans Egyptian Hieroglyphs, whose glyph is empty' },
  { codePoint: 0x13442, name: 'EGYPTIAN HIEROGLYPH HALF BLANK', category: 'Lo', blankIn: 'Chromium, Firefox and WebKit with Noto Sans Egyptian Hieroglyphs, whose glyph is empty' },
  { codePoint: 0x16fe4, name: 'KHITAN SMALL SCRIPT FILLER', category: 'Mn', blankIn: 'Chromium, Firefox and WebKit, alone and after a Khitan letter' },
  { codePoint: 0x11d45, name: 'MASARAM GONDI VIRAMA', category: 'Mn', blankIn: 'Chromium, Firefox and WebKit after a Masaram Gondi letter, and in Noto Sans Masaram Gondi' },
  { codePoint: 0x11d97, name: 'GUNJALA GONDI VIRAMA', category: 'Mn', blankIn: 'Chromium, Firefox and WebKit after a Gunjala Gondi letter, and in Noto Sans Gunjala Gondi' },
];
