import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Layers, Filter, Search } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { getConstant, hasExplicitConstant } from "../../utils/ratingUtils";
import { isNewSong } from "../../utils/potentialUtils";

export const Constants = ({
    songs,
    scores,
    onJacketClick,
    settingsTitleLang,
    ratingMode = "b39",
    b39List = [],
    potentialData = null,
}) => {
    // --- States ---
    const [isConstFilterExpanded, setIsConstFilterExpanded] = useState(true);
    const [constSearchInput, setConstSearchInput] = useState("");
    const [constSearch, setConstSearch] = useState("");
    const [constVisibleCount, setConstVisibleCount] = useState(15);
    const [constDiffFilters, setConstDiffFilters] = useState(["master"]);
    const [constPlayFilters, setConstPlayFilters] = useState(["unplayed", "played", "fc", "ap"]);
    const [constMinLevelInput, setConstMinLevelInput] = useState("");
    const [constMaxLevelInput, setConstMaxLevelInput] = useState("");
    const [constMinLevel, setConstMinLevel] = useState("");
    const [constMaxLevel, setConstMaxLevel] = useState("");
    const [constType, setConstType] = useState("fc"); // "fc", "ap"
    const [constNewFilter, setConstNewFilter] = useState("all"); // "all", "new", "old"

    // --- Debounce Search Term ---
    useEffect(() => {
        const handler = setTimeout(() => {
            setConstSearch(constSearchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [constSearchInput]);

    // --- Reset visible count on filter changes ---
    useEffect(() => {
        setConstVisibleCount(15);
    }, [
        constSearch,
        constDiffFilters,
        constPlayFilters,
        constMinLevelInput,
        constMaxLevelInput,
        constMinLevel,
        constMaxLevel,
        constType,
    ]);

    // --- Infinite scroll observer ---
    const constObserver = useRef(null);
    const constSentinelRef = useCallback((node) => {
        if (constObserver.current) constObserver.current.disconnect();
        constObserver.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setConstVisibleCount((prev) => prev + 15);
                }
            },
            { rootMargin: "200px" },
        );
        if (node) constObserver.current.observe(node);
    }, []);

    // --- Map scores list to a Map for fast lookups ---
    const userScoresMap = useMemo(() => {
        const map = new Map();
        scores.forEach((s) => {
            if (s && s.id) {
                map.set(String(s.id), {
                    easy: s.easy,
                    normal: s.normal,
                    hard: s.hard,
                    expert: s.expert,
                    master: s.master,
                    append: s.append,
                });
            }
        });
        return map;
    }, [scores]);

    // --- Cutoff Calculations ---
    const cutoffs = useMemo(() => {
        // B39 Mode Cutoffs
        const cutoffB1 = b39List[0]?.rating || 0;
        const cutoffB20 = b39List[19]?.rating || b39List[b39List.length - 1]?.rating || 0;
        const cutoffB39 = b39List[38]?.rating || b39List[b39List.length - 1]?.rating || 0;

        // Potential Mode Cutoffs (OB = Old Best, NB = New Best)
        const oldBest = potentialData?.oldBest30 || [];
        const newBest = potentialData?.newBest10 || [];

        const cutoffOB1 = oldBest[0]?.potential || 0;
        const cutoffOB15 = oldBest[14]?.potential || oldBest[oldBest.length - 1]?.potential || 0;
        const cutoffOB30 = oldBest[29]?.potential || oldBest[oldBest.length - 1]?.potential || 0;

        const cutoffNB1 = newBest[0]?.potential || 0;
        const cutoffNB5 = newBest[4]?.potential || newBest[newBest.length - 1]?.potential || 0;
        const cutoffNB10 = newBest[9]?.potential || newBest[newBest.length - 1]?.potential || 0;

        return {
            cutoffB1,
            cutoffB20,
            cutoffB39,
            cutoffOB1,
            cutoffOB15,
            cutoffOB30,
            cutoffNB1,
            cutoffNB5,
            cutoffNB10,
        };
    }, [b39List, potentialData]);

    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    const handleDiffFilterToggle = (diff) => {
        if (constDiffFilters.includes(diff)) {
            if (constDiffFilters.length > 1) {
                setConstDiffFilters(constDiffFilters.filter((d) => d !== diff));
            }
        } else {
            setConstDiffFilters([...constDiffFilters, diff]);
        }
    };

    const handlePlayFilterToggle = (playStatus) => {
        if (constPlayFilters.includes(playStatus)) {
            if (constPlayFilters.length > 1) {
                setConstPlayFilters(constPlayFilters.filter((p) => p !== playStatus));
            }
        } else {
            setConstPlayFilters([...constPlayFilters, playStatus]);
        }
    };

    // --- Grouping By Constants Logic ---
    const groupedConstants = useMemo(() => {
        const minConstVal = constMinLevelInput === "" ? 0.0 : parseFloat(constMinLevelInput);
        const maxConstVal = constMaxLevelInput === "" ? 100.0 : parseFloat(constMaxLevelInput);
        const minLvlVal = constMinLevel === "" ? 0 : parseInt(constMinLevel);
        const maxLvlVal = constMaxLevel === "" ? 100 : parseInt(constMaxLevel);

        const allChartsList = [];

        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id));

            constDiffFilters.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;

                const queryStatus = constType === "ap" ? "full_perfect" : constType === "fc" ? "full_combo" : "clear";
                const constant = getConstant(song, diff, queryStatus);
                const hasConstant = hasExplicitConstant(song, diff, queryStatus);

                if (constant < minConstVal || constant > maxConstVal) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const status = userPlay ? userPlay[diff] : null;
                let mappedStatus = "unplayed";
                if (status === "full_perfect") mappedStatus = "ap";
                else if (status === "full_combo") mappedStatus = "fc";
                else if (status === "clear") mappedStatus = "played";

                if (!constPlayFilters.includes(mappedStatus)) return;

                if (constSearch.trim() !== "") {
                    const query = constSearch.toLowerCase();
                    const matchesText =
                        (song.title_ko || "").toLowerCase().includes(query) ||
                        (song.title_jp || "").toLowerCase().includes(query) ||
                        (song.title_hangul || "").toLowerCase().includes(query) ||
                        (song.composer || "").toLowerCase().includes(query);

                    if (!matchesText) return;
                }

                // 신곡 필터
                const songNew = isNewSong(song);
                if (constNewFilter === "new" && !songNew) return;
                if (constNewFilter === "old" && songNew) return;

                allChartsList.push({
                    song,
                    diff,
                    level: lvl,
                    constant,
                    hasConstant,
                    status: status || "none",
                    statusClass:
                        status === "full_perfect"
                            ? "ap"
                            : status === "full_combo"
                              ? "fc"
                              : status === "clear"
                                ? "clear"
                                : "unplayed",
                });
            });
        });

        const groups = {};
        allChartsList.forEach((chart) => {
            const key = chart.constant.toFixed(1);
            if (!groups[key]) groups[key] = [];
            groups[key].push(chart);
        });

        const sortedKeys = Object.keys(groups).sort((a, b) => parseFloat(b) - parseFloat(a));

        const sortedGroups = sortedKeys.map((key) => {
            const charts = groups[key].sort((a, b) => getSongTitle(a.song).localeCompare(getSongTitle(b.song)));
            return {
                constantValue: parseFloat(key),
                charts,
                count: charts.length,
            };
        });

        return sortedGroups;
    }, [
        songs,
        userScoresMap,
        constSearch,
        constDiffFilters,
        constPlayFilters,
        constMinLevelInput,
        constMaxLevelInput,
        constMinLevel,
        constMaxLevel,
        constType,
        constNewFilter,
        settingsTitleLang,
    ]);

    // --- Find boundary constant values ---
    const boundaries = useMemo(() => {
        if (groupedConstants.length === 0) return {};

        const result = {
            b1: null,
            b20: null,
            b39: null,
            ob1: null,
            ob15: null,
            ob30: null,
            nb1: null,
            nb5: null,
            nb10: null,
        };

        const multiplier = constType === "ap" ? 8.0 : 7.5;

        if (ratingMode === "b39") {
            const b1Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffB1 > 0 && Math.round(g.constantValue * multiplier) >= cutoffs.cutoffB1,
            );
            if (b1Groups.length > 0) result.b1 = b1Groups[b1Groups.length - 1].constantValue;

            const b20Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffB20 > 0 && Math.round(g.constantValue * multiplier) >= cutoffs.cutoffB20,
            );
            if (b20Groups.length > 0) result.b20 = b20Groups[b20Groups.length - 1].constantValue;

            const b39Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffB39 > 0 && Math.round(g.constantValue * multiplier) >= cutoffs.cutoffB39,
            );
            if (b39Groups.length > 0) result.b39 = b39Groups[b39Groups.length - 1].constantValue;
        } else {
            const extra = constType === "ap" ? 2.0 : 0.0;

            const ob1Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffOB1 > 0 && g.constantValue + extra >= cutoffs.cutoffOB1,
            );
            if (ob1Groups.length > 0) result.ob1 = ob1Groups[ob1Groups.length - 1].constantValue;

            const ob15Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffOB15 > 0 && g.constantValue + extra >= cutoffs.cutoffOB15,
            );
            if (ob15Groups.length > 0) result.ob15 = ob15Groups[ob15Groups.length - 1].constantValue;

            const ob30Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffOB30 > 0 && g.constantValue + extra >= cutoffs.cutoffOB30,
            );
            if (ob30Groups.length > 0) result.ob30 = ob30Groups[ob30Groups.length - 1].constantValue;

            const nb1Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffNB1 > 0 && g.constantValue + extra >= cutoffs.cutoffNB1,
            );
            if (nb1Groups.length > 0) result.nb1 = nb1Groups[nb1Groups.length - 1].constantValue;

            const nb5Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffNB5 > 0 && g.constantValue + extra >= cutoffs.cutoffNB5,
            );
            if (nb5Groups.length > 0) result.nb5 = nb5Groups[nb5Groups.length - 1].constantValue;

            const nb10Groups = groupedConstants.filter(
                (g) => cutoffs.cutoffNB10 > 0 && g.constantValue + extra >= cutoffs.cutoffNB10,
            );
            if (nb10Groups.length > 0) result.nb10 = nb10Groups[nb10Groups.length - 1].constantValue;
        }

        return result;
    }, [groupedConstants, cutoffs, ratingMode, constType]);

    const visibleConstants = useMemo(() => {
        return groupedConstants.slice(0, constVisibleCount);
    }, [groupedConstants, constVisibleCount]);

    return (
        <section className="glass-panel" style={{ padding: "2rem" }}>
            <div className="section-title-bar">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        alignItems: "center",
                    }}
                >
                    <h2 className="section-title">
                        <Layers size={22} style={{ color: "var(--color-cyan)" }} /> 상수표
                    </h2>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsConstFilterExpanded(!isConstFilterExpanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.85rem",
                            padding: "0.35rem 0.6rem",
                        }}
                    >
                        <Filter size={14} /> {isConstFilterExpanded ? "필터 접기" : "필터 펼치기"}
                    </button>
                </div>
            </div>

            {/* EXPANDED FILTER SECTION */}
            {isConstFilterExpanded && (
                <div className="table-filters-expanded">
                    {/* Row 1: Search, Constants & Levels inputs */}
                    <div className="filters-row constants-filters-grid">
                        <div className="filter-group">
                            <label className="filter-label">곡 검색</label>
                            <div style={{ position: "relative" }}>
                                <Search
                                    size={16}
                                    style={{
                                        position: "absolute",
                                        left: "12px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        color: "var(--text-muted)",
                                    }}
                                />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="제목, 작곡가, 초성 검색..."
                                    style={{ paddingLeft: "2.5rem", width: "100%" }}
                                    value={constSearchInput}
                                    onChange={(e) => setConstSearchInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">상수</label>
                            <div className="range-inputs">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최소"
                                    style={{ width: "100%" }}
                                    value={constMinLevelInput}
                                    onChange={(e) => setConstMinLevelInput(e.target.value)}
                                />
                                <span>~</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최대"
                                    style={{ width: "100%" }}
                                    value={constMaxLevelInput}
                                    onChange={(e) => setConstMaxLevelInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">레벨</label>
                            <div className="range-inputs">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최소"
                                    style={{ width: "100%" }}
                                    value={constMinLevel}
                                    onChange={(e) => setConstMinLevel(e.target.value)}
                                />
                                <span>~</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최대"
                                    style={{ width: "100%" }}
                                    value={constMaxLevel}
                                    onChange={(e) => setConstMaxLevel(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Difficulties Checkboxes */}
                    <div className="filter-group">
                        <label className="filter-label">난이도</label>
                        <div className="filter-checkbox-group difficulty-checkbox-group">
                            {["easy", "normal", "hard", "expert", "master", "append"].map((diff) => {
                                const diffNames = {
                                    easy: "EASY",
                                    normal: "NORMAL",
                                    hard: "HARD",
                                    expert: "EXPERT",
                                    master: "MASTER",
                                    append: "APPEND",
                                };
                                const isActive = constDiffFilters.includes(diff);
                                return (
                                    <label key={diff} className={`checkbox-label ${isActive ? `active-${diff}` : ""}`}>
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => handleDiffFilterToggle(diff)}
                                        />
                                        {diffNames[diff]}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Row 3: Play Statuses Checkboxes */}
                    <div className="filter-group">
                        <label className="filter-label">성과</label>
                        <div className="filter-checkbox-group">
                            {[
                                { id: "unplayed", label: "NC" },
                                { id: "played", label: "C" },
                                { id: "fc", label: "FC" },
                                { id: "ap", label: "AP" },
                            ].map((playStatus) => {
                                const isActive = constPlayFilters.includes(playStatus.id);
                                return (
                                    <label
                                        key={playStatus.id}
                                        className={`checkbox-label ${isActive ? `active-${playStatus.id}` : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => handlePlayFilterToggle(playStatus.id)}
                                        />
                                        {playStatus.label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Row 4: Constant Type Toggle */}
                    <div className="filter-group" style={{ marginTop: "0.5rem" }}>
                        <label className="filter-label">상수 타입</label>
                        <div style={{ display: "flex", gap: "0.5rem", maxWidth: "280px" }}>
                            <button
                                className={`btn btn-outline ${constType === "fc" ? "active" : ""}`}
                                style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}
                                onClick={() => setConstType("fc")}
                            >
                                FC 상수
                            </button>
                            <button
                                className={`btn btn-outline ${constType === "ap" ? "active" : ""}`}
                                style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}
                                onClick={() => setConstType("ap")}
                            >
                                AP 상수
                            </button>
                        </div>
                    </div>

                    {/* Row 5: 신곡 필터 */}
                    <div className="filter-group" style={{ marginTop: "0.5rem" }}>
                        <label className="filter-label">신곡 여부</label>
                        <div style={{ display: "flex", gap: "0.5rem", maxWidth: "280px" }}>
                            {[
                                { id: "all", label: "전체" },
                                { id: "new", label: "신곡" },
                                { id: "old", label: "구곡" },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`btn btn-outline ${constNewFilter === opt.id ? "active" : ""}`}
                                    style={{
                                        flex: 1,
                                        padding: "0.4rem",
                                        fontSize: "0.8rem",
                                        borderColor: constNewFilter === opt.id && opt.id === "new" ? "#ffd200" : "",
                                        color: constNewFilter === opt.id && opt.id === "new" ? "#ffd200" : "",
                                    }}
                                    onClick={() => setConstNewFilter(opt.id)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CONSTANT SECTION GROUP GRID */}
            <div className="constant-group-container">
                {groupedConstants.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
                        검색 및 필터 조건에 합치하는 곡 상수 조합이 없습니다.
                    </div>
                ) : (
                    visibleConstants.map((group) => {
                        const constant = group.constantValue;
                        const hasNewSong = group.charts.some((c) => isNewSong(c.song));
                        const hasOldSong = group.charts.some((c) => !isNewSong(c.song));

                        const badges = [];

                        if (ratingMode === "b39") {
                            if (constant === boundaries.b1) {
                                badges.push({ type: "b1", label: "B1" });
                            }
                            if (constant === boundaries.b20) {
                                badges.push({ type: "b20", label: "B20" });
                            }
                            if (constant === boundaries.b39) {
                                badges.push({ type: "b39", label: "B39" });
                            }
                        } else {
                            if (hasOldSong) {
                                if (constant === boundaries.ob1) {
                                    badges.push({ type: "ob1", label: "OB #1" });
                                }
                                if (constant === boundaries.ob15) {
                                    badges.push({ type: "ob15", label: "OB #15" });
                                }
                                if (constant === boundaries.ob30) {
                                    badges.push({ type: "ob30", label: "OB #30" });
                                }
                            }

                            if (hasNewSong) {
                                if (constant === boundaries.nb1) {
                                    badges.push({ type: "nb1", label: "NB #1" });
                                }
                                if (constant === boundaries.nb5) {
                                    badges.push({ type: "nb5", label: "NB #5" });
                                }
                                if (constant === boundaries.nb10) {
                                    badges.push({ type: "nb10", label: "NB #10" });
                                }
                            }
                        }

                        return (
                            <div key={group.constantValue} className="constant-group-section">
                                {/* Constant group title */}
                                <div className="constant-group-header" style={{ paddingRight: "1rem" }}>
                                    <span>{group.constantValue.toFixed(1)}</span>
                                    {badges.length > 0 && (
                                        <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto" }}>
                                            {badges.map((b) => (
                                                <span key={b.type} className={`cutoff-badge badge-${b.type}`}>
                                                    {b.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Visual jacket grid for charts */}
                                <div className="constant-charts-grid">
                                    {group.charts.map((chart) => (
                                        <div
                                            key={`${chart.song.id}-${chart.diff}`}
                                            className="jacket-chart-card"
                                            onClick={() => onJacketClick(chart.song, chart.diff, chart.status)}
                                        >
                                            {/* Jacket wrapper with difficulty border */}
                                            <div
                                                className={`jacket-wrapper border-${chart.diff}`}
                                                style={{ position: "relative" }}
                                            >
                                                <JacketImage songId={chart.song.id} size={85} />
                                                {/* NEW badge */}
                                                {isNewSong(chart.song) && (
                                                    <span
                                                        style={{
                                                            position: "absolute",
                                                            top: "2px",
                                                            left: "2px",
                                                            background: "linear-gradient(135deg, #ff4545ed, #f42516)",
                                                            color: "#000",
                                                            fontWeight: 800,
                                                            fontSize: "0.55rem",
                                                            padding: "0.1rem 0.3rem",
                                                            borderRadius: "3px",
                                                            zIndex: 2,
                                                            letterSpacing: "0.05em",
                                                        }}
                                                    >
                                                        NEW
                                                    </span>
                                                )}
                                                {!chart.hasConstant && (
                                                    <span
                                                        className="no-constant-badge"
                                                        title="상수 데이터 없음 (기본 레벨 표시)"
                                                    >
                                                        ?
                                                    </span>
                                                )}
                                            </div>

                                            {/* Neon Status tag directly under jacket */}
                                            <div className={`jacket-status-overlay ${chart.statusClass}`}>
                                                {chart.statusClass === "unplayed"
                                                    ? "NC"
                                                    : chart.statusClass === "clear"
                                                      ? "C"
                                                      : chart.statusClass.toUpperCase()}
                                            </div>

                                            {/* Hover detail tooltip */}
                                            <div className="jacket-chart-tooltip">
                                                <div
                                                    style={{
                                                        fontWeight: "700",
                                                        wordBreak: "keep-all",
                                                        overflowWrap: "break-word",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        lineHeight: "1.2",
                                                    }}
                                                >
                                                    {getSongTitle(chart.song)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
                {/* Sentinel for IntersectionObserver */}
                {groupedConstants.length > constVisibleCount && (
                    <div
                        ref={constSentinelRef}
                        style={{
                            height: "45px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                            margin: "1.5rem 0",
                        }}
                    >
                        <span>상수표를 불러오는 중...</span>
                    </div>
                )}
            </div>
        </section>
    );
};
