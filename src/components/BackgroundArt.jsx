export function FernBranch({ x, y, rotate = 0, scale = 1, length = 180, leafCount = 5, fill, stem, opacity = 1 }) {
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = (i + 1) / (leafCount + 1);
    const side = i % 2 === 0 ? 1 : -1;
    const dist = t * length;
    const leafScale = 0.3 + 0.14 * Math.sin(t * Math.PI * 0.95);
    const rot = 180 + side * 34;
    return { dist, rot, leafScale, key: i };
  });

  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
      <path
        d={`M0,0 Q${length * 0.12},${-length * 0.5} 0,${-length}`}
        stroke={stem}
        strokeWidth="2"
        fill="none"
        opacity="0.75"
      />
      {leaves.map((l) => (
        <g key={l.key} transform={`translate(0,${-l.dist}) rotate(${l.rot}) scale(${l.leafScale})`}>
          <path d="M0,0 C20,22 26,55 0,100 C-26,55 -20,22 0,0 Z" fill={fill} />
        </g>
      ))}
    </g>
  );
}

function generateDesktopBranches() {
  const branches = [];
  const cols = 10;
  const rows = 6;
  const usableW = 1376;
  const usableH = 768;

  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellCx = (c + 0.5) * (usableW / cols);
      const cellCy = (r + 0.5) * (usableH / rows);

      // lightly thin out the zone under the login card; skip occasionally,
      // most cells still get a branch so coverage stays full elsewhere
      const inCardZone =
        cellCx > 480 && cellCx < 900 && cellCy > 100 && cellCy < 670;
      if (inCardZone && rand() > 0.5) continue;

      const jitterX = (rand() - 0.5) * (usableW / cols) * 0.9;
      const jitterY = (rand() - 0.5) * (usableH / rows) * 0.9;

      branches.push({
        x: cellCx + jitterX,
        y: cellCy + jitterY,
        rotate: Math.round(rand() * 360),
        scale: 0.9 + rand() * 0.9,
        length: 130 + rand() * 100,
        leafCount: 5 + Math.round(rand() * 3),
      });
    }
  }
  return branches;
}

const SHADOW_BRANCHES = generateDesktopBranches();

function generateMobileBranches() {
  const branches = [];
  const cols = 6;
  const rows = 9;
  const usableW = 400;
  const usableH = 844;

  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellCx = (c + 0.5) * (usableW / cols);
      const cellCy = (r + 0.5) * (usableH / rows);

      // only lightly thin out the zone directly under the opaque card,
      // and only skip occasionally — most cells still get a branch
      const inCardZone =
        cellCx > 50 && cellCx < 350 && cellCy > 160 && cellCy < 700;
      if (inCardZone && rand() > 0.6) continue;

      const jitterX = (rand() - 0.5) * (usableW / cols) * 0.9;
      const jitterY = (rand() - 0.5) * (usableH / rows) * 0.9;

      branches.push({
        x: cellCx + jitterX,
        y: cellCy + jitterY,
        rotate: Math.round(rand() * 360),
        scale: 0.7 + rand() * 0.6,
        length: 110 + rand() * 90,
        leafCount: 5 + Math.round(rand() * 3),
      });
    }
  }
  return branches;
}

const MOBILE_SHADOW_BRANCHES = generateMobileBranches();

export default function BackgroundArt() {
  return (
    <>
      {/* Desktop / tablet — now generated across the full canvas */}
      <svg
        className="hidden sm:block pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1376 768"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <filter id="shadowBlurDesktop">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <g filter="url(#shadowBlurDesktop)" opacity="0.6">
          {SHADOW_BRANCHES.map((b, i) => (
            <FernBranch key={i} {...b} fill="#8d7f68" stem="#8d7f68" />
          ))}
        </g>
        <circle cx="992" cy="445" r="4" fill="#c9873f" opacity="0.7" />
        <circle cx="1008" cy="462" r="3" fill="#c9873f" opacity="0.7" />
        <circle cx="978" cy="470" r="2.5" fill="#a8763a" opacity="0.7" />
        
      </svg>

      {/* Mobile — darker, denser, covers the whole background */}
      <svg
        className="sm:hidden pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 400 844"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <filter id="shadowBlurMobile">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g filter="url(#shadowBlurMobile)" opacity="0.7">
          {MOBILE_SHADOW_BRANCHES.map((b, i) => (
            <FernBranch key={i} {...b} fill="#5f5240" stem="#5f5240" />
          ))}
        </g>
      </svg>
    </>
  );
}