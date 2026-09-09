import type { TrendPoint } from '../types';

export function TrendChart({ data, compact = false }: { data: TrendPoint[]; compact?: boolean }) {
  if (data.length < 2) return <div className="chart-empty">차트 데이터가 충분하지 않습니다.</div>;
  const width = compact ? 150 : 720;
  const height = compact ? 46 : 240;
  const pad = compact ? 2 : 20;
  const values = data.map((point) => point.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const x = (index: number) => pad + (index / (data.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const d = data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.total)}`).join(' ');
  const area = `${d} L ${x(data.length - 1)} ${height - pad} L ${x(0)} ${height - pad} Z`;

  if (compact) {
    return (
      <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Star 증가 추세">
        <path className="spark-area" d={area} />
        <path className="spark-line" d={d} />
      </svg>
    );
  }

  const labels = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  return (
    <div className="trend-chart" role="img" aria-label="최근 30일 누적 Star 추이">
      <svg viewBox={`0 0 ${width} ${height}`}>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} className="chart-grid" x1={pad} x2={width - pad} y1={pad + (height - pad * 2) * ratio} y2={pad + (height - pad * 2) * ratio} />
        ))}
        <path className="chart-area" d={area} />
        <path className="chart-line" d={d} />
        {labels.map((index) => (
          <g key={index}>
            <circle className="chart-dot" cx={x(index)} cy={y(data[index].total)} r="4" />
            <text className="chart-label" x={x(index)} y={height - 2} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}>
              {new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(data[index].date))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
