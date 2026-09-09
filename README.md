# RepoPulse AI

GitHub의 인기 Repository를 다시 나열하는 서비스가 아니라, **최근 Star 증가 속도와 가속도가 비정상적으로 빨라진 AI 오픈소스**를 조기에 찾는 GitHub AI Trend Radar입니다.

## Live site

GitHub Pages source를 `main /docs`로 설정하면 다음 주소에서 정적 웹서비스가 동작합니다.

- https://ko9ma7.github.io/pulse-ai/

`docs/`는 React 빌드가 필요 없는 독립 정적 배포본입니다.

## 이번 버전의 핵심

Radar 한 화면만 보여주는 구조에서 **누적 관측형 서비스**로 확장했습니다.

- `Radar`: 현재 24H / 7D / 30D / 90D / 1Y 성장 신호
- `Timeline`: 주·월·분기·연 단위 Star 성장 흐름과 성장 리더
- `Categories`: Agent / MCP / Coding / LLM / Local AI / RAG / Computer Use / AI Image / AI Video 비교
- `Archive`: RepoPulse가 실제 관측한 스냅샷을 Day / Week / Month / Year로 집계
- `Repository detail`: Total Stars / Daily Gain을 24H~1Y 범위로 전환
- `Watchlist`: 발견 시점 대비 현재 Star 증가 비교
- JSON / CSV export

## 데이터 수집과 누적 기록

`.github/workflows/update-radar.yml`은 다음 두 방식으로 실행됩니다.

- 자동: **6시간마다** (`17 */6 * * *`)
- 수동: GitHub Actions의 **Run workflow** (`workflow_dispatch`)

각 실행은 GitHub Repository Search와 Star History API를 이용해 최신 후보를 다시 계산하고 다음 파일을 갱신합니다.

```text
public/data/repositories.json
docs/data/repositories.json
public/data/radar-history.json
docs/data/radar-history.json
```

누적 정책:

- 6시간 스냅샷: 최근 **30일** 보존
- 일별 스냅샷: 최대 **730일(2년)** 보존
- 개별 Repository Star History: 최대 **365일** 표시

`radar-history.json`에는 각 시점의 Repository 수, Qualified 수, 평균 Signal, 24H/7D 성장, 카테고리별 성장, Repository별 Star/Signal/Acceleration이 함께 저장됩니다. 따라서 시간이 쌓일수록 주·월·년 비교가 실제 관측 데이터로 채워집니다.

## 카테고리 분류

후보 수집 시 카테고리별 검색어를 여러 개 사용하고, Repository의 이름·설명·Topics를 다시 분석해 다중 카테고리를 보강합니다. 한 Repository가 Agent + MCP처럼 여러 영역에 걸치면 복수 카테고리에 포함될 수 있습니다.

## 안전한 업데이트

Windows에서 새 ZIP을 풀고 다음 파일을 실행합니다.

```text
SAFE-PUBLISH.cmd
```

이 업로더는 `%TEMP%`의 격리된 Git checkout에서 작업합니다. 기존 GitHub 저장소에 live `repositories.json`과 `radar-history.json`이 있으면 **먼저 백업한 뒤 새 코드에 복원**하므로, UI 업데이트 때문에 지금까지 쌓인 누적 이력이 초기화되지 않습니다.

원격에는 다음 웹서비스 파일만 반영하고 `.cache`, Codex runtime, 로컬 `.git`, 로그, `SAFE-PUBLISH.cmd/.ps1`은 업로드하지 않습니다.

업데이트가 끝나면 `update-radar.yml`의 수동 실행도 한 번 요청합니다. 요청이 권한/전파 지연으로 실패해도 6시간 자동 스케줄은 저장소에 그대로 설정됩니다.

## GitHub Pages

```text
Settings → Pages
Build and deployment → Source: Deploy from a branch
Branch: main
Folder: /docs
Save
```

이미 사이트가 정상 표시되고 있다면 이 설정은 그대로 두면 됩니다. 데이터 workflow가 `main`의 `/docs/data`를 commit하면 Pages도 새 데이터로 다시 게시됩니다.

## Actions 권한 확인

데이터 workflow는 JSON 파일을 다시 commit해야 하므로 Repository에서 Actions의 `GITHUB_TOKEN`에 `contents: write`가 허용되어야 합니다. Workflow 자체에는 `permissions: contents: write`가 선언되어 있습니다. 조직/Repository 정책이 이를 제한하는 경우 Settings → Actions → General의 Workflow permissions도 확인해야 합니다.

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
