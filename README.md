# RepoPulse AI

GitHub의 인기 Repository를 다시 나열하는 서비스가 아니라, **최근 Star 증가 속도와 가속도가 비정상적으로 빨라진 AI 오픈소스**를 조기에 찾는 GitHub AI Trend Radar입니다.

## Live site

GitHub Pages source를 `main /docs`로 설정하면 다음 주소에서 정적 웹서비스가 바로 동작합니다.

- https://ko9ma7.github.io/pulse-ai/

`docs/`는 React 빌드가 필요 없는 독립 정적 배포본입니다. 따라서 GitHub Pages가 Vite 원본을 직접 읽어서 흰 화면이 생기는 문제를 피합니다.

## 가장 안전한 첫 업로드

Windows에서 ZIP을 새 폴더에 푼 뒤 다음 파일을 실행합니다.

```text
SAFE-PUBLISH.cmd
```

이 업로더는 현재 폴더나 상위 폴더의 `.git`을 사용하지 않습니다. `%TEMP%`에 **격리된 임시 Git 저장소**를 만들고 아래 웹서비스 파일만 복사해서 `ko9ma7/pulse-ai`에 올립니다.

- `src/`
- `public/`
- `scripts/`
- `.github/`
- `docs/`
- 프로젝트 설정 파일

`.cache`, Codex runtime, 로컬 `.git`, 로그, `SAFE-PUBLISH.cmd/.ps1`은 원격 저장소에 올리지 않습니다.

## GitHub Pages

자동 설정이 권한 문제로 실패한 경우 GitHub에서 한 번만 다음처럼 선택하면 됩니다.

```text
Settings → Pages
Build and deployment → Source: Deploy from a branch
Branch: main
Folder: /docs
Save
```

이 프로젝트는 Pages에서 React/Vite 빌드를 요구하지 않습니다. `docs/index.html`, `docs/app.js`, `docs/styles.css`가 그대로 서비스됩니다.

## Radar 데이터 자동 갱신

`.github/workflows/update-radar.yml`이 매일 GitHub API를 사용해 후보 Repository를 수집하고 Star History 기반 지표를 계산합니다.

갱신 결과는 두 위치에 동시에 기록됩니다.

```text
public/data/repositories.json
docs/data/repositories.json
```

따라서 데이터 workflow가 commit을 push하면 GitHub Pages의 `/docs` 데이터도 함께 갱신됩니다.

## UI 기능

- 24H / 7D / 30D 성장 필터
- Agent / MCP / Coding / LLM / Local AI / RAG / Computer Use / AI Image / AI Video 카테고리
- Repository 검색/정렬
- Early Signal Score
- Star History SVG 차트
- WHY TRENDING
- TRY THIS
- 블로그 글감 점수 및 제목 복사
- Watchlist / 발견 당시 Star 비교
- LocalStorage
- Dark / Light mode
- 모바일 반응형 UI

## 개발용 React/Vite 소스

`src/`에는 React + TypeScript 버전도 유지합니다.

```bash
npm install
npm run dev
npm run build
```

GitHub Pages의 기본 배포본은 안정성을 위해 `docs/` 정적 버전을 사용합니다.

## Security

GitHub Token, PAT, 비밀번호는 프로젝트 파일에 저장하지 않습니다. 업로드 인증은 사용자 PC의 GitHub CLI 인증을 사용합니다. 저장소에 기록되는 `ko9ma7/pulse-ai`는 공개 GitHub 사용자명/Repository 주소일 뿐 비밀정보가 아닙니다.

## License

MIT
