import React, { useState, useEffect } from "react";
import { X, Info } from "lucide-react";

export default function PrivacySettingsModal({
    isOpen,
    onClose,
    currentUser,
    handleSaveSettings,
    settingsNickname,
    settingsTitleLang,
    ratingMode,
    showUnreleased,
    trainerSpeed,
}) {
    const [showInfo, setShowInfo] = useState(false);

    // Public scope checkboxes
    const [pubDashboard, setPubDashboard] = useState(true);
    const [pubDetailed, setPubDetailed] = useState(true);
    const [pubTimeline, setPubTimeline] = useState(true);

    // Friends scope checkboxes
    const [frDashboard, setFrDashboard] = useState(true);
    const [frDetailed, setFrDetailed] = useState(true);
    const [frTimeline, setFrTimeline] = useState(true);

    useEffect(() => {
        if (currentUser?.settings) {
            const privacyScope = currentUser.settings.privacyScope || {};
            const pubScope = privacyScope.publicScope || {};
            setPubDashboard(pubScope.showDashboardSongs !== false);
            setPubDetailed(pubScope.showDetailedScores === true);
            setPubTimeline(pubScope.showTimeline === true);

            const frScope = privacyScope.friendsScope || {};
            setFrDashboard(frScope.showDashboardSongs !== false);
            setFrDetailed(frScope.showDetailedScores !== false);
            setFrTimeline(frScope.showTimeline !== false);
        }
    }, [currentUser, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        handleSaveSettings(
            settingsNickname,
            settingsTitleLang,
            ratingMode,
            showUnreleased,
            trainerSpeed,
            undefined, // privacyTarget is no longer used
            {
                publicScope: {
                    showDashboardSongs: pubDashboard,
                    showDetailedScores: pubDetailed,
                    showTimeline: pubTimeline,
                },
                friendsScope: {
                    showDashboardSongs: frDashboard,
                    showDetailedScores: frDetailed,
                    showTimeline: frTimeline,
                },
            },
        );
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "550px", width: "100%", padding: "2rem", position: "relative" }}
            >
                {/* Close button */}
                <button
                    className="btn-close"
                    style={{
                        position: "absolute",
                        top: "1.25rem",
                        right: "1.25rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                    }}
                    onClick={onClose}
                    aria-label="닫기"
                >
                    <X size={20} />
                </button>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        marginBottom: "1.5rem",
                    }}
                >
                    <h3
                        style={{
                            fontSize: "1.5rem",
                            margin: 0,
                            background: "linear-gradient(135deg, var(--color-cyan) 0%, var(--color-cyan) 100%)",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        공개 범위 세부 설정
                    </h3>
                    <button
                        type="button"
                        onClick={() => setShowInfo(!showInfo)}
                        style={{
                            background: "none",
                            border: "none",
                            color: showInfo ? "var(--color-cyan)" : "var(--text-muted)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "0.25rem",
                            borderRadius: "50%",
                            transition: "var(--transition-smooth)",
                        }}
                        title="공개 범위 도움말"
                    >
                        <Info size={18} />
                    </button>
                </div>

                {showInfo && (
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            lineHeight: "1.5",
                            borderRadius: "10px",
                            border: "1px solid rgba(0, 242, 254, 0.2)",
                            background: "rgba(0, 242, 254, 0.03)",
                            marginBottom: "1.25rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.45rem",
                        }}
                    >
                        <div style={{ fontWeight: 700, color: "var(--color-cyan)" }}>공개 범위 </div>
                        <div>
                            • <strong>기록</strong>: 대시보드의 B39, 어펜드 B15 등의 상위곡 카드 리스트 노출 여부입니다.
                        </div>
                        <div>
                            • <strong>세부기록</strong>: 개인기록 탭 내의 전체 악곡 세부 클리어 기록 노출 여부입니다.
                        </div>
                        <div>
                            • <strong>타임라인</strong>: 타임라인 탭의 연도/날짜별 풀콤보/퍼펙트 달성 날짜 기록 노출
                            여부입니다.
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {/* Two Scope Configurations */}
                    <div
                        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "0.5rem" }}
                    >
                        {/* 1. Public Scope Configuration */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            <label
                                style={{
                                    fontWeight: 700,
                                    fontSize: "0.9rem",
                                    color: "var(--color-cyan)",
                                    borderBottom: "1px solid rgba(0, 242, 254, 0.2)",
                                    paddingBottom: "0.4rem",
                                }}
                            >
                                일반 유저
                            </label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <label
                                    className="checkbox-label"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={pubDashboard}
                                        onChange={(e) => setPubDashboard(e.target.checked)}
                                    />
                                    기록
                                </label>
                                <label
                                    className="checkbox-label"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={pubDetailed}
                                        onChange={(e) => setPubDetailed(e.target.checked)}
                                    />
                                    세부기록
                                </label>
                                <label
                                    className="checkbox-label"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={pubTimeline}
                                        onChange={(e) => setPubTimeline(e.target.checked)}
                                    />
                                    타임라인
                                </label>
                            </div>
                        </div>

                        {/* 2. Friends Scope Configuration */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            <label
                                style={{
                                    fontWeight: 700,
                                    fontSize: "0.9rem",
                                    color: "#c77dff",
                                    borderBottom: "1px solid rgba(199, 125, 255, 0.2)",
                                    paddingBottom: "0.4rem",
                                }}
                            >
                                친구
                            </label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <label
                                    className="checkbox-label"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={frDashboard}
                                        onChange={(e) => setFrDashboard(e.target.checked)}
                                    />
                                    기록
                                </label>
                                <label
                                    className="checkbox-label"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={frDetailed}
                                        onChange={(e) => setFrDetailed(e.target.checked)}
                                    />
                                    세부기록
                                </label>
                                <label
                                    className="checkbox-label"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={frTimeline}
                                        onChange={(e) => setFrTimeline(e.target.checked)}
                                    />
                                    타임라인
                                </label>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="btn btn-primary animate-glow"
                        style={{ width: "100%", padding: "0.75rem", marginTop: "1rem" }}
                        onClick={handleSave}
                    >
                        설정 저장
                    </button>
                </div>
            </div>
        </div>
    );
}
