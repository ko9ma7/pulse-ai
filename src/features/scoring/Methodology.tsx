import { ArrowLeft } from 'lucide-react';
import { goHome } from '../../hooks/useHashRoute';

const weights = [
  ['7일 Star 증가속도', 35, '현재 Star 대비 최근 7일 증가율을 로그/상한 처리해 비교합니다.'],
  ['증가 가속도', 20, '이전 7일 대비 최근 7일 Star 증가량이 얼마나 빨라졌는지 봅니다.'],
  ['최근 활동', 15, '최근 push와 release 시점을 이용해 유지보수 활성을 반영합니다.'],
  ['프로젝트 신선도', 10, '생성된 지 얼마 되지 않은 프로젝트에 더 높은 초기 신호를 줍니다.'],
  ['README 완성도', 10, '설명·topics·license·homepage 등 공개 메타데이터를 완성도 신호로 사용합니다.'],
  ['직접 테스트 가능성', 10, '언어·설치 단서·프로젝트 유형을 이용해 빠른 재현 가능성을 추정합니다.'],
] as const;

export function Methodology() {
  return <div className="page method-page"><button className="back-button" onClick={goHome}><ArrowLeft size={17} /> 레이더로 돌아가기</button><section className="method-hero"><h1>Early Signal Score</h1><p>총 Star가 아니라 “지금 막 뜨는 속도”를 포착하기 위한 휴리스틱 점수입니다. 모든 입력은 0–100으로 정규화한 뒤 가중 합산합니다.</p></section><section className="method-table">{weights.map(([label, weight, description]) => <div key={label}><strong>{weight}%</strong><h2>{label}</h2><p>{description}</p></div>)}</section><section className="content-panel method-note-long"><h2>의도적으로 하지 않는 것</h2><p>Star 총량 자체에 큰 가중치를 주지 않습니다. 이미 10만 Star인 저장소보다 300 → 1,800처럼 짧은 기간에 비정상적으로 성장하는 프로젝트가 상위에 올라오도록 설계했습니다.</p></section></div>;
}
