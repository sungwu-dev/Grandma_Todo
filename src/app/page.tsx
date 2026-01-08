import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page landing">
      <div className="card landing-card">
        <header className="page-header">
          <h1 className="page-title">초간단 일정 안내</h1>
          <p className="page-subtitle">필요한 화면을 선택해 주세요.</p>
        </header>
        <div className="landing-actions">
          <Link className="big-button" href="/elder">
            할머니 화면
          </Link>
          <Link className="big-button secondary" href="/family">
            가족 관리
          </Link>
          <Link className="big-button secondary" href="/calendar">
            일정 캘린더
          </Link>
        </div>
        <Link className="text-link" href="/link">
          초대코드로 연동하기
        </Link>
      </div>
    </div>
  );
}
