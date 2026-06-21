// Deterministic "critter" avatar generated from a guest id — every guest gets
// a distinct, colorful face with no binary asset files and no network call.
const PALETTES: readonly [string, string][] = [
  ["#FDE68A", "#F59E0B"], // sand
  ["#A7F3D0", "#10B981"], // palm
  ["#BFDBFE", "#3B82F6"], // lagoon
  ["#FBCFE8", "#EC4899"], // coral
  ["#DDD6FE", "#8B5CF6"], // dusk
  ["#FCA5A5", "#EF4444"], // hibiscus
];

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

export function getAvatarDataUri(seed: string): string {
  const hash = hashSeed(seed || "guest");
  const [skin, accent] = PALETTES[hash % PALETTES.length];
  const hasEars = Math.floor(hash / 8) % 2 === 0;
  const hasBlush = Math.floor(hash / 32) % 2 === 0;
  const eyeSpacing = 8 + (Math.floor(hash / 128) % 4);
  const smiling = Math.floor(hash / 512) % 2 === 0;
  const mouthY = smiling ? 62 : 46;

  const ears = hasEars
    ? `<path d="M20 24 L12 6 L30 17 Z" fill="${skin}"/><path d="M80 24 L88 6 L70 17 Z" fill="${skin}"/>`
    : "";

  const blush = hasBlush
    ? `<circle cx="${50 - eyeSpacing - 7}" cy="60" r="5" fill="${accent}" opacity="0.35"/><circle cx="${50 + eyeSpacing + 7}" cy="60" r="5" fill="${accent}" opacity="0.35"/>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    ears +
    `<circle cx="50" cy="52" r="38" fill="${skin}"/>` +
    `<circle cx="50" cy="52" r="38" fill="none" stroke="${accent}" stroke-width="3" opacity="0.5"/>` +
    blush +
    `<circle cx="${50 - eyeSpacing}" cy="48" r="4.5" fill="#1f2937"/>` +
    `<circle cx="${50 + eyeSpacing}" cy="48" r="4.5" fill="#1f2937"/>` +
    `<path d="M${50 - 9} 52 Q50 ${mouthY} ${50 + 9} 52" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
