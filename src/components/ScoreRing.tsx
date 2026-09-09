export function ScoreRing({ score, label = 'Early Signal', size = 78 }: { score: number; label?: string; size?: number }) {
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(score, 100)) / 100) * circumference;
  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }} aria-label={`${label} ${score}점`}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle className="score-ring-track" cx="36" cy="36" r={radius} />
        <circle className="score-ring-value" cx="36" cy="36" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="score-ring-text"><strong>{score}</strong><span>/100</span></div>
    </div>
  );
}
