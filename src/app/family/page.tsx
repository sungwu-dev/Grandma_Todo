"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  DEFAULT_ALERT_MINUTES,
  DEFAULT_ALERT_TARGET,
  TIME_BLOCKS,
  getDefaultAlertMinutes
} from "@/lib/constants";
import type { AlertTarget, TimeBlock } from "@/lib/types";
import { loadSchedule, saveSchedule } from "@/lib/storage";
import { toMinutes, validateSchedule } from "@/lib/time";

type Notice = { type: "success" | "error"; text: string } | null;

const emptyForm = {
  start: "",
  end: "",
  label: ""
};

function normalizeLabel(block: TimeBlock): string {
  if (Array.isArray(block.label)) {
    return block.label.join(" / ");
  }
  if (typeof block.label === "string") {
    return block.label;
  }
  if (Array.isArray(block.tasks)) {
    return block.tasks.join(" / ");
  }
  return "";
}

const MAX_ALERT_COUNT = 5;

function normalizeAlertMinutes(values: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    const minute = Math.round(value);
    if (!Number.isFinite(minute) || minute <= 0 || minute >= 24 * 60) {
      continue;
    }
    if (seen.has(minute)) {
      continue;
    }
    seen.add(minute);
    result.push(minute);
  }
  return result;
}

function areMinutesEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function parseAlertMinuteInputs(inputs: string[]): number[] {
  return normalizeAlertMinutes(inputs.map((value) => Number(value)));
}

function fillAlertMinutes(values: number[], count: number): number[] {
  const normalized = normalizeAlertMinutes(values);
  const result = [...normalized];
  const defaults = getDefaultAlertMinutes(count);
  for (const preset of defaults) {
    if (result.length >= count) {
      break;
    }
    if (!result.includes(preset)) {
      result.push(preset);
    }
  }
  const fallback = defaults[0] ?? DEFAULT_ALERT_MINUTES[0] ?? 5;
  while (result.length < count) {
    result.push(fallback);
  }
  return result.slice(0, count);
}

function buildAlertInputs(values: number[], count: number): string[] {
  return fillAlertMinutes(values, count).map((value) => String(value));
}

export default function FamilyPage() {
  const [blocks, setBlocks] = useState<TimeBlock[]>(TIME_BLOCKS);
  const [form, setForm] = useState(emptyForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<"none" | "menu" | "form">("none");
  const [alertCount, setAlertCount] = useState(DEFAULT_ALERT_MINUTES.length);
  const [alertMinuteInputs, setAlertMinuteInputs] = useState<string[]>(
    buildAlertInputs(DEFAULT_ALERT_MINUTES, DEFAULT_ALERT_MINUTES.length)
  );
  const [alertTarget, setAlertTarget] = useState<AlertTarget>(DEFAULT_ALERT_TARGET);
  const [notice, setNotice] = useState<Notice>(null);

  const activeBlock = activeIndex !== null ? blocks[activeIndex] : null;
  const activeLabel = activeBlock ? normalizeLabel(activeBlock) : "";

  useEffect(() => {
    const stored = loadSchedule();
    if (stored && stored.length > 0) {
      const normalized = stored.map((block) => ({
        start: block.start,
        end: block.end,
        label: normalizeLabel(block),
        alertTarget: block.alertTarget ?? DEFAULT_ALERT_TARGET,
        alertMinutes:
          block.alertMinutes && block.alertMinutes.length > 0
            ? block.alertMinutes
            : getDefaultAlertMinutes(DEFAULT_ALERT_MINUTES.length)
      }));
      setBlocks(normalized);
    }
  }, []);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingIndex(null);
  };

  const closeModal = () => {
    setModalMode("none");
    setActiveIndex(null);
  };

  const openAddModal = () => {
    resetForm();
    setEditingIndex(null);
    setActiveIndex(null);
    const defaults = buildAlertInputs(DEFAULT_ALERT_MINUTES, DEFAULT_ALERT_MINUTES.length);
    setAlertCount(defaults.length);
    setAlertMinuteInputs(defaults);
    setAlertTarget(DEFAULT_ALERT_TARGET);
    setNotice(null);
    setModalMode("form");
  };

  const openMenuModal = (index: number) => {
    setActiveIndex(index);
    setModalMode("menu");
    setNotice(null);
  };

  const openEditModal = () => {
    if (activeIndex === null) {
      return;
    }
    const target = blocks[activeIndex];
    const rawMinutes =
      target.alertMinutes && target.alertMinutes.length > 0
        ? target.alertMinutes
        : getDefaultAlertMinutes(DEFAULT_ALERT_MINUTES.length);
    const nextCount = Math.min(
      MAX_ALERT_COUNT,
      rawMinutes.length > 0 ? rawMinutes.length : DEFAULT_ALERT_MINUTES.length
    );
    const filledInputs = buildAlertInputs(rawMinutes, nextCount);
    setForm({
      start: target.start,
      end: target.end,
      label: normalizeLabel(target)
    });
    setEditingIndex(activeIndex);
    setAlertCount(nextCount);
    setAlertMinuteInputs(filledInputs);
    setAlertTarget(target.alertTarget ?? DEFAULT_ALERT_TARGET);
    setNotice(null);
    setModalMode("form");
  };

  const handleAlertCountChange = (value: string) => {
    const parsed = Number(value);
    const nextCount = Number.isFinite(parsed)
      ? Math.min(MAX_ALERT_COUNT, Math.max(1, Math.round(parsed)))
      : 1;
    setAlertCount(nextCount);
    const currentDefaults = getDefaultAlertMinutes(alertCount);
    const nextDefaults = getDefaultAlertMinutes(nextCount);
    setAlertMinuteInputs((prev) => {
      const parsedMinutes = parseAlertMinuteInputs(prev);
      if (areMinutesEqual(parsedMinutes, currentDefaults)) {
        return nextDefaults.map((minute) => String(minute));
      }
      return buildAlertInputs(parsedMinutes, nextCount);
    });
  };

  const handleAlertInputChange = (index: number, value: string) => {
    setAlertMinuteInputs((prev) => {
      const next = [...prev];
      next[index] = value.replace(/[^\d]/g, "");
      return next;
    });
  };

  // localStorage에 저장해 /elder에 즉시 반영되도록 한다.
  const persistBlocks = (nextBlocks: TimeBlock[], successMessage: string) => {
    const normalizedBlocks = nextBlocks.map((block) => ({
      ...block,
      alertTarget: block.alertTarget ?? DEFAULT_ALERT_TARGET,
      alertMinutes:
        block.alertMinutes && block.alertMinutes.length > 0
          ? block.alertMinutes
          : getDefaultAlertMinutes(DEFAULT_ALERT_MINUTES.length)
    }));
    setBlocks(normalizedBlocks);
    saveSchedule(normalizedBlocks);
    setNotice({ type: "success", text: successMessage });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const finalAlertMinutes = fillAlertMinutes(
      parseAlertMinuteInputs(alertMinuteInputs),
      alertCount
    );
    const candidate: TimeBlock = {
      start: form.start.trim(),
      end: form.end.trim(),
      label: form.label.trim(),
      alertTarget,
      alertMinutes: finalAlertMinutes
    };

    const nextBlocks =
      editingIndex === null
        ? [...blocks, candidate]
        : blocks.map((block, index) => (index === editingIndex ? candidate : block));

    const validation = validateSchedule(nextBlocks);
    if (!validation.ok) {
      setNotice({ type: "error", text: validation.message });
      return;
    }

    const sorted = [...nextBlocks].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start)
    );
    persistBlocks(sorted, editingIndex === null ? "스케줄을 추가했습니다." : "스케줄을 수정했습니다.");
    resetForm();
    closeModal();
  };

  const handleDelete = (index: number) => {
    if (blocks.length <= 1) {
      setNotice({ type: "error", text: "최소 1개의 시간 블록이 필요합니다." });
      return;
    }
    const nextBlocks = blocks.filter((_, idx) => idx !== index);
    const validation = validateSchedule(nextBlocks);
    if (!validation.ok) {
      setNotice({ type: "error", text: validation.message });
      return;
    }
    persistBlocks(nextBlocks, "스케줄을 삭제했습니다.");
    resetForm();
    closeModal();
  };

  const handleReset = () => {
    const resetBlocks = TIME_BLOCKS.map((block) => ({
      ...block,
      alertTarget: DEFAULT_ALERT_TARGET,
      alertMinutes: getDefaultAlertMinutes(DEFAULT_ALERT_MINUTES.length)
    }));
    persistBlocks(resetBlocks, "기본 예시 스케줄로 초기화했습니다.");
    resetForm();
  };

  const handleActiveDelete = () => {
    if (activeIndex === null) {
      return;
    }
    handleDelete(activeIndex);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">가족 관리</h1>
        <p className="page-subtitle">시간 블록을 추가하거나 수정해 주세요.</p>
      </header>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="page-title" style={{ fontSize: "clamp(22px, 3vw, 32px)" }}>
            현재 스케줄
          </h2>
          <button className="btn" type="button" onClick={openAddModal}>
            +추가
          </button>
        </div>
        <div className="block-scroll" role="region" aria-label="현재 스케줄 목록">
          <ul className="block-list">
            {blocks.map((block, index) => (
              <li key={`${block.start}-${block.end}-${index}`}>
                <button
                  type="button"
                  className="block-item block-item-button"
                  onClick={() => openMenuModal(index)}
                >
                  <div className="block-meta">
                    <span className="block-time">{block.start} ~ {block.end}</span>
                    <span>{normalizeLabel(block)}</span>
                  </div>
                  <div className="block-hint">클릭해서 수정/삭제</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <div className="block-actions">
          <button className="btn secondary" type="button" onClick={handleReset}>
            기본 예시 스케줄로 초기화
          </button>
          <Link className="btn ghost" href="/elder">
            할머니 화면 보기
          </Link>
        </div>
      </section>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {modalMode !== "none" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white/95 p-6 shadow-2xl">
            {modalMode === "menu" && activeBlock && (
              <div className="grid gap-4">
                <div>
                  <div className="text-sm font-semibold tracking-[0.3em] text-slate-500">
                    일정 선택
                  </div>
                  <div className="mt-3 text-xl font-bold text-slate-900">{activeLabel}</div>
                  <div className="mt-1 text-slate-600">
                    {activeBlock.start} ~ {activeBlock.end}
                  </div>
                </div>
                <div className="grid gap-2">
                  <button className="btn" type="button" onClick={openEditModal}>
                    수정
                  </button>
                  <button className="btn ghost" type="button" onClick={handleActiveDelete}>
                    삭제
                  </button>
                  <button className="btn secondary" type="button" onClick={closeModal}>
                    닫기
                  </button>
                </div>
              </div>
            )}

            {modalMode === "form" && (
              <div className="grid gap-4">
                <div>
                  <div className="text-sm font-semibold tracking-[0.3em] text-slate-500">
                    {editingIndex === null ? "새 일정 추가" : "일정 수정"}
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {editingIndex === null ? "새 시간 블록을 입력해 주세요." : "내용을 수정해 주세요."}
                  </div>
                </div>
                <form className="form-grid" onSubmit={handleSubmit}>
                  <label className="field">
                    <span>시작 시간 (HH:MM)</span>
                    <input
                      className="input"
                      value={form.start}
                      onChange={(event) => handleChange("start", event.target.value)}
                      placeholder="예: 09:00"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>종료 시간 (HH:MM)</span>
                    <input
                      className="input"
                      value={form.end}
                      onChange={(event) => handleChange("end", event.target.value)}
                      placeholder="예: 11:30"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>할 일</span>
                    <input
                      className="input"
                      value={form.label}
                      onChange={(event) => handleChange("label", event.target.value)}
                      placeholder="예: 물 한 컵 마시기"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>알림 횟수</span>
                    <select
                      className="input"
                      value={alertCount}
                      onChange={(event) => handleAlertCountChange(event.target.value)}
                    >
                      <option value={1}>1회</option>
                      <option value={2}>2회</option>
                      <option value={3}>3회</option>
                      <option value={4}>4회</option>
                      <option value={5}>5회</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>알림 기준</span>
                    <select
                      className="input"
                      value={alertTarget}
                      onChange={(event) => setAlertTarget(event.target.value as AlertTarget)}
                    >
                      <option value="start">시작 시간 기준</option>
                      <option value="end">종료 시간 기준</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>알림 시간 (분 전)</span>
                    <div
                      className="alert-input-group"
                      style={{
                        gridTemplateColumns: `repeat(${alertCount}, minmax(0, 1fr))`
                      }}
                    >
                      {alertMinuteInputs.map((value, index) => (
                        <input
                          key={`alert-input-${index}`}
                          className="alert-input-slot"
                          value={value}
                          onChange={(event) => handleAlertInputChange(index, event.target.value)}
                          inputMode="numeric"
                          placeholder={`${index + 1}`}
                          maxLength={4}
                        />
                      ))}
                    </div>
                  </label>
                  <div className="block-actions">
                    <button className="btn" type="submit">
                      {editingIndex === null ? "추가" : "저장"}
                    </button>
                    <button className="btn ghost" type="button" onClick={closeModal}>
                      취소
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
