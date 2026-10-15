/** A tough animal drawn from the player's name: shades, a gold chain, a hat or a cigar, so everybody at the table has a look of their own. */

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BACKGROUNDS = ["#2c2a30", "#3a2e29", "#25323b", "#3a2a33", "#2d382f", "#3b3526", "#33303f", "#2a2f36"];
const INK = "#2a211c";

type Draw = (v: number) => React.ReactNode;

const eyes = (y = 20, gap = 4.6) => (
  <>
    <circle cx={20 - gap} cy={y} r="1.35" fill={INK} />
    <circle cx={20 + gap} cy={y} r="1.35" fill={INK} />
  </>
);

const ANIMALS: Draw[] = [
  // bear
  (v) => {
    const fur = ["#8b5e3c", "#a8764d", "#6f4a30"][v % 3]!;
    return (
      <>
        <circle cx="11" cy="11.500" r="4.600" fill={fur} />
        <circle cx="29" cy="11.500" r="4.600" fill={fur} />
        <circle cx="11" cy="11.500" r="2.200" fill="#d9b48f" />
        <circle cx="29" cy="11.500" r="2.200" fill="#d9b48f" />
        <circle cx="20" cy="22.500" r="12.500" fill={fur} />
        <ellipse cx="20" cy="26.500" rx="6" ry="4.600" fill="#e6c9a8" />
        <ellipse cx="20" cy="24.600" rx="2.300" ry="1.600" fill={INK} />
        {eyes(20, 5.400)}
      </>
    );
  },
  // fox
  (v) => {
    const fur = ["#dd853a", "#e39a4e", "#c8692a"][v % 3]!;
    return (
      <>
        <polygon points="7.500,6 18,13.500 8,19.500" fill={fur} />
        <polygon points="32.500,6 22,13.500 32,19.500" fill={fur} />
        <polygon points="10,9.500 15.500,13.800 10.200,16.800" fill="#3a2a22" />
        <polygon points="30,9.500 24.500,13.800 29.800,16.800" fill="#3a2a22" />
        <ellipse cx="20" cy="23" rx="12.500" ry="11" fill={fur} />
        <path d="M7.800 25c3.600 1 7.800 7.800 12.200 7.800S28.600 26 32.200 25c-1.400 5.400-6.400 10-12.200 10S9.200 30.400 7.800 25z" fill="#f6ede0" />
        <circle cx="20" cy="29.600" r="1.700" fill={INK} />
        {eyes(21.500, 5)}
      </>
    );
  },
  // cat
  (v) => {
    const fur = ["#9b9b9b", "#caa57a", "#5f5f66"][v % 3]!;
    return (
      <>
        <polygon points="8,7 17,13 8.500,19" fill={fur} />
        <polygon points="32,7 23,13 31.500,19" fill={fur} />
        <polygon points="10,10.500 14.800,13.600 10.300,16.600" fill="#e3a9a9" />
        <polygon points="30,10.500 25.200,13.600 29.700,16.600" fill="#e3a9a9" />
        <ellipse cx="20" cy="23" rx="12.500" ry="11" fill={fur} />
        <polygon points="18.400,24.800 21.600,24.800 20,26.600" fill="#d98c8c" />
        <path d="M20 26.600v1.200M20 27.800q-1.600 1.400-3 .6M20 27.800q1.600 1.400 3 .6" stroke={INK} strokeWidth="0.800" fill="none" strokeLinecap="round" />
        <path d="M8 24.500l6 1M8 27.500l6-1M32 24.500l-6 1M32 27.500l-6-1" stroke={INK} strokeWidth="0.600" strokeLinecap="round" opacity="0.5" />
        {eyes(20.500, 5)}
      </>
    );
  },
  // rabbit
  (v) => {
    const fur = ["#efe8dd", "#d8c4ac", "#bdb5ad"][v % 3]!;
    return (
      <>
        <ellipse cx="14.500" cy="10" rx="3.600" ry="9" fill={fur} />
        <ellipse cx="25.500" cy="10" rx="3.600" ry="9" fill={fur} />
        <ellipse cx="14.500" cy="10.500" rx="1.700" ry="6.500" fill="#e8b4b4" />
        <ellipse cx="25.500" cy="10.500" rx="1.700" ry="6.500" fill="#e8b4b4" />
        <ellipse cx="20" cy="25" rx="11" ry="10" fill={fur} />
        <ellipse cx="20" cy="26.500" rx="1.700" ry="1.200" fill="#d98c8c" />
        <path d="M20 27.600v1.600M20 29.200q-1.400 1.200-2.600.4M20 29.200q1.400 1.200 2.600.4" stroke={INK} strokeWidth="0.700" fill="none" strokeLinecap="round" />
        <circle cx="13.800" cy="26.500" r="1.800" fill="#e8b4b4" opacity="0.6" />
        <circle cx="26.200" cy="26.500" r="1.800" fill="#e8b4b4" opacity="0.6" />
        {eyes(22, 4.800)}
      </>
    );
  },
  // owl
  (v) => {
    const fur = ["#a5774e", "#8a8f99", "#7d6a52"][v % 3]!;
    return (
      <>
        <polygon points="9,7 17,12.500 8.500,17" fill={fur} />
        <polygon points="31,7 23,12.500 31.500,17" fill={fur} />
        <ellipse cx="20" cy="22.500" rx="12.500" ry="12.500" fill={fur} />
        <circle cx="14.300" cy="20" r="5.200" fill="#f4ecdc" />
        <circle cx="25.700" cy="20" r="5.200" fill="#f4ecdc" />
        <circle cx="14.800" cy="20.300" r="2.400" fill={INK} />
        <circle cx="25.200" cy="20.300" r="2.400" fill={INK} />
        <polygon points="18,24.400 22,24.400 20,28.600" fill="#e5b13a" />
      </>
    );
  },
  // panda
  () => (
    <>
      <circle cx="11" cy="11.500" r="4.600" fill="#2a2522" />
      <circle cx="29" cy="11.500" r="4.600" fill="#2a2522" />
      <circle cx="20" cy="22.500" r="12.500" fill="#f4f0ea" />
      <ellipse cx="14.500" cy="20.500" rx="3.600" ry="4.300" fill="#2a2522" transform="rotate(20 14.500 20.500)" />
      <ellipse cx="25.500" cy="20.500" rx="3.600" ry="4.300" fill="#2a2522" transform="rotate(-20 25.500 20.500)" />
      <circle cx="14.800" cy="20.400" r="1.200" fill="#fff" />
      <circle cx="25.200" cy="20.400" r="1.200" fill="#fff" />
      <ellipse cx="20" cy="26" rx="2.200" ry="1.500" fill="#2a2522" />
    </>
  ),
  // frog
  (v) => {
    const skin = ["#86b46f", "#6fa38a", "#a2bd5e"][v % 3]!;
    return (
      <>
        <circle cx="12.500" cy="14" r="5.600" fill={skin} />
        <circle cx="27.500" cy="14" r="5.600" fill={skin} />
        <ellipse cx="20" cy="24.500" rx="13.500" ry="10.500" fill={skin} />
        <circle cx="12.500" cy="14" r="3.400" fill="#f4f1e4" />
        <circle cx="27.500" cy="14" r="3.400" fill="#f4f1e4" />
        <circle cx="12.800" cy="14.300" r="1.700" fill={INK} />
        <circle cx="27.200" cy="14.300" r="1.700" fill={INK} />
        <path d="M11.500 27.500q8.500 5.500 17 0" stroke={INK} strokeWidth="1.100" fill="none" strokeLinecap="round" />
        <circle cx="18.400" cy="23" r="0.700" fill={INK} />
        <circle cx="21.600" cy="23" r="0.700" fill={INK} />
      </>
    );
  },
];


/** Where each animal's eyes and mouth sit, so shades, brows and a cigar land on the right spot. */
const ANCHORS = [
  { eyeY: 20, mouthY: 27 },
  { eyeY: 21.5, mouthY: 29.5 },
  { eyeY: 20.5, mouthY: 27.5 },
  { eyeY: 22, mouthY: 28.5 },
  { eyeY: 20.3, mouthY: 27.5 },
  { eyeY: 20.5, mouthY: 26.5 },
  { eyeY: 14, mouthY: 28 },
];

const GOLD = "#d9a93a";

function Shades({ y, wide }: { y: number; wide: number }) {
  return (
    <>
      <path d={`M${20 - wide} ${y - 2.400}h${wide - 1.200}q0 5.200-3.200 5.200h-1q-3 0-3-3.200z`} fill="#0d0d10" />
      <path d={`M${20 + wide} ${y - 2.400}h-${wide - 1.200}q0 5.200 3.200 5.200h1q3 0 3-3.200z`} fill="#0d0d10" />
      <rect x={20 - 1.400} y={y - 1.800} width="2.800" height="1.100" fill="#0d0d10" />
      <path d={`M${20 - wide + 1.600} ${y - 1.200}l2.600 0`} stroke="#6f7480" strokeWidth="0.800" strokeLinecap="round" />
      <path d={`M${20 + 1.800} ${y - 1.200}l2.600 0`} stroke="#6f7480" strokeWidth="0.800" strokeLinecap="round" />
    </>
  );
}

function Brows({ y }: { y: number }) {
  return (
    <>
      <path d={`M10.500 ${y - 3.600}L17.600 ${y - 1.800}`} stroke={INK} strokeWidth="1.700" strokeLinecap="round" />
      <path d={`M29.500 ${y - 3.600}L22.400 ${y - 1.800}`} stroke={INK} strokeWidth="1.700" strokeLinecap="round" />
    </>
  );
}

function Hat({ kind }: { kind: number }) {
  if (kind === 0) {
    // fedora
    return (
      <>
        <ellipse cx="20" cy="11" rx="15" ry="3.200" fill="#17151a" />
        <path d="M11.500 10.500c0-6 2-8.800 8.500-8.800s8.500 2.800 8.500 8.800z" fill="#201d23" />
        <rect x="11.500" y="7.800" width="17" height="2.400" fill={GOLD} opacity="0.9" />
      </>
    );
  }
  if (kind === 1) {
    // snapback cap, bill to the side
    return (
      <>
        <path d="M10.500 12c0-6.800 4-9.600 9.500-9.600s9.500 2.800 9.500 9.600z" fill="#b23b34" />
        <path d="M18 12h17q-1 3.200-6 3.200H18z" fill="#8f2f2a" />
        <circle cx="20" cy="2.800" r="1.200" fill="#8f2f2a" />
      </>
    );
  }
  if (kind === 2) {
    // bandana
    return (
      <>
        <path d="M9.800 12.500c1-5.200 5.200-8.600 10.200-8.600s9.200 3.400 10.200 8.600c-3-1.600-6.400-2.400-10.200-2.400s-7.200.8-10.200 2.400z" fill="#1e1e22" />
        <path d="M11.500 8.500q8.500-3 17 0" stroke="#e8e3d8" strokeWidth="0.700" strokeDasharray="1.200 1.600" fill="none" />
        <path d="M29 11.500l5 1.500-3 2.600z" fill="#1e1e22" />
      </>
    );
  }
  // beanie
  return (
    <>
      <path d="M10.800 12.500c0-6.800 3.800-9.600 9.200-9.600s9.200 2.800 9.200 9.600z" fill="#3b3b44" />
      <rect x="10.200" y="10.500" width="19.600" height="3.200" rx="1.400" fill="#26262c" />
      <circle cx="20" cy="2.600" r="1.800" fill="#3b3b44" />
    </>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hash(name.trim().toLowerCase() || "?");
  const which = h % ANIMALS.length;
  const animal = ANIMALS[which]!;
  const { eyeY, mouthY } = ANCHORS[which]!;
  const bg = BACKGROUNDS[(h >>> 5) % BACKGROUNDS.length]!;
  const shades = ((h >>> 8) & 3) !== 0; // three in four wear shades, the rest glare
  const hat = (h >>> 10) % 5; // 0-3 a hat, 4 bareheaded
  const cigar = ((h >>> 14) & 3) < 2;
  const scar = ((h >>> 16) & 3) === 0 && !shades;
  const frog = which === 6;
  return (
    <svg className="avatar-img" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={`av-${h}`}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av-${h})`}>
        <rect width="40" height="40" fill={bg} />
        {animal((h >>> 11) % 3)}
        {scar && <path d={`M25 ${eyeY - 5}l-3.600 9`} stroke="#f0d9c8" strokeWidth="1" strokeLinecap="round" opacity="0.85" />}
        {shades ? <Shades y={eyeY} wide={frog ? 9.400 : 8.400} /> : <Brows y={eyeY} />}
        {cigar && (
          <>
            <path d={`M21 ${mouthY + 1}l10.500 -2.800`} stroke="#6b4a2c" strokeWidth="2" strokeLinecap="round" />
            <circle cx="31.800" cy={mouthY - 1.800} r="1.300" fill="#ee7a2e" />
            <path d={`M33.500 ${mouthY - 3.600}q2-2 0-4.200`} stroke="#d7d4d0" strokeWidth="0.800" fill="none" opacity="0.6" strokeLinecap="round" />
          </>
        )}
        {hat < 4 && <Hat kind={hat} />}
        <path d="M9.500 35.500q10.500 7 21 0" stroke={GOLD} strokeWidth="1.900" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="38" r="2.500" fill={GOLD} />
        <text x="20" y="39.200" fontSize="3.600" fontWeight="800" textAnchor="middle" fill="#7a5a10" fontFamily="system-ui, sans-serif">
          $
        </text>
      </g>
    </svg>
  );
}
