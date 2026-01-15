import FooterGate from "@/components/footer-gate";

export default function HomePage() {
  return (
    <div className="page home-page">
      <section className="card home-hero">
        <div className="home-hero-inner">
          <p className="home-eyebrow">가족과 함께 만드는 하루 안내</p>
          <h1 className="home-title">일정 도우미</h1>
          <p className="home-quote">
            이 서비스는 할머니의 일정을 관리하고 할머니가{" "}
            <span className="home-highlight-phrase">
              무엇을 했는지, 무엇을 해야 하는지, 무엇을 할 건지
            </span>{" "}
            알려주는 서비스입니다.
          </p>
          <div className="home-tags" aria-label="핵심 안내">
            <span className="home-tag">완료한 일</span>
            <span className="home-tag">현재 할 일</span>
            <span className="home-tag">앞으로 할 일</span>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <span className="home-orb orb-one" />
          <span className="home-orb orb-two" />
          <span className="home-orb orb-three" />
        </div>
      </section>

      <section className="home-grid" aria-label="서비스 특징">
        <article className="card home-card">
          <h2 className="home-card-title">하루의 흐름을 정리</h2>
          <p className="home-card-text">
            지금 해야 하는 일과 이미 끝낸 일을 구분해서 보여줍니다.
          </p>
          <ul className="home-list">
            <li>현재 할 일 강조 표시</li>
            <li>완료 여부 간단 체크</li>
            <li>다음 일정 미리 보기</li>
          </ul>
        </article>
        <article className="card home-card">
          <h2 className="home-card-title">가족이 손쉽게 관리</h2>
          <p className="home-card-text">
            휴대폰에서 반복 일정과 특별 일정을 빠르게 조정합니다.
          </p>
          <ul className="home-list">
            <li>반복 일정으로 루틴 설정</li>
            <li>캘린더로 특별 일정 등록</li>
            <li>변경 즉시 할머니 화면 반영</li>
          </ul>
        </article>
        <article className="card home-card">
          <h2 className="home-card-title">태블릿에 상시 표시</h2>
          <p className="home-card-text">
            큰 글씨와 단순한 구성으로 어르신이 보기 쉽게 설계했습니다.
          </p>
          <ul className="home-list">
            <li>큰 글씨와 높은 가독성</li>
            <li>눌러서 다음 일정 확인</li>
            <li>알림 효과로 집중도 향상</li>
          </ul>
        </article>
      </section>

      <FooterGate>
        <footer id="bottom" aria-label="연락처 정보">
          <div className="inner-wrap">
            <ul className="copy">
              <li>
                <address>
                  <div className="footer-columns">
                    <div className="footer-group">
                      <span className="footer-label">할머니 주소</span>
                      <ul className="footer-list">
                        <li>경기 화성시 병점1로 82 병점한신아파트 101동 506호</li>
                        <li>경기 수원시 팔달구 인계로 21 수원센트럴아이파크자이아파트 112동 1401호</li>
                      </ul>
                      <span className="footer-label">할머니 연락처</span>
                      <ul className="footer-list">
                        <li>010-9172-9682</li>
                      </ul>
                    </div>
                    <span className="footer-divider" aria-hidden="true" />
                    <div className="footer-group">
                      <span className="footer-label">개발자 주소</span>
                      <ul className="footer-list">
                        <li>경기 화성시 동탄역로 196 동탄역예미지시그너스 101동 4502호</li>
                      </ul>
                      <span className="footer-label">개발자 연락처</span>
                      <ul className="footer-list">
                        <li>010-2167-7174</li>
                      </ul>
                    </div>
                  </div>
                </address>
              </li>
            </ul>
          </div>
        </footer>
      </FooterGate>
    </div>
  );
}
