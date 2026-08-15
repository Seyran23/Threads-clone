interface RingConfig {
  id: string;
  size: number;
  top: number;
  left: string;
  repeats: number;
  duration: number;
  reverse?: boolean;
}

const RINGS: RingConfig[] = [
  { id: 'a', size: 420, top: -260, left: '-6%', repeats: 9, duration: 72, reverse: true },
  { id: 'b', size: 520, top: -320, left: '2%', repeats: 12, duration: 95 },
  { id: 'c', size: 400, top: -245, left: '16%', repeats: 9, duration: 68, reverse: true },
  { id: 'd', size: 620, top: -380, left: '30%', repeats: 14, duration: 120 },
  { id: 'e', size: 360, top: -210, left: '46%', repeats: 8, duration: 58, reverse: true },
  { id: 'f', size: 500, top: -310, left: '58%', repeats: 11, duration: 88 },
  { id: 'g', size: 440, top: -270, left: '72%', repeats: 10, duration: 75, reverse: true },
  { id: 'h', size: 580, top: -355, left: '84%', repeats: 13, duration: 105 },
  { id: 'i', size: 380, top: -230, left: '96%', repeats: 9, duration: 62, reverse: true },
  { id: 'j', size: 460, top: -285, left: '108%', repeats: 10, duration: 80 },
];

function Ring({ id, size, repeats, duration, reverse }: RingConfig) {
  const radius = size / 2;
  const pathId = `thread-ring-path-${id}`;
  const text = Array.from({ length: repeats }, () => 'THREADS').join(' • ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="thread-ring absolute"
      style={{
        animationName: 'spin-ring',
        animationDuration: `${duration}s`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDirection: reverse ? 'reverse' : 'normal',
      }}
    >
      <defs>
        <path
          id={pathId}
          d={`M 0,${radius} a ${radius},${radius} 0 1,1 ${size},0 a ${radius},${radius} 0 1,1 ${-size},0`}
        />
      </defs>
      <text fill="oklch(0.4 0 0)" fontSize={size * 0.052} fontWeight={700} letterSpacing="0.06em">
        <textPath href={`#${pathId}`}>{text}</textPath>
      </text>
    </svg>
  );
}

export function ThreadRings() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"
    >
      {RINGS.map((ring) => (
        <div key={ring.id} style={{ position: 'absolute', top: ring.top, left: ring.left }}>
          <Ring {...ring} />
        </div>
      ))}
    </div>
  );
}
