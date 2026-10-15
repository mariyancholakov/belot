/** A small face drawn from the player's name, so everybody at the table has a look of their own. */

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BACKGROUNDS = ["#c9d6cf", "#d9c9b6", "#c6cfdc", "#dcc6c6", "#d5d2b4", "#cfc0d6", "#bfd3d6", "#e0d0a8"];
const SHIRTS = ["#5f6b66", "#8a6f5e", "#566478", "#8a5a56", "#6e6a4e", "#6d5a78", "#4f6f73", "#9a7b3c"];
const SKINS = ["#f3d3b8", "#e6b996", "#d49b74", "#b97a56", "#8d5a3c", "#6b4430"];
const HAIRS = ["#2a211c", "#4a3326", "#7a5232", "#b58a4c", "#8e8a86", "#a4442f"];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hash(name.trim().toLowerCase() || "?");
  const pick = <T,>(list: readonly T[], shift: number): T => list[(h >>> shift) % list.length]!;
  const bg = pick(BACKGROUNDS, 0);
  const shirt = pick(SHIRTS, 3);
  const skin = pick(SKINS, 6);
  const hair = pick(HAIRS, 9);
  const style = (h >>> 12) % 5;
  const mouth = (h >>> 16) % 3;
  return (
    <svg className="avatar-img" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={`av-${h}`}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av-${h})`}>
        <rect width="40" height="40" fill={bg} />
        {style === 1 && <ellipse cx="20" cy="19" rx="10.5" ry="12" fill={hair} />}
        <ellipse cx="20" cy="40" rx="15" ry="10" fill={shirt} />
        <rect x="17" y="24" width="6" height="7" rx="2" fill={skin} />
        {style === 4 && <circle cx="20" cy="8" r="4" fill={hair} />}
        <circle cx="20" cy="18" r="8.2" fill={skin} />
        {style === 0 && <path d="M11.6 17c0-6 3.6-9 8.4-9s8.4 3 8.4 9c-2-3-5-4.5-8.4-4.5S13.6 14 11.6 17z" fill={hair} />}
        {style === 1 && <path d="M11.4 18c0-6.2 3.6-9.6 8.6-9.6s8.6 3.400 8.600 9.600c-1.800-3.800-5-5.200-8.600-5.200S13.200 14.200 11.400 18z" fill={hair} />}
        {style === 3 && <path d="M11.8 17.5c.4-5.600 3.800-9 8.400-9 4.200 0 7.600 2.600 8 7-3.200-.2-6.600-2.400-8.600-4.600-.8 3.200-3.800 5.400-7.800 6.600z" fill={hair} />}
        {style === 4 && <path d="M11.8 16.5c.6-4.800 3.800-7.600 8.200-7.600s7.600 2.800 8.200 7.600c-2.400-2.600-5-3.600-8.200-3.600s-5.800 1-8.200 3.600z" fill={hair} />}
        <circle cx="16.800" cy="18.400" r="1.050" fill="#2a211c" />
        <circle cx="23.200" cy="18.400" r="1.050" fill="#2a211c" />
        {mouth === 0 && <path d="M17.200 21.800q2.800 2.200 5.600 0" stroke="#2a211c" strokeWidth="1.100" strokeLinecap="round" fill="none" />}
        {mouth === 1 && <path d="M17.600 22h4.800" stroke="#2a211c" strokeWidth="1.100" strokeLinecap="round" fill="none" />}
        {mouth === 2 && <ellipse cx="20" cy="22.200" rx="1.800" ry="1.200" fill="#8a3b34" />}
      </g>
    </svg>
  );
}
