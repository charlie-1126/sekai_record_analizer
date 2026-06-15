import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, TrendingUp } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { RatingGraph } from "./RatingGraph";
import { useSessionState } from "../../utils/useSessionState";

export const Dashboard = ({
    effectiveUser,
    playerRating,
    playerAppendRating,
    b39List,
    appendB15List,
    overallStats,
    isViewedDashboardLoading,
    viewedDashboardError,
    viewedUser,
    settingsTitleLang,
}) => {
    const navigate = useNavigate();
    const [dashboardSubTab, setDashboardSubTab] = useSessionState("pjsk_dashboard_sub_tab", "b39"); // b39 or b15

    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    if (isViewedDashboardLoading) {
        return (
            <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-muted)" }}>
                <div
                    className="loading-spinner"
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
                ></div>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
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

    const effectiveUserDisplayName = effectiveUser ? effectiveUser.nickname : "Guest";
    const effectiveUserUsername = effectiveUser ? effectiveUser.username : "guest";

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
                        <span
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                            }}
                        >
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

                {/* 일반 셐포스 B39 */}
                <div className="glass-panel profile-card" style={{ marginBottom: "0.25rem" }}>
                    <div className="rating-title">Player R</div>
                    <div className="rating-value">{playerRating}</div>
                </div>

                {/* 어펜드 셐포스 B15 */}
                <div className="glass-panel profile-card" style={{ position: "relative" }}>
                    <div className="rating-title" style={{ color: "var(--color-append)" }}>
                        Append R
                    </div>
                    <div
                        className="rating-value"
                        style={{
                            background: "linear-gradient(135deg, #ffffff 30%, #ff9ebe 100%)",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        {playerAppendRating}
                    </div>
                </div>

                <div className="glass-panel stat-box">
                    <span className="stat-label">B39 평균 / 커트라인</span>
                    <span className="stat-val" style={{ fontSize: "1.2rem", color: "var(--color-cyan)" }}>
                        {b39List.length > 0 ? (playerRating / b39List.length).toFixed(1) : "0.0"} /{" "}
                        {b39List.length === 39 ? Math.round(b39List[38].rating) : "0"}
                    </span>
                </div>

                <div className="glass-panel stat-box">
                    <span className="stat-label">어펜드 B15 평균 / 커트라인</span>
                    <span className="stat-val" style={{ fontSize: "1.2rem", color: "var(--color-append)" }}>
                        {appendB15List.length > 0
                            ? (appendB15List.reduce((acc, c) => acc + c.rating, 0) / appendB15List.length).toFixed(1)
                            : "0.0"}{" "}
                        / {appendB15List.length === 15 ? Math.round(appendB15List[14].rating) : "0"}
                    </span>
                </div>

                <div className="stat-grid-half">
                    <div className="glass-panel stat-box">
                        <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <span style={{ color: "var(--color-ap)" }}>●</span> AP 수
                        </span>
                        <span className="stat-val">{overallStats.apCount}</span>
                    </div>
                    <div className="glass-panel stat-box">
                        <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <span style={{ color: "var(--color-fc)" }}>●</span> FC 수
                        </span>
                        <span className="stat-val">{overallStats.fcCount}</span>
                    </div>
                </div>
            </aside>

            {/* Right B39 / B15 List Panel */}
            <section className="glass-panel main-content">
                {/* 레이팅 상승 추세 그래프 */}
                <div
                    className="glass-panel"
                    style={{
                        padding: "1.5rem",
                        marginBottom: "1.5rem",
                        background: "rgba(10, 15, 30, 0.4)",
                    }}
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
                        <TrendingUp size={18} style={{ color: "var(--color-cyan)" }} /> 레이팅 상승 추세
                    </h3>
                    <RatingGraph effectiveUser={effectiveUser} />
                </div>

                <div
                    className="section-title-bar"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "1rem",
                    }}
                >
                    <div>
                        <h2 className="section-title">
                            <TrendingUp size={22} style={{ color: "var(--color-cyan)" }} /> B39
                        </h2>
                    </div>

                    {/* Dashboard Inner Sub Tab Selector */}
                    <div className="tabs-header" style={{ width: "100%", marginBottom: 0, paddingBottom: 0 }}>
                        <button
                            className={`tab-btn ${dashboardSubTab === "b39" ? "active" : ""}`}
                            onClick={() => setDashboardSubTab("b39")}
                        >
                            B39
                        </button>
                        <button
                            className={`tab-btn ${dashboardSubTab === "b15" ? "active" : ""}`}
                            onClick={() => setDashboardSubTab("b15")}
                            style={{
                                borderBottomColor: dashboardSubTab === "b15" ? "var(--color-append)" : "",
                                color: dashboardSubTab === "b15" ? "var(--color-append)" : "",
                            }}
                        >
                            APD B15
                        </button>
                    </div>
                </div>

                <div className="b39-list">
                    {dashboardSubTab === "b39" ? (
                        b39List.length === 0 ? (
                            <div
                                style={{
                                    gridColumn: "1 / -1",
                                    textAlign: "center",
                                    padding: "4rem 0",
                                    color: "var(--text-muted)",
                                }}
                            >
                                등록된 일반 셐포스 B39 성과 기록이 없습니다.
                            </div>
                        ) : (
                            b39List.map((item, index) => {
                                const diffColors = {
                                    easy: "diff-easy",
                                    normal: "diff-normal",
                                    hard: "diff-hard",
                                    expert: "diff-expert",
                                    master: "diff-master",
                                };
                                return (
                                    <div
                                        key={`${item.song.id}-${item.diff}`}
                                        className={`glass-panel b39-item status-${item.status || "clear"} hover-lift`}
                                    >
                                        <div className="b39-rank">#{index + 1}</div>
                                        <div className="b39-jacket-wrapper">
                                            <JacketImage songId={item.song.id} size={200} className="b39-jacket" />
                                        </div>
                                        <div className="b39-card-body">
                                            <div className="b39-title" title={getSongTitle(item.song)}>
                                                {getSongTitle(item.song)}
                                            </div>
                                            <div className="b39-meta-row">
                                                <span className={`diff-badge ${diffColors[item.diff]}`}>
                                                    {item.diff.toUpperCase().substring(0, 3)} {item.level}
                                                </span>
                                                <span
                                                    className={`status-badge ${item.status === "full_perfect" ? "status-ap" : item.status === "full_combo" ? "status-fc" : "status-clear"}`}
                                                >
                                                    {item.status === "full_perfect"
                                                        ? "AP"
                                                        : item.status === "full_combo"
                                                          ? "FC"
                                                          : "C"}
                                                </span>
                                            </div>
                                            <div className="b39-rating-row">
                                                <span className="b39-constant">
                                                    {item.constant.toFixed(1)}
                                                    {!item.hasConstant && "?"}
                                                </span>
                                                <span className="b39-rating-value">{Math.round(item.rating)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )
                    ) : appendB15List.length === 0 ? (
                        <div
                            style={{
                                gridColumn: "1 / -1",
                                textAlign: "center",
                                padding: "4rem 0",
                                color: "var(--text-muted)",
                            }}
                        >
                            등록된 어펜드 B15 성과 기록이 없습니다.
                        </div>
                    ) : (
                        appendB15List.map((item, index) => (
                            <div
                                key={`${item.song.id}-append`}
                                className={`glass-panel b39-item status-${item.status || "clear"} append-item hover-lift`}
                            >
                                <div className="b39-rank">#{index + 1}</div>
                                <div className="b39-jacket-wrapper">
                                    <JacketImage songId={item.song.id} size={200} className="b39-jacket" />
                                </div>
                                <div className="b39-card-body">
                                    <div className="b39-title" title={getSongTitle(item.song)}>
                                        {getSongTitle(item.song)}
                                    </div>
                                    <div className="b39-meta-row">
                                        <span className="diff-badge diff-append">APD {item.level}</span>
                                        <span
                                            className={`status-badge ${item.status === "full_perfect" ? "status-ap" : item.status === "full_combo" ? "status-fc" : "status-clear"}`}
                                        >
                                            {item.status === "full_perfect"
                                                ? "AP"
                                                : item.status === "full_combo"
                                                  ? "FC"
                                                  : "C"}
                                        </span>
                                    </div>
                                    <div className="b39-rating-row">
                                        <span className="b39-constant">
                                            {item.constant.toFixed(1)}
                                            {!item.hasConstant && "?"}
                                        </span>
                                        <span className="b39-rating-value">{Math.round(item.rating)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};
