import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Filter, Settings, Edit, Check, X } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { getConstant } from "../../utils/ratingUtils";
import { defaultSort } from "../../utils/scoreUtils";

const PATTERN_KEYS = [
    { key: "burst", label: "폭타" },
    { key: "jacks", label: "연타" },
    { key: "trill", label: "트릴" },
    { key: "onehand_trill", label: "한손트릴" },
    { key: "doublet", label: "따닥" },
    { key: "aim", label: "에임" },
    { key: "flick", label: "플릭" },
    { key: "gimmick", label: "기믹" },
    { key: "reading", label: "인식난" },
    { key: "rhythm", label: "리듬난" },
    { key: "holding", label: "롱잡" },
    { key: "crossing", label: "손교차" },
];

const DIFF_LABELS = {
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    expert: "EXPERT",
    master: "MASTER",
    append: "APPEND", // SC -> APD
};

const DIFF_SHORT_LABELS = {
    easy: "EAS",
    normal: "NOR",
    hard: "HAR",
    expert: "EXP",
    master: "MAS",
    append: "APD",
};

export default function Pattern({ songs, currentUser, settingsTitleLang }) {
    const [patterns, setPatterns] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [diffFilters, setDiffFilters] = useState(["master", "append"]);
    const [minLevel, setMinLevel] = useState("");
    const [maxLevel, setMaxLevel] = useState("");
    const [visibleCount, setVisibleCount] = useState(30);
    const [isFilterExpanded, setIsFilterExpanded] = useState(true); // Default to expanded like other pages

    // Sorting State
    const [sortField, setSortField] = useState(null); // null, "title", "diff", "constant", "level", or pattern key
    const [sortOrder, setSortOrder] = useState(null); // null, "desc", "asc"

    const handleSort = (field) => {
        if (sortField !== field) {
            setSortField(field);
            setSortOrder("desc");
        } else {
            if (sortOrder === "desc") {
                setSortOrder("asc");
            } else if (sortOrder === "asc") {
                setSortField(null);
                setSortOrder(null);
            }
        }
    };

    const renderSortIndicator = (field) => {
        if (sortField !== field) return null;
        return sortOrder === "asc" ? " ▲" : " ▼";
    };

    // Edit Modal State
    const [editingChart, setEditingChart] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // Permission Check
    const userRole = currentUser?.role || (currentUser?.username?.toLowerCase() === "admin" ? "admin" : "user");
    const hasEditPermission = userRole === "admin" || userRole === "editor";

    // Fetch Patterns Data
    const fetchPatterns = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/patterns");
            if (res.ok) {
                const data = await res.json();
                const lookup = {};
                data.forEach((p) => {
                    lookup[`${p.song_id}_${p.difficulty}`] = p;
                });
                setPatterns(lookup);
            }
        } catch (err) {
            console.error("Failed to fetch patterns:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPatterns();
    }, []);

    // Get Song Title based on settings
    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    // Filter and build charts list
    const chartList = useMemo(() => {
        const list = [];
        const minLvl = minLevel === "" ? 0 : parseInt(minLevel);
        const maxLvl = maxLevel === "" ? 100 : parseInt(maxLevel);

        songs.forEach((song) => {
            Object.keys(song.levels).forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;
                if (!diffFilters.includes(diff)) return;

                if (lvl < minLvl || lvl > maxLvl) return;

                const constant = getConstant(song, diff, "fc") || lvl;

                // Search Filter
                if (search.trim() !== "") {
                    const query = search.toLowerCase();
                    const titleKo = (song.title_ko || "").toLowerCase();
                    const titleJp = (song.title_jp || "").toLowerCase();
                    const titleHangul = (song.title_hangul || "").toLowerCase();
                    const composer = (song.composer || "").toLowerCase();
                    if (
                        !titleKo.includes(query) &&
                        !titleJp.includes(query) &&
                        !titleHangul.includes(query) &&
                        !composer.includes(query)
                    ) {
                        return;
                    }
                }

                const patternKey = `${song.id}_${diff}`;
                const pat = patterns[patternKey] || {};

                list.push({
                    song,
                    diff,
                    level: lvl,
                    constant,
                    patternKey,
                    pattern: pat,
                });
            });
        });

        // Sort logic
        if (!sortField || !sortOrder) {
            return list.sort((a, b) => defaultSort(a, b));
        }

        return list.sort((a, b) => {
            let cmp = 0;
            if (sortField === "title") {
                const valA = getSongTitle(a.song);
                const valB = getSongTitle(b.song);
                cmp = valA.localeCompare(valB);
            } else if (sortField === "diff") {
                const diffOrder = { easy: 0, normal: 1, hard: 2, expert: 3, master: 4, append: 5 };
                const valA = diffOrder[a.diff] ?? 0;
                const valB = diffOrder[b.diff] ?? 0;
                cmp = valA - valB;
            } else if (sortField === "constant") {
                cmp = a.constant - b.constant;
            } else if (sortField === "level") {
                cmp = a.level - b.level;
            } else {
                // It's a pattern key (like "burst", "jacks", etc.)
                const valA = a.pattern[sortField] || 0;
                const valB = b.pattern[sortField] || 0;
                cmp = valA - valB;
            }

            if (cmp !== 0) {
                return sortOrder === "asc" ? cmp : -cmp;
            }
            
            // Tie breaker: default sort
            return defaultSort(a, b);
        });
    }, [songs, patterns, search, diffFilters, minLevel, maxLevel, settingsTitleLang, sortField, sortOrder]);

    // Reset visible count when filter or sorting changes
    useEffect(() => {
        setVisibleCount(30);
    }, [search, diffFilters, minLevel, maxLevel, sortField, sortOrder]);

    // Infinite scroll trigger
    const observer = useRef(null);
    const sentinelRef = useCallback((node) => {
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => prev + 30);
                }
            },
            { rootMargin: "200px" },
        );
        if (node) observer.current.observe(node);
    }, []);

    const visibleCharts = useMemo(() => {
        return chartList.slice(0, visibleCount);
    }, [chartList, visibleCount]);

    // Open Edit Modal
    const handleOpenEdit = (chart) => {
        if (!hasEditPermission) return;
        setEditingChart(chart);
        const initialForm = {};
        PATTERN_KEYS.forEach((p) => {
            initialForm[p.key] = chart.pattern[p.key] || 0;
        });
        setEditForm(initialForm);
    };

    // Save Edit Form
    const handleSave = async () => {
        if (!editingChart || !currentUser?.token) return;
        setIsSaving(true);
        try {
            const body = {
                song_id: editingChart.song.id,
                difficulty: editingChart.diff,
                ...editForm,
            };
            const res = await fetch("/api/patterns", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentUser.token}`,
                },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                // Update local state optimistically
                setPatterns((prev) => ({
                    ...prev,
                    [editingChart.patternKey]: {
                        ...prev[editingChart.patternKey],
                        ...editForm,
                        song_id: editingChart.song.id,
                        difficulty: editingChart.diff,
                    },
                }));
                setEditingChart(null);
            } else {
                alert(data.error || "패턴 상수 저장에 실패했습니다.");
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("서버 통신 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    // Value Badge Helper
    const renderBadge = (val) => {
        if (!val || val === 0) return <span className="pattern-badge-dot">.</span>;

        let className = "pattern-badge";
        if (val === 1) className += " badge-cyan";
        else if (val === 2) className += " badge-yellow";
        else if (val === 3) className += " badge-purple";

        return <span className={className}>{val}</span>;
    };

    const toggleDiffFilter = (diff) => {
        if (diffFilters.includes(diff)) {
            if (diffFilters.length > 1) {
                setDiffFilters(diffFilters.filter((d) => d !== diff));
            }
        } else {
            setDiffFilters([...diffFilters, diff]);
        }
    };

    return (
        <section className="pattern-manager-panel" style={{ padding: "0 0 1rem 0" }}>
            <div className="section-title-bar" style={{ marginBottom: "1.5rem" }}>
                <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Settings size={22} style={{ color: "var(--color-pink)" }} /> 패턴상수
                </h2>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.85rem",
                            padding: "0.35rem 0.6rem",
                        }}
                    >
                        <Filter size={14} /> {isFilterExpanded ? "필터 접기" : "필터 펼치기"}
                    </button>
                </div>
            </div>

            {/* SEARCH & FILTERS - Unified with other pages */}
            {isFilterExpanded && (
                <div className="table-filters-expanded" style={{ marginBottom: "1.5rem" }}>
                    <div className="filters-row pattern-filters-grid">
                        {/* 곡 검색 */}
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
                                    placeholder="곡명 또는 작곡가 검색..."
                                    className="form-control"
                                    style={{ paddingLeft: "2.5rem", width: "100%" }}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 레벨 범위 */}
                        <div className="filter-group">
                            <label className="filter-label">레벨 범위</label>
                            <div
                                className="range-inputs"
                                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
                            >
                                <input
                                    type="number"
                                    placeholder="최소"
                                    className="form-control"
                                    style={{ width: "100%" }}
                                    value={minLevel}
                                    onChange={(e) => setMinLevel(e.target.value)}
                                />
                                <span style={{ color: "var(--text-muted)" }}>~</span>
                                <input
                                    type="number"
                                    placeholder="최대"
                                    className="form-control"
                                    style={{ width: "100%" }}
                                    value={maxLevel}
                                    onChange={(e) => setMaxLevel(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 난이도 필터 */}
                    <div className="filter-group">
                        <label className="filter-label">난이도</label>
                        <div className="filter-checkbox-group difficulty-checkbox-group">
                            {Object.keys(DIFF_LABELS).map((diff) => {
                                const active = diffFilters.includes(diff);
                                return (
                                    <label
                                        key={diff}
                                        className={`checkbox-label ${active ? `active-${diff}` : ""}`}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={() => toggleDiffFilter(diff)}
                                        />
                                        {DIFF_LABELS[diff]}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* PATTERNS TABLE */}
            <div className="pattern-table-container">
                <table
                    className="pattern-table"
                    style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", tableLayout: "fixed" }}
                >
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <th 
                                style={{ textAlign: "left", padding: "1rem", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", width: "260px", minWidth: "260px" }}
                                onClick={() => handleSort("title")}
                            >
                                곡명{renderSortIndicator("title")}
                            </th>
                            <th 
                                style={{ width: "70px", minWidth: "70px", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                                onClick={() => handleSort("diff")}
                            >
                                난이도{renderSortIndicator("diff")}
                            </th>
                            <th 
                                style={{ width: "70px", minWidth: "70px", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                                onClick={() => handleSort("constant")}
                            >
                                상수{renderSortIndicator("constant")}
                            </th>
                            <th 
                                style={{ width: "70px", minWidth: "70px", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                                onClick={() => handleSort("level")}
                            >
                                레벨{renderSortIndicator("level")}
                            </th>
                            {PATTERN_KEYS.map((p) => (
                                <th
                                    key={p.key}
                                    style={{
                                        width: "75px",
                                        minWidth: "75px",
                                        fontSize: "0.85rem",
                                        fontWeight: "600",
                                        color: "var(--text-secondary)",
                                        whiteSpace: "nowrap",
                                        cursor: "pointer",
                                        userSelect: "none",
                                    }}
                                    onClick={() => handleSort(p.key)}
                                >
                                    {p.label}{renderSortIndicator(p.key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={16} style={{ padding: "4rem 0", color: "var(--text-muted)" }}>
                                    패턴 데이터를 불러오는 중...
                                </td>
                            </tr>
                        ) : visibleCharts.length === 0 ? (
                            <tr>
                                <td colSpan={16} style={{ padding: "4rem 0", color: "var(--text-muted)" }}>
                                    조건에 부합하는 패턴 정보가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            visibleCharts.map((chart) => {
                                const songTitle = getSongTitle(chart.song);
                                return (
                                    <tr
                                        key={chart.patternKey}
                                        className={`pattern-tr-row ${hasEditPermission ? "editable-row" : ""}`}
                                        style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}
                                        onClick={() => hasEditPermission && handleOpenEdit(chart)}
                                    >
                                        <td
                                            style={{
                                                textAlign: "left",
                                                padding: "0.75rem 1rem",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.75rem",
                                            }}
                                        >
                                            <div
                                                className={`jacket-wrapper border-${chart.diff}`}
                                                style={{
                                                    width: "42px",
                                                    height: "42px",
                                                    flexShrink: 0,
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <JacketImage songId={chart.song.id} size={42} />
                                            </div>
                                            <div
                                                style={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <div
                                                    style={{ fontWeight: "600", fontSize: "0.95rem" }}
                                                    title={songTitle}
                                                >
                                                    {songTitle}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                    {chart.song.composer}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`diff-badge diff-${chart.diff}`}
                                                style={{
                                                    display: "inline-block",
                                                    width: "45px",
                                                    fontSize: "0.75rem",
                                                    padding: "0.15rem 0",
                                                    borderRadius: "4px",
                                                    fontWeight: "700",
                                                }}
                                            >
                                                {DIFF_SHORT_LABELS[chart.diff] || chart.diff.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: "700", color: "var(--color-pink)" }}>
                                            {chart.constant.toFixed(1)}
                                        </td>
                                        <td style={{ fontWeight: "600" }}>{chart.level}</td>
                                        {PATTERN_KEYS.map((p) => (
                                            <td key={p.key}>{renderBadge(chart.pattern[p.key])}</td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Infinite Scroll Sentinel */}
            {chartList.length > visibleCount && (
                <div
                    ref={sentinelRef}
                    style={{
                        height: "50px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                        marginTop: "1rem",
                    }}
                >
                    더 많은 패턴을 불러오는 중...
                </div>
            )}

            {/* EDIT PATTERN MODAL */}
            {editingChart &&
                createPortal(
                    <div className="modal-backdrop" onClick={() => setEditingChart(null)}>
                        <div
                            className="glass-panel modal-content pattern-edit-modal"
                            style={{
                                width: "90%",
                                maxWidth: "760px",
                                padding: "2.5rem",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                style={{
                                    position: "absolute",
                                    right: "1.5rem",
                                    top: "1.5rem",
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                }}
                                onClick={() => setEditingChart(null)}
                            >
                                <X size={20} />
                            </button>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "1rem",
                                    alignItems: "center",
                                    marginBottom: "1.5rem",
                                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                                    paddingBottom: "1rem",
                                }}
                            >
                                <div
                                    className={`jacket-wrapper border-${editingChart.diff}`}
                                    style={{ width: "55px", height: "55px", flexShrink: 0, overflow: "hidden" }}
                                >
                                    <JacketImage songId={editingChart.song.id} size={55} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>
                                        {getSongTitle(editingChart.song)}
                                    </h3>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "0.5rem",
                                            marginTop: "0.25rem",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span
                                            className={`diff-badge diff-${editingChart.diff}`}
                                            style={{
                                                fontSize: "0.75rem",
                                                padding: "0.1rem 0.4rem",
                                                borderRadius: "3px",
                                            }}
                                        >
                                            {DIFF_LABELS[editingChart.diff]}
                                        </span>
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                            상수:{" "}
                                            <strong style={{ color: "var(--color-pink)" }}>
                                                {editingChart.constant.toFixed(1)}
                                            </strong>{" "}
                                            (Lv.{editingChart.level})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Attribute inputs */}
                            <div className="pattern-modal-grid">
                                {PATTERN_KEYS.map((p) => (
                                    <div
                                        key={p.key}
                                        style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}
                                    >
                                        <label
                                            style={{
                                                fontSize: "0.9rem",
                                                color: "var(--text-secondary)",
                                                fontWeight: "600",
                                            }}
                                        >
                                            {p.label}
                                        </label>
                                        <div
                                            style={{
                                                display: "flex",
                                                background: "rgba(255,255,255,0.04)",
                                                borderRadius: "6px",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {[0, 1, 2, 3].map((val) => {
                                                const active = editForm[p.key] === val;
                                                let activeColor = "rgba(255,255,255,0.15)";
                                                let textColor = "#fff";
                                                if (active) {
                                                    if (val === 1) {
                                                        activeColor = "rgba(45, 212, 191, 0.25)";
                                                        textColor = "#2dd4bf";
                                                    } else if (val === 2) {
                                                        activeColor = "rgba(234, 179, 8, 0.25)";
                                                        textColor = "#eab308";
                                                    } else if (val === 3) {
                                                        activeColor = "rgba(168, 85, 247, 0.25)";
                                                        textColor = "#a855f7";
                                                    }
                                                }
                                                return (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() =>
                                                            setEditForm((prev) => ({ ...prev, [p.key]: val }))
                                                        }
                                                        style={{
                                                            flex: 1,
                                                            padding: "0.5rem 0",
                                                            border: "none",
                                                            background: active ? activeColor : "transparent",
                                                            color: active ? textColor : "var(--text-muted)",
                                                            fontWeight: active ? "700" : "500",
                                                            fontSize: "0.95rem",
                                                            cursor: "pointer",
                                                            transition: "all 0.15s",
                                                        }}
                                                    >
                                                        {val === 0 ? "." : val}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                                <button
                                    className="btn btn-outline"
                                    style={{ padding: "0.5rem 1.5rem" }}
                                    onClick={() => setEditingChart(null)}
                                    disabled={isSaving}
                                >
                                    취소
                                </button>
                                <button
                                    className="btn"
                                    style={{
                                        padding: "0.5rem 1.5rem",
                                        background: "var(--color-pink)",
                                        color: "#fff",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                    }}
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        "저장 중..."
                                    ) : (
                                        <>
                                            <Check size={16} /> 저장
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </section>
    );
}
