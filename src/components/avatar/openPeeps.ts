/**
 * Open Peeps integration via DiceBear.
 *
 * DiceBear ships the official Open Peeps style at `9.x/open-peeps`. Each
 * `seed` string deterministically generates a unique illustrated character,
 * so we curate ~50 seeds for the picker gallery and store the seed (or the
 * full URL) on the user row.
 *
 * https://www.dicebear.com/styles/open-peeps/
 */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x/open-peeps/svg";

/** Build the SVG URL for a peep from a seed and optional size. */
export const peepUrlFromSeed = (seed: string, size = 192): string => {
  const params = new URLSearchParams({
    seed,
    size: String(size),
    radius: "50",
    backgroundType: "gradientLinear",
    backgroundColor:
      "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c7f0db,fef3c7,fde2e4,e0f2fe,fff1f2",
  });
  return `${DICEBEAR_BASE}?${params.toString()}`;
};

/** Extract the seed back out of a peep URL we previously generated. */
export const seedFromPeepUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url || !url.startsWith(DICEBEAR_BASE)) return null;
  try {
    const u = new URL(url);
    return u.searchParams.get("seed");
  } catch {
    return null;
  }
};

/**
 * Curated gallery: 50 diverse seeds. Names were picked to span ages,
 * styles, and accessories so the rendered set looks varied at a glance.
 * The user clicks one of these to "pick a peep" — we save the resulting
 * full URL on `avatar_url`.
 */
export const PEEPS_GALLERY_SEEDS: readonly string[] = Object.freeze([
  "Aria",
  "Leo",
  "Sage",
  "Mira",
  "Felix",
  "Nova",
  "Owen",
  "Ivy",
  "Caleb",
  "Luna",
  "Sasha",
  "Theo",
  "Maya",
  "Jonah",
  "Zara",
  "Eli",
  "Noor",
  "Aiden",
  "Sofia",
  "Diego",
  "Camila",
  "Mateo",
  "Isla",
  "Hugo",
  "Penny",
  "Oscar",
  "Hazel",
  "Wren",
  "Beck",
  "Juno",
  "Otis",
  "Lola",
  "Atlas",
  "Stella",
  "Reese",
  "Cleo",
  "Milo",
  "Ezra",
  "Sienna",
  "Kai",
  "Pearl",
  "Indigo",
  "Rio",
  "Onyx",
  "Daisy",
  "Quinn",
  "Sky",
  "Rowan",
  "Iris",
  "Phoenix",
]);

/**
 * Deterministic fallback peep when the user has neither uploaded a photo
 * nor picked one. Seeded off the record's stable identifier so the same
 * person always gets the same peep across the app.
 */
export const deterministicPeepUrl = (
  seedSource: string | number | null | undefined,
  size = 96,
): string => {
  const raw = String(seedSource ?? "").trim() || "nomi-default";
  return peepUrlFromSeed(raw, size);
};
