# Grandma Todo (Next.js)

## 실행 방법
1. `npm install` (의존성 설치 단계이며 음력 생신 표시를 위한 `korean-lunar-calendar`도 이때 함께 내려받습니다.)
2. `npm run dev`
3. 브라우저에서 `http://localhost:3000` 접속

추가 참고:
- 새 패키지가 추가된 후에는 `npm install`을 다시 실행해 주세요.
- 개발 서버가 실행 중이라면 `Ctrl + C`로 종료한 뒤 `npm run dev`로 재시작하세요.

## 참고
- 일정 편집은 `/recurring_sch`에서 저장하며 localStorage(`schedule_v1`)에 보관됩니다.
- 완료 체크는 날짜별로 `done_YYYY-MM-DD` 키에 저장됩니다.
- 캘린더 추가 일정은 localStorage(`events_v1`)에 저장됩니다.

## Supabase 설정 (로그인 MVP)
1. Supabase 프로젝트를 생성합니다.
2. 아래 템플릿을 참고해 `.env.local`을 추가합니다.
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```
3. Supabase Auth에서 Redirect URL에 `http://localhost:3000/auth/callback`을 등록합니다.
4. Supabase SQL Editor에서 `supabase/schema.sql`을 실행해 테이블/RLS 뼈대를 생성합니다.

## 라우팅 메모
- `/elder`는 로그인 없이 접근 가능합니다.
- `/recurring_sch`, `/calendar`는 로그인 필요합니다.
- 로그인은 `/login`에서 이메일 매직링크(OTP)로 진행됩니다.


## supabase
- Supabase 접속 정보는 `.env.local`에 보관합니다(깃에서 제외).
- 필요하면 Supabase 콘솔(Settings → API)에서 확인하세요.

## Domain
https://grandma-todo.vercel.app/