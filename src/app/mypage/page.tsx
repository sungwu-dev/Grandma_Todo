import Link from "next/link";
import AuthGate from "@/components/auth-gate";

export default function MyPage() {
  return (
    <AuthGate>
      <div className="page profile-page">
        <header className="card profile-hero">
          <div className="profile-hero-content">
            <div className="profile-identity">
              <div className="profile-avatar" aria-hidden="true">
                <span>JE</span>
              </div>
              <div className="profile-name-group">
                <span className="profile-label">보호자 프로필</span>
                <h1 className="profile-name">김지은</h1>
                <p className="profile-tagline">
                  엄마의 일상을 함께 지키는 주 보호자입니다. 이번 주는 약 복용
                  체크와 산책 루틴에 집중하고 있어요.
                </p>
                <div className="profile-chips">
                  <span className="profile-chip">보호자</span>
                  <span className="profile-chip">알림 담당</span>
                  <span className="profile-chip">주 5회 방문</span>
                </div>
              </div>
            </div>
            <div className="profile-actions">
              <Link className="profile-action" href="/recurring_sch">
                일정 편집
              </Link>
              <Link className="profile-action secondary" href="/calendar">
                캘린더 보기
              </Link>
            </div>
          </div>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">92%</span>
              <span className="profile-stat-label">완료율</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">28</span>
              <span className="profile-stat-label">이번 주 완료</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">14일</span>
              <span className="profile-stat-label">연속 기록</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">3명</span>
              <span className="profile-stat-label">가족 참여</span>
            </div>
          </div>
        </header>

        <div className="profile-grid">
          <div className="profile-grid-main">
            <section className="card profile-card">
              <h2 className="profile-section-title">내 소개</h2>
              <p className="profile-section-text">
                일정과 알림을 관리하고, 다른 가족들과 진행 상황을 공유합니다. 쉬운
                안내를 위해 글씨 크기와 알림 시간을 맞춰 두었어요.
              </p>
              <div className="profile-meta">
                <div className="profile-meta-row">
                  <span className="profile-meta-label">관계</span>
                  <span className="profile-meta-value">딸</span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">지역</span>
                  <span className="profile-meta-value">서울 마포</span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">연락처</span>
                  <span className="profile-meta-value">010-1234-5678</span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">가입일</span>
                  <span className="profile-meta-value">2024.05.18</span>
                </div>
              </div>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">이번 주 목표</h2>
              <div className="profile-progress-list">
                <div className="profile-progress">
                  <div className="profile-progress-head">
                    <span>약 복용 체크</span>
                    <span className="profile-progress-count">6/7</span>
                  </div>
                  <div className="profile-progress-bar">
                    <span className="profile-progress-fill" style={{ width: "86%" }} />
                  </div>
                </div>
                <div className="profile-progress">
                  <div className="profile-progress-head">
                    <span>물 마시기</span>
                    <span className="profile-progress-count">5/7</span>
                  </div>
                  <div className="profile-progress-bar">
                    <span className="profile-progress-fill" style={{ width: "71%" }} />
                  </div>
                </div>
                <div className="profile-progress">
                  <div className="profile-progress-head">
                    <span>산책</span>
                    <span className="profile-progress-count">2/3</span>
                  </div>
                  <div className="profile-progress-bar">
                    <span className="profile-progress-fill" style={{ width: "67%" }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">최근 활동</h2>
              <ul className="profile-activity-list">
                <li className="profile-activity-item">
                  <div className="profile-activity-head">
                    <span className="profile-activity-title">점심 약 복용 체크</span>
                    <span className="profile-activity-time">오늘 13:10</span>
                  </div>
                  <div className="profile-activity-meta">알림 1회 · 확인 완료</div>
                </li>
                <li className="profile-activity-item">
                  <div className="profile-activity-head">
                    <span className="profile-activity-title">물 마시기 리마인드</span>
                    <span className="profile-activity-time">오늘 10:00</span>
                  </div>
                  <div className="profile-activity-meta">알림 2회 · 진행 중</div>
                </li>
                <li className="profile-activity-item">
                  <div className="profile-activity-head">
                    <span className="profile-activity-title">저녁 산책 기록</span>
                    <span className="profile-activity-time">어제 18:40</span>
                  </div>
                  <div className="profile-activity-meta">기록 추가됨</div>
                </li>
              </ul>
            </section>
          </div>

          <div className="profile-grid-side">
            <section className="card profile-card">
              <h2 className="profile-section-title">돌봄 요약</h2>
              <ul className="profile-summary-list">
                <li className="profile-summary-item">
                  <span className="profile-summary-label">이번 주 알림</span>
                  <span className="profile-summary-value">12건</span>
                </li>
                <li className="profile-summary-item">
                  <span className="profile-summary-label">공유된 일정</span>
                  <span className="profile-summary-value">8개</span>
                </li>
                <li className="profile-summary-item">
                  <span className="profile-summary-label">가족 참여</span>
                  <span className="profile-summary-value">3명</span>
                </li>
                <li className="profile-summary-item">
                  <span className="profile-summary-label">마지막 로그인</span>
                  <span className="profile-summary-value">오늘</span>
                </li>
              </ul>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">다음 일정</h2>
              <div className="profile-next">
                <div className="profile-next-time">16:30</div>
                <div className="profile-next-title">가벼운 스트레칭</div>
                <div className="profile-next-meta">
                  알림 2회 예정 · 보호자 2명 수신
                </div>
              </div>
              <Link className="profile-link" href="/elder">
                실시간 화면 보기
              </Link>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">가족 그룹</h2>
              <ul className="profile-member-list">
                <li className="profile-member">
                  <span className="profile-member-dot" aria-hidden="true" />
                  <div className="profile-member-info">
                    <span className="profile-member-name">김순자</span>
                    <span className="profile-member-role">어머니 · 일정 수신</span>
                  </div>
                </li>
                <li className="profile-member">
                  <span className="profile-member-dot" aria-hidden="true" />
                  <div className="profile-member-info">
                    <span className="profile-member-name">김지은</span>
                    <span className="profile-member-role">주 보호자</span>
                  </div>
                </li>
                <li className="profile-member">
                  <span className="profile-member-dot" aria-hidden="true" />
                  <div className="profile-member-info">
                    <span className="profile-member-name">박민호</span>
                    <span className="profile-member-role">요양보호사</span>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
