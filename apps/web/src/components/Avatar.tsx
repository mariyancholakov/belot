/** A small animal drawn from the player's name, so everybody at the table has a look of their own. */

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BACKGROUNDS = ["#cfdcd3", "#e2d3bf", "#ccd4e2", "#e4cdcd", "#dcd9bb", "#d6c8dc", "#c5dadd", "#e8d9b0"];
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

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hash(name.trim().toLowerCase() || "?");
  const animal = ANIMALS[h % ANIMALS.length]!;
  const bg = BACKGROUNDS[(h >>> 5) % BACKGROUNDS.length]!;
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
      </g>
    </svg>
  );
}
