# DrawDashBoard

> **Sketch ideas · organize visually**  
> SvelteKit + Svelte 5 Runes 기반 드로잉 보드 툴 — Cloudflare Pages 배포 지원

---

## 📐 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  메인 (/)                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🎨 DrawDashBoard   Sketch ideas · organize …    │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ ➕ 새  │ │ Board1 │ │ Board2 │ │ Board3 │  …        │
│  │ 보드   │ │ thumb  │ │ thumb  │ │ thumb  │           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  보드 편집 (/board/[id])                                  │
│  ┌────────────────────── Topbar ──────────────────────┐ │
│  │  ← 목록  [제목]  저장 PDF 이미지 초기화 불러오기  │ │
│  │                                   Undo  Redo       │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌─────────┐ ┌──────────── BoardStage ────────┐ ┌─────┐ │
│  │ToolPanel│ │                                │ │Prop │ │
│  │ 선택    │ │     <canvas> + HTML overlays   │ │Panel│ │
│  │ 펜      │ │     ↕ ← 확장 버튼 (글래스) → ↕│ │     │ │
│  │ 지우개  │ │                                │ │     │ │
│  │ 사각형  │ └────────────────────────────────┘ └─────┘ │
│  │ 원      │                                            │
│  │ 삼각형  │                                            │
│  │ 가로선  │                                            │
│  │ 세로선  │                                            │
│  │ 텍스트  │                                            │
│  └─────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ 주요 기능

### 메인 화면

| 기능 | 설명 |
|------|------|
| 보드 목록 | 최근 수정순 정렬, 16:9 썸네일 미리보기 |
| 새 보드 | 그리드 첫 번째 카드에서 바로 생성 |
| 테마 선택 | 화이트보드 / 칠판 / 네온 그리드 |
| 카드 삭제 | 호버 시 우상단 삭제 아이콘 표시 |
| 제목 툴팁 | 긴 이름 말줄임표(…) 시 호버로 전체 표시 |

### 도구 패널

| 도구 | 기능 |
|------|------|
| ✊ 선택 | 드래그 이동 · 범위 선택(마키) · 회전 · 크기 조절 |
| ✏️ 펜 | 자유 드로잉, 색상/굵기 설정 |
| 🧹 지우개 | 펜 획 / 요소 삭제, 크기 설정, 커스텀 커서 표시 |
| ⬜ 사각형 | 내부 텍스트 입력 지원 |
| ⭕ 원 | SVG 렌더링으로 찌그러짐 없음, 내부 텍스트 지원 |
| △ 삼각형 | SVG polygon으로 정확한 외곽선 |
| ━ 가로선 | 수평 직선 |
| ┃ 세로선 | 수직 직선 |
| 🔤 텍스트 | 텍스트 박스, 좌·중·우 정렬, 테두리 두께 0으로 숨기기 |
| 🖼️ 이미지 | 이미지 영역 추가 → 속성 패널에서 파일 선택, 영역에 fit |

### 요소 조작

```
선택된 요소
  ├─ 드래그         : 이동
  ├─ 코너 핸들      : 크기 조절 (이미지는 비율에 맞게 fit)
  ├─ 회전 핸들      : 자유 회전 (rotation°)
  ├─ 더블클릭       : 텍스트 편집 모드 (rect / ellipse / text)
  ├─ Ctrl+D         : 복제
  └─ Delete         : 삭제

다중 선택 (마키 or Shift 클릭)
  ├─ 정렬   : 좌 / 가운데 / 우 / 상 / 중간 / 하
  ├─ 분배   : 가로 간격 균등 / 세로 간격 균등
  └─ 그룹   : 그룹화 / 그룹 해제
```

### 속성 패널 (우측)

| 섹션 | 기능 |
|------|------|
| 색상 | 선(Stroke) / 채우기(Fill) 색상 스와치 |
| 테두리 | 두께 슬라이더 0–12px (text 요소: 0 = 점선 숨김) |
| 폰트 크기 | rect / ellipse / text 선택 시 표시, 슬라이더 + 프리셋 버튼 (8–96px) |
| 이미지 | image 요소 선택 시 표시, 파일 탐색기로 이미지 불러오기 |
| 펜 크기 | 펜 굵기 슬라이더 |
| 지우개 | 지우개 크기 슬라이더 (지우개 도구 활성 시만 표시) |
| 스냅 | 스냅 민감도 슬라이더 |
| 테마 | 화이트보드 / 칠판 / 네온 그리드 전환 |
| 정렬 | 다중 선택 시: 좌·중·우·상·중간·하 정렬 + 가로·세로 균등 분배 |
| 텍스트 정렬 | 텍스트 편집 요소 선택 시: 좌·중·우 |

### 스냅 & 스마트 가이드

- **캔버스 스냅** : 중심선, 상/하/좌/우 테두리 스냅
- **요소 스냅** : 다른 요소의 모서리·중심에 자동 정렬
- **Gap Match** : 요소 간 간격이 동일할 때 스냅
- **거리 숫자 표시** : 스마트 가이드에 실제 px 거리 표시
- **민감도 슬라이더** : 옵션 패널에서 SNAP_THRESHOLD 조절

### 내보내기 & 저장

| 방식 | 형식 | 특징 |
|------|------|------|
| 저장 | LocalStorage | 썸네일 자동 생성 후 저장 |
| PDF 내보내기 | `.pdf` | jsPDF, 보드 크기 그대로 |
| 이미지 내보내기 | `.png` | 전체 해상도 PNG 다운로드 |
| 보드 불러오기 | 복사 붙여넣기 | 다른 보드 내용을 현재 보드로 병합 |

### 저장되지 않은 변경사항 경고

- **내부 이동** : SvelteKit `beforeNavigate` 훅으로 감지 → 커스텀 모달 표시 (저장하고 나가기 / 저장 없이 나가기 / 취소 버튼을 **가로 1행**으로 배치)
- **탭 닫기 / 새로고침** : `window.beforeunload` 이벤트로 브라우저 기본 경고 표시
- **오탐 방지** : 보드 최초 진입(불러오기) 시에는 `isDirty`를 `false`로 유지 — 아무 편집도 하지 않고 나가면 경고 없음

### 보드 캔버스

- **무한 확장** : 상/하/좌/우 가장자리 hover → 글래스모피즘 버튼으로 200px 확장
- **크기 저장** : 확장된 너비/높이가 저장되어 재접속 시에도 유지
- **Undo / Redo** : 전체 작업 히스토리 스냅샷 방식
- **테마 배경** : 격자 패턴을 `<canvas>` 로 렌더링, 지우개로 삭제 불가

---

## 🏗️ 프로젝트 구조

```
src/
├── app.html                        # Google Fonts (Caveat, DM Sans) 로드
├── routes/
│   ├── +layout.svelte              # 파비콘, 전역 설정
│   ├── +page.svelte                # 메인 (보드 목록)
│   └── board/[id]/
│       └── +page.svelte            # 보드 편집 (핵심 로직)
└── lib/
    ├── board-types.ts              # 전체 타입 정의 + 상수
    ├── board-storage.ts            # LocalStorage CRUD
    ├── canvas-renderer.ts          # Canvas 렌더링 (획·도형·텍스트·썸네일)
    ├── snap-engine.ts              # 스냅·가이드 계산 엔진
    └── component/
        ├── home/
        │   ├── BoardCard.svelte    # 보드 카드 (썸네일, 삭제 버튼)
        │   └── CreateBoardModal.svelte  # 새 보드 생성 모달
        └── board/
            ├── Topbar.svelte       # 상단 툴바 (저장·내보내기·Undo/Redo)
            ├── ToolPanel.svelte    # 좌측 도구 패널
            ├── PropertyPanel.svelte # 우측 속성 패널
            ├── BoardStage.svelte   # 드로잉 영역 (canvas + HTML overlay)
            └── ImportModal.svelte  # 보드 불러오기 모달 (썸네일 포함)
```

---

## 🗄️ 데이터 모델

```
BoardData
 ├── id, title, themeId
 ├── createdAt, updatedAt
 ├── width, height          ← 보드 크기 (확장 후에도 유지)
 ├── thumbnail              ← JPEG base64, 저장 시 자동 생성
 ├── strokes[]              ← 펜 획 (points 배열)
 └── elements[]             ← 도형/텍스트/이미지 요소
      ├── type: rect | ellipse | triangle | line-h | line-v | text | image
      ├── x, y, width, height
      ├── rotation, borderWidth
      ├── strokeColor, fillColor
      ├── text, textAlign, fontSize  ← rect/ellipse/text 전용
      ├── imageDataUrl?      ← image 전용, base64 data-URL
      └── groupId            ← 그룹화 연결 키
```

---

## 🎨 테마

| 테마 | 배경 | 격자 | 기본 펜 색 |
|------|------|------|-----------|
| 화이트보드 | `#ffffff` | 연한 회색 | `#111827` |
| 칠판 | `#10362f` | 반투명 흰색 | `#f8fafc` |
| 네온 그리드 | `#080c24` | 하늘색 glow | `#e2e8f0` |

---

## 🚀 개발 & 배포

```sh
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 타입 검사
npm run check

# 프로덕션 빌드
npm run build

# Cloudflare Workers 로컬 미리보기
npm run preview:worker

# Cloudflare 배포 (wrangler login 선행)
npm run deploy
```

> **Tech Stack** : SvelteKit · Svelte 5 Runes · TypeScript · jsPDF · Cloudflare Pages (`@sveltejs/adapter-cloudflare`)  
> **데이터 저장** : `localStorage` (서버 없음, 완전 클라이언트 사이드)
