import { FernBranch } from './BackgroundArt';

export default function CardFoliage() {
  const dotsGold1 = [[300, 20, 3.5], [330, 30, 2.5], [345, 45, 2], [318, 55, 2], [368, 100, 4], [372, 140, 3], [385, 175, 2.5], [355, 190, 2]];
  const dotsGold2 = [[40, 470, 3], [66, 460, 2.5], [30, 500, 4], [95, 535, 2.5], [70, 560, 3], [105, 575, 2], [90, 605, 5], [55, 610, 2.5], [120, 622, 3], [45, 630, 1.8]];
  const dotsRust = [[300, 468, 3], [320, 478, 2], [280, 500, 4], [295, 555, 2.5], [310, 568, 3], [325, 610, 2]];

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 660" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="goldLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2cd7c" />
          <stop offset="100%" stopColor="#b9822f" />
        </linearGradient>
        <linearGradient id="rustLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d69257" />
          <stop offset="100%" stopColor="#8a4420" />
        </linearGradient>
      </defs>

      <FernBranch x={398} y={66} rotate={215} scale={0.8} length={120} leafCount={5} fill="url(#goldLeaf)" stem="#a8763a" />
      {dotsGold1.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#c9873f" opacity="0.85" />)}

      <FernBranch x={2} y={658} rotate={48} scale={0.82} length={120} leafCount={5} fill="url(#goldLeaf)" stem="#a8763a" />
      {dotsGold2.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#c9873f" opacity="0.85" />)}

      <FernBranch x={398} y={658} rotate={-48} scale={0.78} length={110} leafCount={5} fill="url(#rustLeaf)" stem="#8a4420" />
      {dotsRust.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#8a4420" opacity="0.85" />)}
    </svg>
  );
}