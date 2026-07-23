/**
 * Recommend.jsx
 *
 * 레이팅 상승 효율 기반 곡 추천 컴포넌트
 * FC/AP 통합 추천 · B39/포텐셜 모드 지원
 */

import React, { useMemo, useState } from "react";
import { Sparkles, TrendingUp, Zap, Music, Star, Award, BarChart3, Filter, Info } from "lucide-react";
import { computeRecommendations } from "../../utils/recommendUtils";
import { getSongTitle } from "../../utils/ratingUtils";
import "./Recommend.css";

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────
const DIFF_COLORS = {
    easy: "var(--color-easy)",
    normal: "var(--color-normal)",
    hard: "var(--color-hard)",
    expert: "var(--color-expert)",
    master: "var(--color-master)",
    append: "var(--color-append)",
};
const DIFF_LABELS = {
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    expert: "Expert",
    master: "Master",
    append: "Append",
};

function pct(v) {
    return (v * 100).toFixed(1) + "%";
}
function fmt1(v) {
    return typeof v === "number" ? v.toFixed(1) : "-";
}
function fmt2(v) {
    return typeof v === "number" ? v.toFixed(2) : "-";
}
function fmt4(v) {
    return typeof v === "number" ? v.toFixed(4) : "-";
}

// ─────────────────────────────────────────
// 단일 추천 카드
// ─────────────────────────────────────────
function RecommendCard({ item, rank, settingsTitleLang, onJacketClick }) {
    const { song, diff, goalStatus, constant, delta, prob, sim, finalScore, currentStatus, isNew } = item;

    const title = getSongTitle(song, settingsTitleLang);
    const diffColor = DIFF_COLORS[diff] || "#aaa";
    const diffLabel = DIFF_LABELS[diff] || diff;
    const jacketUrl = song.jacketUrl || "";
    const goalLabel = goalStatus === "full_perfect" ? "AP" : "FC";
    const goalColor = goalStatus === "full_perfect" ? "var(--color-ap)" : "var(--color-fc)";

    const currentLabel =
        currentStatus === "full_perfect"
            ? "AP"
            : currentStatus === "full_combo"
              ? "FC"
              : currentStatus === "clear"
                ? "C"
                : null;

    const currentColor =
        currentStatus === "full_perfect"
            ? "var(--color-ap)"
            : currentStatus === "full_combo"
              ? "var(--color-fc)"
              : currentStatus === "clear"
                ? "var(--color-clear)"
                : "var(--text-muted)";

    // 포텐셜 모드는 delta가 작은 소수 → 4자리, B39는 정수
    const deltaStr = item.mode === "potential" ? `+${delta.toFixed(2)}` : `+${Math.round(delta)}`;

    return (
        <div className={`rec-card rank-${rank <= 3 ? rank : "other"}`}>
            {/* 순위 */}
            <div className="rec-rank-badge">{`#${rank}`}</div>

            {/* 자켓 */}
            <div
                className="rec-jacket-wrap"
                onClick={() => onJacketClick?.(song, diff, currentStatus)}
                title="자세히 보기"
            >
                {jacketUrl ? (
                    <img src={jacketUrl} alt={title} className="rec-jacket" loading="lazy" />
                ) : (
                    <div className="rec-jacket-placeholder">
                        <Music size={24} />
                    </div>
                )}
                {isNew && <span className="rec-new-badge">NEW</span>}
            </div>

            {/* 곡 정보 */}
            <div className="rec-info">
                <div className="rec-title">{title}</div>
                <div className="rec-meta">
                    <span
                        className="rec-diff-badge"
                        style={{ color: diffColor, borderColor: `${diffColor}55`, background: `${diffColor}18` }}
                    >
                        {diffLabel}
                    </span>
                    <span
                        className="rec-goal-badge"
                        style={{ color: goalColor, borderColor: `${goalColor}55`, background: `${goalColor}18` }}
                    >
                        {goalLabel}
                    </span>
                    <span className="rec-const-badge">상수 {fmt1(constant)}</span>
                    {currentLabel && (
                        <span
                            className="rec-current-badge"
                            style={{
                                color: currentColor,
                                borderColor: `${currentColor}55`,
                                background: `${currentColor}18`,
                            }}
                        >
                            현재: {currentLabel}
                        </span>
                    )}
                </div>
            </div>

            {/* 핵심 수치: 달성 확률 + 상승폭 + 취향 적합도 */}
            <div className="rec-scores-row">
                <div className="rec-score-chip">
                    <span className="chip-label">달성 확률</span>
                    <span
                        className="chip-value"
                        style={{ color: prob > 0.5 ? "#4ade80" : prob > 0.2 ? "#fbbf24" : "#f87171" }}
                    >
                        {pct(prob)}
                    </span>
                </div>
                <div className="rec-score-chip">
                    <span className="chip-label">레이팅</span>
                    <span className="chip-value" style={{ color: "#60a5fa" }}>
                        {deltaStr}
                    </span>
                </div>
                <div className="rec-score-chip">
                    <span className="chip-label">패턴 적합도</span>
                    <span className="chip-value" style={{ color: "#c084fc" }}>
                        {fmt2(sim)}
                    </span>
                </div>
            </div>

            {/* 우측: 추천 점수 */}
            <div className="rec-score-section">
                <div className="rec-final-score">{fmt4(finalScore)}</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function Recommend({
    songs,
    userScoresMap,
    b39List,
    appendB15List,
    potentialData,
    ratingMode,
    settingsTitleLang,
    onJacketClick,
}) {
    const [activeSection, setActiveSection] = useState("normal"); // 'normal' | 'append'
    const [filterGoal, setFilterGoal] = useState("all"); // 'all' | 'fc' | 'ap'
    const [topN, setTopN] = useState(20);
    const [showInfo, setShowInfo] = useState(false);

    const handleToggleFilterGoal = () => {
        setFilterGoal((prev) => {
            if (prev === "all") return "fc";
            if (prev === "fc") return "ap";
            return "all";
        });
    };

    // 추천 계산 (FC+AP 통합)
    const recommendations = useMemo(() => {
        if (!songs?.length || !userScoresMap) {
            return { b39Normal: [], b39Append: [], potentialAll: [], mu: 0, muFC: 0, muAP: 0, top39Entries: [] };
        }
        return computeRecommendations({
            songs,
            userScoresMap,
            b39List: b39List || [],
            appendB15List: appendB15List || [],
            potentialData: potentialData || { oldBest30: [], newBest10: [] },
            ratingMode,
            filterGoal,
            topN,
        });
    }, [songs, userScoresMap, b39List, appendB15List, potentialData, ratingMode, filterGoal, topN]);

    const { b39Normal, b39Append, potentialAll, mu, muFC, muAP, mu_apd, muFC_apd, muAP_apd } = recommendations;

    // 현재 표시 목록
    const currentList = ratingMode === "b39" ? (activeSection === "append" ? b39Append : b39Normal) : potentialAll;

    const maxScore = currentList[0]?.finalScore || 1;
    const hasData = userScoresMap?.size > 0;
    const hasResults = currentList?.length > 0;

    // B39 모드 섹션 탭
    const sectionTabs = [
        { key: "normal", label: "B39" },
        { key: "append", label: "APD B15" },
    ];

    const isAppendSection = ratingMode === "b39" && activeSection === "append";

    return (
        <section className="glass-panel recommend-panel">
            {/* 헤더 */}
            <div className="section-title-bar">
                <div>
                    <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Star size={22} style={{ color: "var(--color-cyan)" }} /> 곡 추천
                    </h2>
                </div>

                {/* 유저 체급 */}
                {hasData && (
                    <div className="rec-mu-row">
                        <div className="rec-mu-chip">
                            <span className="mu-label">{isAppendSection ? "APD AVG" : "AVG"}</span>
                            <span className="mu-value">{isAppendSection ? fmt2(mu_apd) : fmt2(mu)}</span>
                        </div>
                        <div className="rec-mu-chip">
                            <span className="mu-label">{isAppendSection ? "APD FC" : "FC"}</span>
                            <span className="mu-value" style={{ color: "var(--color-fc)" }}>
                                {isAppendSection ? fmt2(muFC_apd) : fmt2(muFC)}
                            </span>
                        </div>
                        <div className="rec-mu-chip">
                            <span className="mu-label">{isAppendSection ? "APD AP" : "AP"}</span>
                            <span className="mu-value" style={{ color: "var(--color-ap)" }}>
                                {isAppendSection ? fmt2(muAP_apd) : fmt2(muAP)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* 컨트롤 바 */}
            <div className="rec-controls">
                {/* B39 모드일 때만 섹션 탭 */}
                {ratingMode === "b39" && (
                    <div className="rec-section-tabs">
                        {sectionTabs.map((tab) => (
                            <button
                                key={tab.key}
                                className={`rec-section-tab ${activeSection === tab.key ? "active" : ""}`}
                                onClick={() => setActiveSection(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* 포텐셜 모드 레이블 */}
                {ratingMode === "potential" && (
                    <div className="rec-section-tabs">
                        <div className="rec-section-tab active">포텐셜</div>
                    </div>
                )}

                {/* FC/AP 성과 목표 토글 버튼 */}
                <div className="rec-section-tabs">
                    <button
                        className={`rec-section-tab active ${filterGoal === "fc" ? "fc" : filterGoal === "ap" ? "ap" : ""}`}
                        onClick={handleToggleFilterGoal}
                        style={{ minWidth: "90px", justifyContent: "center" }}
                    >
                        {filterGoal === "all" && "ALL"}
                        {filterGoal === "fc" && "FC"}
                        {filterGoal === "ap" && "AP"}
                    </button>
                </div>

                {/* 표시 개수 */}
                <div className="rec-topn-control">
                    <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="rec-topn-select">
                        <option value={10}>TOP 10</option>
                        <option value={20}>TOP 20</option>
                        <option value={30}>TOP 30</option>
                        <option value={50}>TOP 50</option>
                    </select>
                </div>
            </div>

            {/* 결과 목록 */}
            {!hasData ? (
                <div className="rec-empty-state">
                    <Award size={48} className="empty-icon" />
                    <h3>성과 데이터가 없습니다</h3>
                    <p>곡 기록을 등록하면 맞춤 추천을 받을 수 있어요.</p>
                </div>
            ) : !hasResults ? (
                <div className="rec-empty-state">
                    <BarChart3 size={48} className="empty-icon" />
                    <h3>추천 가능한 곡이 없습니다</h3>
                    <p>현재 조건에서 레이팅을 올릴 수 있는 곡이 없거나 모두 달성하셨습니다.</p>
                </div>
            ) : (
                <div className="rec-list">
                    {currentList.map((item, idx) => (
                        <RecommendCard
                            key={`${item.song.id}-${item.diff}-${item.goalStatus}`}
                            item={item}
                            rank={idx + 1}
                            settingsTitleLang={settingsTitleLang}
                            onJacketClick={onJacketClick}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
