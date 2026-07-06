# Pixel Adventure

Kenney 에셋으로 만든 브라우저 기반 2D 플랫포머 게임. Canvas 2D를 사용한 순수 JavaScript 구현으로, 물리 엔진, 충돌 검사, 에너미 AI, 파티클 효과, 파워업 시스템 등을 포함합니다.

## 빠른 시작

```bash
cd pixel-adventure-game
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속하거나, `index.html`을 직접 더블클릭해도 동작합니다.

---

## 게임 플레이

### 조작
| 키 | 동작 |
|---|---|
| ← → / A D | 이동 |
| Space / ↑ / W | 점프 (누르는 시간에 따라 높이 조절) |
| Space (공중) | 더블 점프 (파워업 수집 필요) |
| Enter | 시작 / 다음 레벨 |
| R | 현재 레벨 재시작 |

### 게임 규칙
- **시작**: 하트 3개로 시작
- **적 처치**: 슬라임/파리는 위에서 밟으면 처치 (톱니는 피할 것!)
- **수집**: 코인(노란색), 보석(파란색) 수집
- **상자**: `!` 모양 상자는 아래서 머리로 쳐서 열기
- **파워업**:
  - **S (방어막)**: 주황색 원, 피격 2회 무효 (색이 옅으면 1회 남음)
  - **D (더블 점프)**: 황색 원, 공중에서 한 번 더 점프 가능
- **클리어**: 각 레벨의 문(d)에 도달하면 다음 레벨로
- **스코어**: 빠른 클리어(3초 이내)에 보너스 점수 획득
- **현재**: 총 50개 스테이지 — 1~3은 수제 레벨(초원 / 사막 / 산), 4~50은 시드 고정 절차 생성(스테이지가 오를수록 난이도 상승, 테마 순환)

### 상태 플로우
```
title → play → clear → play → win
             ↑ (R키)        ↓ (낙사/피격 시)
             └── gameover ──┘
```

---

## 코드 구조

### 핵심 파일 구성

#### `index.html`
- Canvas 480x270 (16:9, 픽셀아트용 이미지렌더링 최적화)
- 어두운 배경 (#1a1c2c)
- `game.js` 로드

#### `game.js` (약 770줄)

**섹션 구분:**
1. **에셋 로드** (14-35줄)
   - 이미지: tiles.png, chars.png, bg.png
   - 효과음: jump, coin, gem, stomp, hurt, win, start, boxhit (mp3)

2. **스프라이트 인덱스** (37-61줄)
   - `T` 객체: 타일 스프라이트 ID (tilemap_packed.png, 20열 × 18px)
   - `CH` 객체: 캐릭터 스프라이트 ID (tilemap-characters_packed.png, 9열 × 24px)

3. **그리기 함수** (63-83줄)
   - `drawTile(idx, x, y)`: 타일 렌더
   - `drawChar(idx, x, y, flip)`: 캐릭터 그리기 (좌우반전)
   - `drawEnemy(e, idx, flip, yOff)`: 적 렌더 (박스 하단 정렬)

4. **레벨 빌더** (86-106줄)
   - `LevelBuilder` 클래스
   - 그리드 기반 레벨 정의 (`#` 블록, `=` 발판, `!` 상자 등)
   - 메서드: `ground()`, `block()`, `plat()`, `coin()`, `gem()`, `enemy()` 등

5. **레벨 구성** (109-225줄)
   - `buildLevel1()`: 초원 (140타일 × 15높이)
   - `buildLevel2()`: 사막 (150타일 × 15높이)
   - 각 레벨마다 구덩이, 발판, 적, 수집 아이템 배치

6. **게임 상태** (228-248줄)
   - `game` 객체: state, levelIdx, coins, gems, hearts, time
   - `level`, `player`, `enemies`, `particles`, `popups` 변수

7. **물리 & 충돌** (250-387줄)
   - `moveAndCollide(ent, dt, oneWay)`: AABB 충돌, 이동
   - `overlaps(a, b)`: 적과 플레이어 겹침 판정
   - `hurtPlayer()`: 피격 처리 (무적시간, 넉백)
   - `spawnBurst()`: 파티클 이펙트

8. **업데이트** (389-488줄)
   - 플레이어 입력 처리 (가속/감속, 점프 매커닉)
   - Coyote time (0.1초): 발판 끝에서도 점프 가능
   - Jump buffering (0.12초): 점프 입력 미리 받기
   - 가변 높이 점프: 키 떼면 낮게 뜸
   - 적 AI (slime/saw: 벽에 부딪히면 방향 전환, fly: 정현파 패턴)
   - 수집 로직 (코인, 보석, 상자)
   - 낙사 판정

9. **렌더링** (491-738줄)
   - 하늘 그라데이션
   - 카메라 (부드러운 추적)
   - 배경 (패럴랙스 스크롤 × 0.3)
   - 구름 (더 느린 패럴랙스 × 0.5)
   - 타일맵 렌더
   - 적과 플레이어 렌더
   - 파티클 & 팝업
   - HUD (하트, 코인, 보석, 레벨 번호)
   - 오버레이 (클리어, 게임오버)
   - 타이틀 화면
   - 승리 화면

10. **메인 루프** (741-766줄)
    - `requestAnimationFrame` 기반
    - 고정 60fps (STEP = 1/60)
    - 누적 시간 방식 (fixed timestep)
    - 개발용 해시 치트 (`#dev<레벨>x<타일>`)

---

## 주요 상수 & 매직 넘버

```javascript
const TS = 18;                      // 타일 크기 (픽셀)
const VIEW_W = 480, VIEW_H = 270;   // 뷰포트 크기
const GRAV = 830;                   // 중력 (px/s²)
const MOVE = 130;                   // 수평 속도 (px/s)
const JUMP_V = 292;                 // 점프 초기 속도 (px/s)
const MAX_FALL = 320;               // 낙하 속도 제한
const STEP = 1 / 60;                // 물리 타임스텝 (60fps)
```

### 적의 박스 크기 (렌더된 스프라이트는 박스 하단에 정렬)
```javascript
const ENEMY_BOX = {
  slime: { w: 18, h: 14 },
  fly:   { w: 18, h: 12 },
  saw:   { w: 18, h: 18 },
};
```

### 플레이어 상태 객체
```javascript
{
  x, y,                   // 위치
  w: 14, h: 20,           // 박스 크기
  vx, vy,                 // 속도
  onGround,               // 접지 상태
  flip,                   // 좌우 반전 (false=우향, true=좌향)
  coyote,                 // Coyote time 남은 시간 (점프 가능 윈도우)
  jumpBuf,                // Jump buffer 남은 시간
  iframes,                // 무적시간
  anim,                   // 애니메이션 카운터
  doubleJumpsLeft,        // 남은 더블 점프 개수
  shieldHealth,           // 방어막 체력 (0=없음, 1=1회, 2=2회)
  shieldTimer,            // 방어막 지속 시간 타이머
}
```

### 게임 상태 객체
```javascript
{
  state,       // 'title' | 'play' | 'clear' | 'gameover' | 'win'
  levelIdx,    // 현재 레벨 인덱스
  coins,       // 수집한 코인 수
  gems,        // 수집한 보석 수
  hearts,      // 남은 하트
  time,        // 게임 시간 (총)
  levelTime,   // 현재 레벨 진행 시간
  totalScore,  // 누적 스코어
  stateTime,   // 상태별 타이머
}
```

### 레벨 그리드 기호
- `#` : 블록 (위쪽이 다르게 렌더됨)
- `=` : 발판 (원웨이, 위에서만 통과)
- `X` : 크레이트
- `!` : 질문 상자 (위에서 쳐서 열기 가능)
- `x` : 열린 상자
- `o` : 코인
- `*` : 보석
- `S` : 방어막 파워업 (주황색 원으로 렌더)
- `D` : 더블 점프 파워업 (황색 원으로 렌더)
- `s` : 안내판
- `t` : 나무
- `c` : 선인장
- `m` : 버섯
- `d` : 문 (골)
- ` ` : 빈 공간

### 적 타입과 동작
- **slime**: 수평 이동 (vx=-25), 벽/절벽에서 방향 전환
- **saw**: 수평 이동 (vx=-35, 더 빠름), 회전 애니메이션
- **fly**: 정현파 상하 운동, 범위 내 좌우 이동 (vx=30)

---

## 새로 추가된 기능 (v2.0)

### 1. 더블 점프 시스템
- 공중에서 Space를 누르면 추가 점프 가능
- 파워업 D 수집으로 더블 점프 개수 증가
- 접지 시 자동 초기화
- 발동 시 황색 파티클 이펙트

### 2. 방어막 시스템
- S 파워업 수집으로 2회 무적 획득
- 피격 시 방어막이 데미지 흡수 (체력 감소)
- 방어막 활성 시 플레이어 주변에 원형 실드 렌더
- 색상으로 상태 표시 (노란색=2회, 빨간색=1회)

### 3. 레벨 3 추가 (산 테마)
- 더 높은 난이도
- 고급 점프 도전 (절벽 타이밍)
- 더블 점프 파워업과 방어막 파워업 포함
- 더 복잡한 적 배치

### 4. 스코어 시스템
- 각 레벨 클리어 시 시간 보너스 계산
- 3초 이내 클리어 시 최대 보너스
- 최종 승리 화면에서 총 스코어 표시
- 코인/보석 개수와 함께 표시

### 5. HUD 개선
- DJ: 더블 점프 남은 개수 표시
- SH: 방어막 남은 체력 표시

## 확장 가능성

### 1. 새 레벨 추가
```javascript
function buildLevel4() {
  const L = new LevelBuilder(170, 15, 'ice');  // 새 테마
  L.spawn(2, 10);
  L.ground(0, 20, 12);
  // ... 레벨 구성 ...
  L.powerup(50, 5, 'shield');
  L.powerup(100, 3, 'double');
  return L;
}
const LEVELS = [buildLevel1, buildLevel2, buildLevel3, buildLevel4];
```

### 2. 새 테마 추가
```javascript
const THEMES = {
  green:  { skyTop: '#bdefff', skyBot: '#e3f8ff', bgCol: 6, topSet: T.TOP_GRASS },
  desert: { skyTop: '#ffe6b3', skyBot: '#fff4d6', bgCol: 4, topSet: T.TOP_SAND },
  mountain: { skyTop: '#8ba5d9', skyBot: '#c5d9f1', bgCol: 8, topSet: T.TOP_GRASS },
  ice:    { skyTop: '#e8f4f8', skyBot: '#f5f9fa', bgCol: 10, topSet: T.TOP_GRASS },  // 새 테마
};
```

### 3. 새 적 타입 추가
- `ENEMY_BOX`에 박스 크기 정의
- `update()` 내 적 AI 로직 추가
- `render()`에 드로우 로직 추가
- `LevelBuilder.enemy()`로 배치

### 4. 새 수집 아이템 추가
- 레벨 그리드에 기호 정의 (예: `$`)
- `update()` 내 `cellAt()` 체크 로직 추가
- 렌더링 타일 정의

### 5. 파워업 시스템
- 아이템 수집 시 플레이어 능력 변경 (예: 이중 점프, 방어막)
- `player` 객체에 상태 추가 (powerupTime 등)
- 타이머로 자동 해제

---

## 성능 최적화 팁

### 1. 렌더링
- 화면 범위 밖의 타일은 스킵 (tx0, tx1 경계 계산)
- 배경 패턴은 반복만 사용 (wrap() 함수)
- 캔버스 렌더링 컨텍스트는 한 번만 저장 (ctx.save/restore)

### 2. 물리
- 충돌 체크는 필요한 타일만 (타일 좌표로 경계 계산)
- AABB(축 정렬 바운딩 박스)만 사용 (단순하고 빠름)

### 3. 객체 관리
- enemies, particles, popups는 매 프레임 배열 재생성 (메모리 정리)
- dead 상태인 적도 일정 시간 렌더 후 제거 (사라지는 애니메이션)

---

## 디버깅 & 개발 모드

### 해시 기반 치트
```
http://localhost:8000#dev1x60   → 레벨 1 타일 60번 위치에서 시작
http://localhost:8000#dev2      → 레벨 2 처음부터 시작
```

구현 위치: `game.js` 758-764줄

### 추가 가능한 디버그 기능
- 콜라이더 표시 (drawRect로 경계 그리기)
- 속도 벡터 표시
- FPS 카운터
- 그리드 오버레이

---

## 알려진 제약사항

1. **사운드 로드**: `assets/` 폴더에 mp3 파일 필요
   - `jump.mp3`, `coin.mp3`, `gem.mp3`, `stomp.mp3`, `hurt.mp3`, `win.mp3`, `start.mp3`, `boxhit.mp3`
   
2. **타일 이미지**: 지정된 레이아웃 필수
   - tiles.png: 20열, 18px 타일
   - chars.png: 9열, 24px 캐릭터
   - bg.png: 배경 패턴

3. **원웨이 플랫폼**: 발판(`=`)은 위에서만 통과 가능
   - 아래에서 올라올 수 없음 (설계상 제약)

4. **적 무한 회전**: 발판에서 끝에 도달해도 회전만 함 (절벽 감지 안 함)

---

## 사용 에셋 (모두 CC0)

- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — 타일, 캐릭터, 배경
- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) — 효과음 (mp3로 변환)

---

## 다음 개선 아이디어

- [x] 레벨 3 추가
- [x] 더블 점프 추가
- [x] 방어막 시스템 추가
- [x] 점수 시스템 추가
- [x] 스테이지 4~50 추가 (시드 기반 절차 생성)
- [ ] 새 테마 추가 (얼음, 용암 등)
- [ ] 보스 적 (큰 체력, 특수 패턴)
- [ ] 벽 슬라이드, 대시 등 고급 이동 기술
- [ ] 사운드 음량 조절 UI
- [ ] 모바일 터치 입력 (조이스틱)
- [ ] 레벨 에디터 (웹 기반)
- [ ] 리플레이 시스템
- [ ] 데이터 저장 (LocalStorage - 최고 스코어)
- [ ] 난이도 선택 (Easy/Normal/Hard)
- [ ] 스피드런 모드 (시간 제한)
- [ ] 멀티플레이어 (로컬 2P)

---

## 기술 스택

- **언어**: Pure JavaScript (ES6+)
- **렌더링**: Canvas 2D API
- **물리**: 수동 구현 (AABB)
- **입력**: Keyboard Events
- **사운드**: HTML5 Audio API
- **에셋**: PNG (타일맵), MP3 (효과음)

---

**마지막 업데이트**: 2026-07-03
