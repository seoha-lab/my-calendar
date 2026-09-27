function rgb(hex: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Expected a six-digit hex color');
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((n) => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function contrastText(background: string): string {
  return contrastRatio(background, '#000000') >= contrastRatio(background, '#ffffff') ? '#000000' : '#ffffff';
}
export function eventColors(accent: string, dark = false) {
  const base = dark ? '#0f172a' : '#ffffff';
  const bg = '#' + rgb(accent).map((n, i) => Math.round(n * 0.18 + rgb(base)[i] * 0.82).toString(16).padStart(2, '0')).join('');
  return { background: bg, accent, text: contrastText(bg) };
}
