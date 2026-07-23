import React from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight } from "lucide-react";

export const UPDATE_NOTES = [
    {
        version: "v1.5.0",
        date: "2026-07-23",
        title: "곡 추천 탭 추가",
        categories: [
            {
                name: "신규 기능",
                type: "new",
                items: ["곡 추천 기능 추가"],
            },
        ],
    },
    {
        version: "v1.4.1",
        date: "2026-07-22",
        title: "B39 순위 역전현상",
        categories: [
            {
                name: "개선사항",
                type: "improvement",
                items: [
                    "B39 대시보드에서 곡의 레이팅이 같을시 종종 상수가 낮은 곡이 위로 올라오는 현상 수정",
                    "랭킹 탭 정렬 디자인 개선",
                ],
            },
        ],
    },
    {
        version: "v1.4.0",
        date: "2026-07-22",
        title: "성과 일자 기록 추가",
        categories: [
            {
                name: "신규 기능",
                type: "new",
                items: ["곡 성과 달성 일자 기록 기능 추가", "타임라인 탭 추가"],
            },
        ],
    },
    {
        version: "v1.3.0",
        date: "2026-07-04",
        title: "편의성 개선",
        categories: [
            {
                name: "신규 기능",
                type: "new",
                items: ["곡 상세 디테일 모달에 레이팅 계산 다이렉트 버튼 추가"],
            },
            {
                name: "UI/UX 개선",
                type: "improvement",
                items: [
                    "개인 기록탭에서도 곡 상세 디테일 모달이 뜨도록 변경",
                    "기록 비교탭 자켓에 난이도 색상의 테두리 추가",
                ],
            },
            {
                name: "버그 및 안정성 수정",
                type: "bugfix",
                items: [
                    "레이팅 계산기에서 포텐셜 모드일때 레이팅 계산이 소수점 한자리까지밖에 표기되지 않던 오류 수정",
                ],
            },
        ],
    },
    {
        version: "v1.2.0",
        date: "2026-07-04",
        title: "패턴 상수 탭 신설 및 UI 개선",
        categories: [
            {
                name: "신규 기능",
                type: "new",
                items: ["패턴 상수도입"],
            },
        ],
    },
    {
        version: "v1.1.0",
        date: "2026-06-17",
        title: "동기화 안정성 강화 및 유저 편의 기능 추가",
        categories: [
            {
                name: "신규 기능 및 개선",
                type: "new",
                items: [
                    "디폴트 정렬 추가 (게임 내 수록곡 순서대로 정렬 기준 적용)",
                    "곡 필터링 조건 세션 저장 도입으로 페이지 이동 시 필터 유지",
                    "구곡 전환 남은 일수 디스플레이 추가",
                    "유튜브 채보 영상 링크 및 트레이너 Speed 플레이어 연동 추가",
                ],
            },
            {
                name: "버그 및 안정성 수정",
                type: "bugfix",
                items: [
                    "다중 기기 이용 시 발생하던 기록 덮어쓰기 현상 및 데이터 충돌 버그 수정",
                    "서버 동기화 실패 시 오프라인 경고 안내 토스트 추가",
                    "보안 취약점 및 다중 로그인 세션 만료 버그 해결",
                    "트레이너 정보 불러오기 시 JSON 파싱 오류 수정",
                    "곡 상세 뷰에서 명시적 상수가 없을 때 물음표(?)가 보이지 않던 이슈 수정",
                ],
            },
        ],
    },
    {
        version: "v1.0.0",
        date: "2026-06-15",
        title: "프로세카 Potential 레이팅 시스템 추가",
        categories: [
            {
                name: "신규 기능",
                type: "new",
                items: [
                    "Potential 레이팅 모드 공식 도입 및 전용 대시보드 추가",
                    "상수표 내 컷오프 경계값 계산 및 배지 표시 기능",
                    "미수록곡/원하지 않는 곡을 화면에서 제외할 수 있는 곡 숨김 설정 추가",
                ],
            },
            {
                name: "버그 수정",
                type: "bugfix",
                items: [
                    "개인 성적 추세 그래프의 디비전 카운트 증가 및 렌더링 깨짐 오류 수정",
                    "랭킹 탭에서 일부 통계 데이터가 다르게 출력되던 버그 수정",
                    "상수표에서 신곡 NEW 배지가 누락되거나 필터링이 오적용되던 문제 개선",
                ],
            },
        ],
    },
    {
        version: "v0.9.0",
        date: "2026-06-08",
        title: "Pre-release",
        categories: [
            {
                name: "신규 기능",
                type: "new",
                items: ["실시간 유저 랭킹 탭 추가", "유저 간 성적 및 기록 비교분석 도구 추가"],
            },
            {
                name: "최적화",
                type: "improvement",
                items: ["반응형 모바일 디자인 최적화", "성적 데이터 렌더링 최적화"],
            },
        ],
    },
];

export default function UpdateNotesModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return createPortal(
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div
                className="glass-panel modal-content update-notes-modal"
                style={{
                    width: "90%",
                    maxWidth: "680px",
                    maxHeight: "85vh",
                    padding: "2.2rem",
                    overflowY: "auto",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                }}
            >
                {/* Header Close Button */}
                <button
                    style={{
                        position: "absolute",
                        right: "1.5rem",
                        top: "1.5rem",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "0.25rem",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        background: "rgba(255, 255, 255, 0.03)",
                    }}
                    onClick={onClose}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                    title="닫기"
                >
                    <X size={18} />
                </button>

                {/* Modal Title */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        paddingBottom: "1rem",
                    }}
                >
                    <div>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: "1.3rem",
                                fontWeight: "800",
                                color: "#fff",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            SEKAITOOL 업데이트 노트
                        </h3>
                    </div>
                </div>

                {/* Update Notes Content list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2rem", flex: 1 }}>
                    {UPDATE_NOTES.map((note) => (
                        <div
                            key={note.version}
                            style={{
                                background: "rgba(255, 255, 255, 0.01)",
                                border: "1px solid rgba(255, 255, 255, 0.03)",
                                borderRadius: "12px",
                                padding: "1.5rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "1rem",
                            }}
                        >
                            {/* Version Header */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: "0.5rem",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span
                                        style={{
                                            background: "linear-gradient(135deg, var(--color-pink), #f43f5e)",
                                            color: "#fff",
                                            fontWeight: "800",
                                            fontSize: "0.75rem",
                                            padding: "0.15rem 0.5rem",
                                            borderRadius: "6px",
                                        }}
                                    >
                                        {note.version}
                                    </span>
                                    <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "#fff" }}>
                                        {note.title}
                                    </h4>
                                </div>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "500" }}>
                                    {note.date}
                                </span>
                            </div>

                            {/* Categories inside Version */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {note.categories.map((cat, idx) => {
                                    const isNew = cat.type === "new";
                                    const isBug = cat.type === "bugfix";
                                    let badgeBg = "rgba(56, 189, 248, 0.12)";
                                    let badgeColor = "#38bdf8";
                                    let badgeBorder = "1px solid rgba(56, 189, 248, 0.2)";

                                    if (isNew) {
                                        badgeBg = "rgba(45, 212, 191, 0.12)";
                                        badgeColor = "#2dd4bf";
                                        badgeBorder = "1px solid rgba(45, 212, 191, 0.2)";
                                    } else if (isBug) {
                                        badgeBg = "rgba(244, 63, 94, 0.12)";
                                        badgeColor = "#f43f5e";
                                        badgeBorder = "1px solid rgba(244, 63, 94, 0.2)";
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                <span
                                                    style={{
                                                        fontSize: "0.7rem",
                                                        fontWeight: "800",
                                                        background: badgeBg,
                                                        color: badgeColor,
                                                        padding: "0.1rem 0.35rem",
                                                        borderRadius: "4px",
                                                        border: badgeBorder,
                                                    }}
                                                >
                                                    {cat.name}
                                                </span>
                                            </div>
                                            <ul
                                                style={{
                                                    margin: 0,
                                                    paddingLeft: "1.2rem",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "0.35rem",
                                                }}
                                            >
                                                {cat.items.map((item, itemIdx) => (
                                                    <li
                                                        key={itemIdx}
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            color: "var(--text-secondary)",
                                                            lineHeight: "1.45",
                                                            listStyleType: "disc",
                                                        }}
                                                    >
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}
