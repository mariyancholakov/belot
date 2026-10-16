/** The Белотче mark: a white card with "Б" and a heart as its corner index, in front of a navy card back with a thin gold frame. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g transform="translate(-2 -1)"><g transform="rotate(10 39 31)"><rect x="24" y="10" width="30" height="42" rx="4.5" fill="#22305E"/><rect x="27.2" y="13.2" width="23.6" height="35.6" rx="2.4" fill="none" stroke="#B8954A" strokeWidth="0.9"/></g><g transform="rotate(-8 27 35)"><rect x="12" y="14" width="30" height="42" rx="4.5" fill="#FFFFFF" stroke="#141414" strokeWidth="1.2"/><path d="M18 19.6H24M18 19.6V29.4M18 24.2H21.8a2.6 2.6 0 0 1 0 5.2H18" fill="none" stroke="#141414" strokeWidth="2.2" strokeLinejoin="round"/><path d="M20 33.6c-.75-1.35-3-1.2-3 .75 0 1.4 1.65 2.5 3 3.65 1.35-1.15 3-2.25 3-3.65 0-1.95-2.25-2.1-3-.75Z" fill="#C8202E"/><path d="M34.5 43c-1.25-2.25-5-1.9-5 1.25 0 2.35 2.75 4.15 5 6.1 2.25-1.95 5-3.75 5-6.1 0-3.15-3.75-3.5-5-1.25Z" fill="#C8202E"/></g></g>
    </svg>
  );
}
