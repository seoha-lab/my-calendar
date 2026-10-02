# Phase 1~4 구현 및 검증 보고서

대상: `seoha-lab/my-calendar` (기준 커밋 `8851eaaf59418b71921280caa452b0a9b95ac22e`)

## Phase 1: 실제 코드 분석

- Calendar: `CalendarView`의 FullCalendar dayGrid/timeGrid/interaction을 그대로 사용한다. 일정 클릭, 드래그, resize, 외부 Task 드롭은 Zustand 액션을 호출한다. 실제 렌더링은 `isEvent` 값만으로 제한하지 않고 날짜가 있는 Task의 모든 ranges를 표시한다.
- Task: 별도 Event 테이블이 없다. `Task` + `task_ranges`가 할 일과 일정의 공통 모델이다. 보드는 어제/오늘/내일/기한 지남으로 분류하며 상세 Drawer에서 메모, 시간 구간, 하위 할 일을 편집한다.
- Quick Add / NLP: `chrono-node` 기반 영어 날짜 파서와 즉시 저장 흐름, Gemini 메모 추출 미리보기 흐름이 존재한다. 이번에는 파싱 알고리즘과 저장 순서를 바꾸지 않았다.
- DB: DB RPC 클라이언트 → Web Worker → SQLite Wasm. `/clarity/main.sqlite3`의 OPFS 저장과 메모리 fallback을 유지한다.
- Zustand: 기존 Task 액션과 구독은 유지하고 직접 DB 접근만 CalendarService로 이동했다.
- PWA: `@serwist/next`, `src/sw.ts`, 서비스 워커 자동 등록, COOP/COEP 헤더를 유지한다. 원본 precache에 HTML 경로가 없어 오프라인 재접속이 실패하는 것을 확인하여 `/`, `/settings`를 추가했다.
- Settings: 기존 AI 키/모델, CSV 가져오기, CSV/ICS 내보내기와 비활성 Google 연결 안내를 재사용했다. optional Gemini API route는 원본 그대로다.

## 1. 변경한 파일 목록

- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`
- `app/quick-add/QuickAddProvider.tsx`
- `app/settings/page.tsx`
- `next.config.mjs`
- `package.json`
- `public/manifest.webmanifest`
- `src/components/AISearchPanel.tsx`
- `src/components/CalendarView.tsx`
- `src/components/CalendarsPanel.tsx`
- `src/components/DateTimePicker.tsx`
- `src/components/DraftFromNotesModal.tsx`
- `src/components/ExportModal.tsx`
- `src/components/Header.tsx`
- `src/components/QuickAdd.tsx`
- `src/components/TaskBoard.tsx`
- `src/components/TaskCard.tsx`
- `src/components/TaskDetailsDrawer.tsx`
- `src/lib/db.ts`
- `src/lib/export.ts`
- `src/lib/format.ts`
- `src/lib/nlp.ts`
- `src/lib/theme.ts`
- `src/store.ts`
- `src/styles/globals.css`
- `src/types.ts`
- `workers/db.worker.ts`

## 2. 새로 만든 파일 목록

- `docs/phase1-4-report.ko.md`
- `src/components/CalendarThemeSettings.tsx`
- `src/components/CalendarThemeStyles.tsx`
- `src/components/CategoryBadge.tsx`
- `src/components/CategorySelect.tsx`
- `src/lib/calendar/CalendarProvider.ts`
- `src/lib/calendar/LocalCalendarProvider.ts`
- `src/lib/calendar/categories.ts`
- `src/lib/calendar/index.ts`
- `src/lib/i18n/date.ts`
- `src/lib/i18n/en.ts`
- `src/lib/i18n/index.ts`
- `src/lib/i18n/ko.ts`
- `src/lib/theme/calendarThemeStore.ts`
- `src/lib/theme/contrast.ts`
- `src/lib/theme/themes.ts`
- `tests/foundations.cjs`

## 3. 기존 구조에서 재사용한 부분

FullCalendar 및 드래그/resize 콜백, TaskBoard/TaskCard/TaskDetailsDrawer, 다중 시간 구간, SQLite worker/RPC/OPFS, Zustand Task 액션, 기존 영어 Quick Add, Gemini 메모 미리보기, ICS/CSV 생성, 밝기 모드, PWA 등록을 재사용했다. Calendar/Task 컴포넌트를 새로 만들지 않았다. 새로운 패키지를 추가하지 않았고 package-lock.json을 유지했다.

## 4. 변경한 데이터 모델

- `Task.category?: EventCategory` 추가. 기존 생성 호출과의 호환성을 위해 입력 타입에서는 optional이다. LocalCalendarProvider와 DB 읽기에서 누락/잘못된 값은 `other`로 정규화한다.
- 키: hospital / lecture / graduate / research / study / exercise / personal / other. 한국어 레이블은 번역 사전에서 가져온다.
- 기존 Task와 ranges 구조, calendarId, 완료 상태, 메모, 연결 관계는 유지한다.
- Theme 색상/ID는 Task DB에 넣지 않는다. 복제·후속 할 일은 category를 이어받는다.
- CSV에 category 열을 추가하고 가져오기에서 복원한다. ICS에는 CATEGORIES를 추가한다.
- CalendarProvider의 getEvents/createEvent/updateEvent/deleteEvent와 기존 Task/범위 기능을 포함하는 CalendarService 계약, LocalCalendarProvider를 추가했다. UI → Zustand → CalendarService → LocalCalendarProvider → DB 흐름이다.
- source/externalCalendarId/externalEventId/syncStatus 및 원격 OAuth/동기화는 future work다. 사용하지 않는 DB 열이나 가짜 Provider는 만들지 않았다.

## 5. DB migration 여부

`workers/db.worker.ts`에서 PRAGMA로 category 열 존재를 확인하고 없을 때만 `ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'other'`를 실행한다. 기존 DB 경로, 레코드, 시간 구간을 초기화하거나 삭제하지 않는다. 새 migration은 기존 migration 이후 실행하며 실패를 정상 처리로 숨기지 않는다. SQLite Wasm으로 기존 데이터와 시간 구간을 넣은 뒤 migration을 두 번 실행해 데이터 보존과 반복 실행 안전성을 검사했다.

## 6. 한국어 UI 적용 범위

헤더/검색/완료 토글, FullCalendar 버튼과 날짜·시간, Task 보드/상세/하위 할 일/상대 시간, 날짜 선택기, Quick Add/메모 미리보기 안내, Settings, 내보내기, 주요 알림, HTML lang 및 PWA manifest locale을 한국어로 적용했다. `src/lib/i18n/{ko,en,index,date}.ts`에 문자열 사전, 매개변수 문자열, ko-KR 날짜 포맷을 모았다. 언어 전환 설정은 이번 범위에 넣지 않았다. 기술명/모델명/사용자 작성 데이터/외부 API 오류는 원문을 유지할 수 있다.

한국어 자연어 파서는 구현하지 않았다. Quick Add 예시는 한국어 제목 + 영어 날짜 표현을 안내한다. 현재 기본 화면은 기존 Calendar + Task 보드이며 별도 Today 대시보드는 Phase 12에 남겼다.

## 7. Theme 구현 방식

세 테마의 8개 카테고리 색상을 요청 값 그대로 정의했다. 기본값은 Soft Pastel이다. 렌더링 시 category와 현재 theme의 mapping으로 CSS 변수를 만든다. 일정 배경은 category 색상 18%와 불투명 밝은/어두운 배경을 혼합하고 accent 선을 표시한다. 텍스트는 상대 휘도/명암비로 검정 또는 흰색을 선택한다. 카테고리 이름도 표시하여 색상만으로 의미를 전달하지 않는다. 3테마 × 8카테고리 × 2밝기 = 48조합 모두 텍스트 대비 4.5:1 이상을 검사했다.

## 8. Settings Theme 선택 방식

세 라디오 카드와 색상 견본을 제공한다. 별도 Zustand 테마 상태와 localStorage `clarity:calendar-theme`에 테마 ID만 저장한다. 새로고침과 다른 탭의 storage 변경을 반영하고, 잘못된 ID는 Soft Pastel로 복원한다. 변경 시 DB 쓰기나 이벤트 수정은 발생하지 않는다. 기존 light/dark 설정과 별개이며 새 사용자 밝기 기본값은 light다.

## 9. 기존 기능 중 영향 받은 부분 및 동작 검증

- 일정과 Task는 한국어 레이블, 카테고리 선택 및 배지, 카테고리 색상이 추가된다. 기존 드래그/resize 처리 로직은 유지했다.
- 모바일(640px 미만) 최초 진입은 글자 가독성을 위해 일간 보기다. 사용자는 기존 4일/주/월 보기로 전환할 수 있다. 390px 화면에서 버튼과 일간 보기를 확인했다.
- 브라우저에서 병원 일정 생성 → 연구 카테고리로 수정 → 새로고침 후 보존을 확인했다. 세 테마 선택 및 선택값 유지도 확인했다.
- PWA precache에 `/` 및 `/settings` HTML을 추가했다. 빌드마다 revision이 바뀌어 새 HTML과 chunk가 함께 교체된다. 원래 worker 및 개발 중 비활성화 정책은 그대로다.
- 실제 로컬 production 서버를 종료한 상태에서 일정/설정 새로고침, 설정→일정 이동, 테마 변경, 새 일정 저장을 확인했다.
- iPhone Safari 실기기와 홈 화면 설치는 직접 검증하지 않았다. 데스크톱 내장 브라우저의 모바일 viewport 검증은 실기기 테스트를 대체하지 않는다. 실제 포인터로 드래그/resize 전체 조합을 자동 검증한 것은 아니다.

## 10. build 결과

Node 24.19.0, npm 10.9.4, 저장소 package-lock.json으로 `npm ci`한 환경에서 `next build` 통과. Phase 2/3/4별 검사 후 최종 검사도 통과했다. 처음 pnpm 환경에서 발생한 의존성 해석 차이는 npm 재설치로 제거했고 변경 사항에 포함하지 않았다.

| 단계 | build | type | lint |
|---|---|---|---|
| 원본 (npm 기준) | 실패: Settings JSX 따옴표 2개 | 통과 | 오류 2개, 경고 9개 |
| Phase 2 | 통과 | 통과 | 오류 0개, 경고 9개 |
| Phase 3 | 통과 | 통과 | 오류 0개, 경고 9개 |
| Phase 4 및 최종 PWA 보완 | 통과 | 통과 | 오류 0개, 경고 9개 |

Next의 기존 metadata.themeColor 권고, next lint 폐기 예정 안내, Browserslist 데이터 갱신 안내는 남아 있다. 검사 무시 설정을 추가하지 않았다.

## 11. lint 결과

오류 0개. 원본의 Settings JSX 따옴표 오류는 번역 사전 적용으로 해소했다. 기존 CalendarView/TaskDetailsDrawer의 React Hook 의존성 경고 9개는 자동 저장/편집 동작의 불필요한 변경을 피하기 위해 이번 범위에서 유지했다. 린트 규칙을 끄지 않았다.

## 12. TypeScript 오류 여부 및 회귀 검사

`tsc --noEmit` 오류 0개. 신규 코드에서 TypeScript 오류를 ignore하지 않았다.

`node tests/foundations.cjs` 통과: 카테고리 fallback, 48개 대비 조합, 한국어 날짜와 자정 넘는 표시, provider 구간 겹침 경계, CSV/ICS category, 기존 데이터 보존 migration 및 반복 migration.

재실행: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 13. 아직 구현하지 않은 기능

교대근무와 패턴 입력, 한국어 NLP/자동 카테고리 추정, 새 Quick Add의 필수 확인 Preview, 충돌 검사, Free Time, deadline/estimatedMinutes/priority 확장, 자동 일정 배치, Today 대시보드, Apple/Google OAuth·동기화·CalDAV는 구현하지 않았다. 기존 Quick Add와 Gemini 미리보기만 유지했다.

## 14. 다음 Phase에서 권장하는 작업

Phase 5에서 ShiftType 설정 및 날짜별 패턴 입력을 기존 Task/TaskRange 생성 경로에 연결한다. N7의 월말·연말·자정 경계와 OFF 처리를 우선 테스트한다. 이어 Phase 6~7에서 교체 가능한 한국어 parser와 모호성 표시/필수 Preview를 구현한다. iPhone Safari/설치 PWA 실기기 회귀 검증과 기존 Hook 경고의 개별 검토는 별도 작은 작업으로 권장한다.
