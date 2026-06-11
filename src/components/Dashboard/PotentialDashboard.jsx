import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, TrendingUp, Star } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { RatingGraph } from "./RatingGraph";
import { getTierInfo, getTierDisplayName, isNewSong, formatPublishedDate } from "../../utils/potentialUtils";

// ─── Tier Badge Component ────────────────────────────────
export const TierBadge = ({ potential, size = "md" }) => {
    const tier = getTierInfo(potential);
    const displayName = getTierDisplayName(tier);

    const sizes = {
        sm: { fontSize: "0.7rem" },
        md: { fontSize: "0.85rem" },
        lg: { fontSize: "1.1rem" },
        xl: { fontSize: "1.3rem" },
    };
    const sz = sizes[size] || sizes.md;

    return (
        <span
            style={{
                display: "inline-block",
                color: "#ffffff",
                fontWeight: 600,
                letterSpacing: "0.02em",
                ...sz,
            }}
        >
            {displayName}
        </span>
    );
};

// ─── Main Potential Dashboard ────────────────────────────
export const PotentialDashboard = ({
    effectiveUser,
    potentialRating,
    oldBest30,
    newBest10,
    isViewedDashboardLoading,
    viewedDashboardError,
    viewedUser,
    settingsTitleLang,
}) => {
    const navigate = useNavigate();
    const [subTab, setSubTab] = useState("old"); // "old" | "new"

    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") return song.title_ko || song.title_jp || "";
        return song.title_jp || song.title_ko || "";
    };

    if (isViewedDashboardLoading) {
        return (
            <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-muted)" }}>
                <div
                    style={{
                        display: "inline-block",
                        width: "40px",
                        height: "40px",
                        border: "4px solid rgba(255,255,255,0.1)",
                        borderRadius: "50%",
                        borderTopColor: "var(--color-cyan)",
                        animation: "spin 1s linear infinite",
                        marginBottom: "1rem",
                    }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{ fontWeight: "700" }}>유저 대시보드 정보를 불러오는 중입니다...</div>
            </div>
        );
    }

    if (viewedDashboardError) {
        return (
            <div
                className="glass-panel"
                style={{
                    textAlign: "center",
                    padding: "4rem 2rem",
                    margin: "2rem auto",
                    maxWidth: "500px",
                    border: "1px solid rgba(220,53,69,0.2)",
                }}
            >
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                <h3
                    style={{
                        fontSize: "1.2rem",
                        marginBottom: "1.5rem",
                        fontWeight: "700",
                        color: "var(--color-danger)",
                    }}
                >
                    {viewedDashboardError}
                </h3>
                <button className="btn btn-primary animate-glow" onClick={() => navigate("/dashboard")}>
                    내 대시보드로 돌아가기
                </button>
            </div>
        );
    }

    const tier = getTierInfo(potentialRating);
    const displayName = getTierDisplayName(tier);
    const effectiveUserDisplayName = effectiveUser ? effectiveUser.nickname : "Guest";
    const effectiveUserUsername = effectiveUser ? effectiveUser.username : "guest";

    // Potential 표시용 (소수점 2자리 내림)
    const potentialDisplay = Math.floor(potentialRating * 100) / 100;

    const allItems = subTab === "old" ? oldBest30 : newBest10;

    return (
        <div className="dashboard-grid">
            {/* Left Stats Sidebar */}
            <aside className="stats-sidebar">
                {/* Profile Header Card */}
                <div
                    className="glass-panel"
                    style={{
                        padding: "1.25rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        border: viewedUser ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-color)",
                        background: viewedUser ? "rgba(0, 242, 254, 0.03)" : "",
                        marginBottom: "0.5rem",
                    }}
                >
                    <div
                        style={{
                            fontSize: "1.2rem",
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                        }}
                    >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {effectiveUserDisplayName}
                        </span>
                        {viewedUser && (
                            <button
                                className="btn btn-outline"
                                style={{
                                    padding: "0.2rem 0.5rem",
                                    fontSize: "0.7rem",
                                    borderColor: "var(--border-color)",
                                    flexShrink: 0,
                                }}
                                onClick={() => navigate("/dashboard")}
                            >
                                내 정보 보기
                            </button>
                        )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>@{effectiveUserUsername}</div>
                </div>

                {/* Potential & Tier Card */}
                <div className="glass-panel profile-card" style={{ position: "relative" }}>
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: tier.gradient,
                            zIndex: 2,
                        }}
                    />
                    <div className="rating-title">Potential</div>
                    <div
                        key={potentialRating}
                        className="rating-value"
                        style={{
                            background: tier.gradient,
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontSize: "2.8rem",
                            fontWeight: 900,
                            lineHeight: "1.1",
                            marginBottom: "0.5rem",
                        }}
                    >
                        {potentialDisplay.toFixed(2)}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <TierBadge potential={potentialRating} size="lg" />
                    </div>
                </div>

                {/* Best 30/10 Stats */}
                <div className="glass-panel stat-box" style={{ marginBottom: "0.25rem" }}>
                    <span className="stat-label">Old Best 30 평균</span>
                    <span className="stat-val" style={{ fontSize: "1.2rem", color: "var(--color-cyan)" }}>
                        {oldBest30.length > 0
                            ? (oldBest30.reduce((a, e) => a + e.potential, 0) / oldBest30.length).toFixed(2)
                            : "0.00"}
                    </span>
                </div>

                <div className="glass-panel stat-box" style={{ marginBottom: "0.25rem" }}>
                    <span className="stat-label">New Best 10 평균</span>
                    <span className="stat-val" style={{ fontSize: "1.2rem", color: "#ffd93d" }}>
                        {newBest10.length > 0
                            ? (newBest10.reduce((a, e) => a + e.potential, 0) / newBest10.length).toFixed(2)
                            : "0.00"}
                    </span>
                </div>

                <div className="glass-panel stat-box">
                    <span className="stat-label">커트라인 (OB / NB)</span>
                    <span className="stat-val" style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>
                        {oldBest30.length === 30 ? oldBest30[29].potential.toFixed(1) : "0.0"} /{" "}
                        {newBest10.length === 10 ? newBest10[9].potential.toFixed(1) : "0.0"}
                    </span>
                </div>
            </aside>

            {/* Right Panel */}
            <section className="glass-panel main-content">
                {/* Rating Graph */}
                <div
                    className="glass-panel"
                    style={{ padding: "1.5rem", marginBottom: "1.5rem", background: "rgba(10, 15, 30, 0.4)" }}
                >
                    <h3
                        style={{
                            fontSize: "1.1rem",
                            marginBottom: "1rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontWeight: "700",
                        }}
                    >
                        <TrendingUp size={18} style={{ color: "var(--color-cyan)" }} /> Potential 상승 추세
                    </h3>
                    <RatingGraph effectiveUser={effectiveUser} mode="potential" />
                </div>

                {/* Sub Tab */}
                <div
                    className="section-title-bar"
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1rem" }}
                >
                    <div>
                        <h2 className="section-title">
                            <TrendingUp size={22} style={{ color: "var(--color-cyan)" }} /> B40
                        </h2>
                    </div>
                    <div className="tabs-header" style={{ width: "100%", marginBottom: 0, paddingBottom: 0 }}>
                        <button
                            className={`tab-btn ${subTab === "old" ? "active" : ""}`}
                            onClick={() => setSubTab("old")}
                        >
                            Old best
                        </button>
                        <button
                            className={`tab-btn ${subTab === "new" ? "active" : ""}`}
                            onClick={() => setSubTab("new")}
                            style={{
                                borderBottomColor: subTab === "new" ? "#ffd93d" : "",
                                color: subTab === "new" ? "#ffd93d" : "",
                            }}
                        >
                            New best
                        </button>
                    </div>
                </div>

                {/* Song List */}
                <div className="b39-list">
                    {allItems.length === 0 ? (
                        <div
                            style={{
                                gridColumn: "1 / -1",
                                textAlign: "center",
                                padding: "4rem 0",
                                color: "var(--text-muted)",
                            }}
                        >
                            {subTab === "old"
                                ? "Old Best 30에 해당하는 기록이 없습니다."
                                : "New Best 10에 해당하는 신곡 기록이 없습니다."}
                        </div>
                    ) : (
                        allItems.map((item, index) => {
                            const diffColors = {
                                easy: "diff-easy",
                                normal: "diff-normal",
                                hard: "diff-hard",
                                expert: "diff-expert",
                                master: "diff-master",
                                append: "diff-append",
                            };
                            const songNew = isNewSong(item.song);
                            const publishedStr = formatPublishedDate(item.song.publishedAt);
                            return (
                                <div
                                    key={`${item.song.id}-${item.diff}`}
                                    className={`glass-panel b39-item status-${item.status || "clear"} hover-lift`}
                                    style={{ position: "relative" }}
                                >
                                    {/* NEW badge */}
                                    {songNew && (
                                        <span
                                            className="new-song-badge"
                                            style={{
                                                position: "absolute",
                                                top: "6px",
                                                right: "6px",
                                                background: "linear-gradient(135deg, #ff4545ed, #f42516)",
                                                color: "#000",
                                                fontWeight: 800,
                                                fontSize: "0.6rem",
                                                padding: "0.15rem 0.35rem",
                                                borderRadius: "4px",
                                                zIndex: 2,
                                                letterSpacing: "0.05em",
                                            }}
                                        >
                                            NEW
                                        </span>
                                    )}
                                    <div className="b39-rank">#{index + 1}</div>
                                    <div className="b39-jacket-wrapper">
                                        <JacketImage songId={item.song.id} size={200} className="b39-jacket" />
                                    </div>
                                    <div className="b39-card-body">
                                        <div className="b39-title" title={getSongTitle(item.song)}>
                                            {getSongTitle(item.song)}
                                        </div>
                                        <div className="b39-meta-row">
                                            <span className={`diff-badge ${diffColors[item.diff] || "diff-master"}`}>
                                                {item.diff === "append"
                                                    ? "APD"
                                                    : item.diff.toUpperCase().substring(0, 3)}{" "}
                                                {item.level}
                                            </span>
                                            <span
                                                className={`status-badge ${
                                                    item.status === "full_perfect"
                                                        ? "status-ap"
                                                        : item.status === "full_combo"
                                                          ? "status-fc"
                                                          : "status-clear"
                                                }`}
                                            >
                                                {item.status === "full_perfect"
                                                    ? "AP"
                                                    : item.status === "full_combo"
                                                      ? "FC"
                                                      : "C"}
                                            </span>
                                        </div>
                                        <div className="b39-rating-row">
                                            <span className="b39-constant">{item.constant.toFixed(1)}</span>
                                            <span
                                                className="b39-rating-value"
                                                style={{
                                                    background: "linear-gradient(135deg, #c77dff, #87ceeb)",
                                                    WebkitBackgroundClip: "text",
                                                    backgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                }}
                                            >
                                                {item.potential.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
};
