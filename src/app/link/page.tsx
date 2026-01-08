"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const INVITE_CODE = "12345678";
const DOB = "1950-01-01";

export default function LinkPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [dob, setDob] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: 추후 /api로 검증 로직 이동 예정
    if (inviteCode === INVITE_CODE && dob === DOB) {
      setStatus("success");
    } else {
      setStatus("error");
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">초대코드 연동</h1>
        <p className="page-subtitle">가족 관리 화면과 연결합니다.</p>
      </header>

      <section className="card">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>초대코드 (8자리)</span>
            <input
              className="input"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              maxLength={8}
              inputMode="numeric"
              placeholder="12345678"
              required
            />
          </label>
          <label className="field">
            <span>생년월일 (YYYY-MM-DD)</span>
            <input
              className="input"
              value={dob}
              onChange={(event) => setDob(event.target.value)}
              placeholder="1950-01-01"
              required
            />
          </label>
          <button className="btn" type="submit">
            연동하기
          </button>
        </form>
      </section>

      {status === "success" && (
        <div className="notice success">
          연동 완료(테스트). 가족 관리로 이동해 주세요.
        </div>
      )}
      {status === "error" && (
        <div className="notice error">초대코드 또는 생년월일을 확인해 주세요.</div>
      )}

      {status === "success" && (
        <Link className="btn secondary" href="/family">
          가족 관리로 이동
        </Link>
      )}
    </div>
  );
}
