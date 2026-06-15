import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ClipboardList, Filter, Search } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { calculateRating, getConstant, hasExplicitConstant } from "../../utils/ratingUtils";
import { isNewSong, calculateSongPotential } from "../../utils/potentialUtils";
import { useSessionState } from "../../utils/useSessionState";

export const Records = ({ songs, scores, updateScores, settingsTitleLang, ratingMode = "b39" }) => {
    // --- States ---
    const [isRecordFilterExpanded, setIsRecordFilterExpanded] = useSessionState("pjsk_record_filter_expanded", true);
    const [recordSearchInput, setRecordSearchInput] = useSessionState("pjsk_record_search_input", "");
    const [recordSearch, setRecordSearch] = useSessionState("pjsk_record_search", "");
    const [recordVisibleCount, setRecordVisibleCount] = useState(50);
    const [recordDiffFilters, setRecordDiffFilters] = useSessionState("pjsk_record_diff_filters", [
        "easy",
        "normal",
        "hard",
        "expert",
        "master",
        "append",
    ]);
    const [recordPlayFilters, setRecordPlayFilters] = useSessionState("pjsk_record_play_filters", ["unplayed", "played", "fc", "ap"]);
    const [recordMinFcConstInput, setRecordMinFcConstInput] = useSessionState("pjsk_record_min_fc_const_input", "");
    const [recordMaxFcConstInput, setRecordMaxFcConstInput] = useSessionState("pjsk_record_max_fc_const_input", "");
    const [recordMinApConstInput, setRecordMinApConstInput] = useSessionState("pjsk_record_min_ap_const_input", "");
    const [recordMaxApConstInput, setRecordMaxApConstInput] = useSessionState("pjsk_record_max_ap_const_input", "");
    const [recordMinLevel, setRecordMinLevel] = useSessionState("pjsk_record_min_level", "");
    const [recordMaxLevel, setRecordMaxLevel] = useSessionState("pjsk_record_max_level", "");
    const [recordSortBy, setRecordSortBy] = useSessionState("pjsk_record_sort_by", "level"); // title, status, level, constant
    const [recordSortOrder, setRecordSortOrder] = useSessionState("pjsk_record_sort_order", "desc"); // asc, desc
    const [recordNewFilter, setRecordNewFilter] = useSessionState("pjsk_record_new_filter", "all"); // "all", "new", "old"

    // --- Debounce Search Term ---
    useEffect(() => {
        const handler = setTimeout(() => {
            setRecordSearch(recordSearchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [recordSearchInput]);

    // --- Reset visible count on filter changes ---
    useEffect(() => {
        setRecordVisibleCount(50);
    }, [
        recordSearch,
        recordDiffFilters,
        recordPlayFilters,
        recordMinFcConstInput,
        recordMaxFcConstInput,
        recordMinApConstInput,
        recordMaxApConstInput,
        recordMinLevel,
        recordMaxLevel,
        recordSortBy,
        recordSortOrder,
    ]);

    // --- Infinite scroll observer ---
    const recordObserver = useRef(null);
    const recordSentinelRef = useCallback((node) => {
        if (recordObserver.current) recordObserver.current.disconnect();
        recordObserver.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setRecordVisibleCount((prev) => prev + 50);
                }
            },
            { rootMargin: "200px" },
        );
        if (node) recordObserver.current.observe(node);
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

    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    const handleRecordDiffFilterToggle = (diff) => {
        if (recordDiffFilters.includes(diff)) {
            if (recordDiffFilters.length > 1) {
                setRecordDiffFilters(recordDiffFilters.filter((d) => d !== diff));
            }
        } else {
            setRecordDiffFilters([...recordDiffFilters, diff]);
        }
    };

    const handleRecordPlayFilterToggle = (playStatus) => {
        if (recordPlayFilters.includes(playStatus)) {
            if (recordPlayFilters.length > 1) {
                setRecordPlayFilters(recordPlayFilters.filter((p) => p !== playStatus));
            }
        } else {
            setRecordPlayFilters([...recordPlayFilters, playStatus]);
        }
    };

    const handleScoreChange = (songId, diff, newStatus) => {
        const existIdx = scores.findIndex((s) => String(s.id) === String(songId));
        let newScores = [...scores];

        const sanitizeStatus = (status) => {
            return status === "none" ? null : status;
        };

        if (existIdx !== -1) {
            newScores[existIdx] = {
                ...newScores[existIdx],
                [diff]: sanitizeStatus(newStatus),
            };
        } else {
            newScores.push({
                id: String(songId),
                easy: diff === "easy" ? sanitizeStatus(newStatus) : null,
                normal: diff === "normal" ? sanitizeStatus(newStatus) : null,
                hard: diff === "hard" ? sanitizeStatus(newStatus) : null,
                expert: diff === "expert" ? sanitizeStatus(newStatus) : null,
                master: diff === "master" ? sanitizeStatus(newStatus) : null,
                append: diff === "append" ? sanitizeStatus(newStatus) : null,
            });
        }
        updateScores(newScores);
    };

    // --- Bulk Score Update Handlers ---
    const handleBulkScoreChange = (newStatus) => {
        if (filteredAndSortedRecords.length === 0) return;

        const sanitizeStatus = (status) => {
            return status === "none" ? null : status;
        };

        let newScores = [...scores];

        filteredAndSortedRecords.forEach((item) => {
            const songId = String(item.song.id);
            const diff = item.diff;

            const existIdx = newScores.findIndex((s) => String(s.id) === songId);
            if (existIdx !== -1) {
                newScores[existIdx] = {
                    ...newScores[existIdx],
                    [diff]: sanitizeStatus(newStatus),
                };
            } else {
                newScores.push({
                    id: songId,
                    easy: diff === "easy" ? sanitizeStatus(newStatus) : null,
                    normal: diff === "normal" ? sanitizeStatus(newStatus) : null,
                    hard: diff === "hard" ? sanitizeStatus(newStatus) : null,
                    expert: diff === "expert" ? sanitizeStatus(newStatus) : null,
                    master: diff === "master" ? sanitizeStatus(newStatus) : null,
                    append: diff === "append" ? sanitizeStatus(newStatus) : null,
                });
            }
        });

        updateScores(newScores);
    };

    const handleBulkScoreConfirm = (status) => {
        const statusLabels = {
            none: "NC (No Clear)",
            clear: "C (Clear)",
            full_combo: "FC (Full Combo)",
            full_perfect: "AP (All Perfect)",
        };
        const msg = `현재 필터링된 곡 ${filteredAndSortedRecords.length}개의 성과를 일괄적으로 [${statusLabels[status]}] 상태로 변경하시겠습니까?`;
        if (window.confirm(msg)) {
            handleBulkScoreChange(status);
        }
    };

    // --- Record Tab Computations ---
    const filteredAndSortedRecords = useMemo(() => {
        const minFcConst = recordMinFcConstInput === "" ? 0.0 : parseFloat(recordMinFcConstInput);
        const maxFcConst = recordMaxFcConstInput === "" ? 100.0 : parseFloat(recordMaxFcConstInput);
        const minApConst = recordMinApConstInput === "" ? 0.0 : parseFloat(recordMinApConstInput);
        const maxApConst = recordMaxApConstInput === "" ? 100.0 : parseFloat(recordMaxApConstInput);
        const minLvlVal = recordMinLevel === "" ? 0 : parseInt(recordMinLevel);
        const maxLvlVal = recordMaxLevel === "" ? 100 : parseInt(recordMaxLevel);

        const list = [];

        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id));

            recordDiffFilters.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;

                const fcConstant = getConstant(song, diff, "full_combo");
                const apConstant = getConstant(song, diff, "full_perfect");

                if (fcConstant < minFcConst || fcConstant > maxFcConst) return;
                if (apConstant < minApConst || apConstant > maxApConst) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const status = userPlay ? userPlay[diff] : null;
                let mappedStatus = "unplayed";
                if (status === "full_perfect") mappedStatus = "ap";
                else if (status === "full_combo") mappedStatus = "fc";
                else if (status === "clear") mappedStatus = "played";

                if (!recordPlayFilters.includes(mappedStatus)) return;

                if (recordSearch.trim() !== "") {
                    const query = recordSearch.toLowerCase();
                    const matchesText =
                        (song.title_ko || "").toLowerCase().includes(query) ||
                        (song.title_jp || "").toLowerCase().includes(query) ||
                        (song.title_hangul || "").toLowerCase().includes(query) ||
                        (song.composer || "").toLowerCase().includes(query);

                    if (!matchesText) return;
                }

                // 신곡 필터
                const songNew = isNewSong(song);
                if (recordNewFilter === "new" && !songNew) return;
                if (recordNewFilter === "old" && songNew) return;

                const rating =
                    ratingMode === "potential"
                        ? calculateSongPotential(song, diff, status || "none")
                        : calculateRating(song, diff, status || "none");
                list.push({
                    song,
                    diff,
                    level: lvl,
                    fcConstant,
                    hasFcConstant: hasExplicitConstant(song, diff, "full_combo"),
                    apConstant,
                    hasApConstant: hasExplicitConstant(song, diff, "full_perfect"),
                    status: status || "none",
                    rating,
                });
            });
        });

        const getStatusScore = (status) => {
            if (status === "full_perfect") return 4;
            if (status === "full_combo") return 3;
            if (status === "clear") return 2;
            return 1;
        };

        const compareTitles = (a, b) => {
            const titleA = getSongTitle(a.song);
            const titleB = getSongTitle(b.song);
            return titleA.localeCompare(titleB);
        };

        list.sort((a, b) => {
            let cmp = 0;

            if (recordSortBy === "title") {
                cmp = compareTitles(a, b);
            } else if (recordSortBy === "status") {
                const scoreA = getStatusScore(a.status);
                const scoreB = getStatusScore(b.status);
                if (scoreA !== scoreB) {
                    cmp = scoreA - scoreB;
                } else {
                    if (a.fcConstant !== b.fcConstant) {
                        cmp = a.fcConstant - b.fcConstant;
                    } else {
                        cmp = compareTitles(a, b);
                    }
                }
            } else if (recordSortBy === "level") {
                if (a.level !== b.level) {
                    cmp = a.level - b.level;
                } else {
                    if (a.fcConstant !== b.fcConstant) {
                        cmp = a.fcConstant - b.fcConstant;
                    } else {
                        cmp = compareTitles(a, b);
                    }
                }
            } else if (recordSortBy === "fc_constant") {
                if (a.fcConstant !== b.fcConstant) {
                    cmp = a.fcConstant - b.fcConstant;
                } else {
                    cmp = compareTitles(a, b);
                }
            } else if (recordSortBy === "ap_constant") {
                if (a.apConstant !== b.apConstant) {
                    cmp = a.apConstant - b.apConstant;
                } else {
                    cmp = compareTitles(a, b);
                }
            } else if (recordSortBy === "rating") {
                if (a.rating !== b.rating) {
                    cmp = a.rating - b.rating;
                } else {
                    if (a.fcConstant !== b.fcConstant) {
                        cmp = a.fcConstant - b.fcConstant;
                    } else {
                        cmp = compareTitles(a, b);
                    }
                }
            }

            return recordSortOrder === "asc" ? cmp : -cmp;
        });

        return list;
    }, [
        songs,
        userScoresMap,
        recordSearch,
        recordDiffFilters,
        recordPlayFilters,
        recordMinFcConstInput,
        recordMaxFcConstInput,
        recordMinApConstInput,
        recordMaxApConstInput,
        recordMinLevel,
        recordMaxLevel,
        recordSortBy,
        recordSortOrder,
        recordNewFilter,
        settingsTitleLang,
    ]);

    const visibleRecords = useMemo(() => {
        return filteredAndSortedRecords.slice(0, recordVisibleCount);
    }, [filteredAndSortedRecords, recordVisibleCount]);

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
                        <ClipboardList size={22} style={{ color: "var(--color-cyan)" }} /> 기록
                    </h2>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsRecordFilterExpanded(!isRecordFilterExpanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.85rem",
                            padding: "0.35rem 0.6rem",
                        }}
                    >
                        <Filter size={14} /> {isRecordFilterExpanded ? "필터 접기" : "필터 펼치기"}
                    </button>
                </div>
            </div>

            {/* EXPANDED FILTER & SORT SECTION */}
            {isRecordFilterExpanded && (
                <div className="table-filters-expanded">
                    {/* Row 1: Search, Constants, Levels & Sorting */}
                    <div className="filters-row records-filters-grid">
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
                                    value={recordSearchInput}
                                    onChange={(e) => setRecordSearchInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">FC 상수</label>
                            <div className="range-inputs">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최소"
                                    style={{ width: "100%" }}
                                    value={recordMinFcConstInput}
                                    onChange={(e) => setRecordMinFcConstInput(e.target.value)}
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
                                    value={recordMaxFcConstInput}
                                    onChange={(e) => setRecordMaxFcConstInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">AP 상수</label>
                            <div className="range-inputs">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최소"
                                    style={{ width: "100%" }}
                                    value={recordMinApConstInput}
                                    onChange={(e) => setRecordMinApConstInput(e.target.value)}
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
                                    value={recordMaxApConstInput}
                                    onChange={(e) => setRecordMaxApConstInput(e.target.value)}
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
                                    value={recordMinLevel}
                                    onChange={(e) => setRecordMinLevel(e.target.value)}
                                />
                                <span>~</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최대"
                                    style={{ width: "100%" }}
                                    value={recordMaxLevel}
                                    onChange={(e) => setRecordMaxLevel(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">정렬 기준</label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <select
                                    className="form-control"
                                    value={recordSortBy}
                                    onChange={(e) => setRecordSortBy(e.target.value)}
                                    style={{ flex: 2 }}
                                >
                                    <option value="title">곡명</option>
                                    <option value="status">성과</option>
                                    <option value="level">레벨</option>
                                    <option value="fc_constant">FC 상수</option>
                                    <option value="ap_constant">AP 상수</option>
                                    <option value="rating">
                                        {ratingMode === "potential" ? "Potential" : "Music R"}
                                    </option>
                                </select>
                                <select
                                    className="form-control"
                                    value={recordSortOrder}
                                    onChange={(e) => setRecordSortOrder(e.target.value)}
                                    style={{ flex: 1.2 }}
                                >
                                    <option value="desc">내림차순</option>
                                    <option value="asc">오름차순</option>
                                </select>
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
                                const isActive = recordDiffFilters.includes(diff);
                                return (
                                    <label key={diff} className={`checkbox-label ${isActive ? `active-${diff}` : ""}`}>
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => handleRecordDiffFilterToggle(diff)}
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
                                const isActive = recordPlayFilters.includes(playStatus.id);
                                return (
                                    <label
                                        key={playStatus.id}
                                        className={`checkbox-label ${isActive ? `active-${playStatus.id}` : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => handleRecordPlayFilterToggle(playStatus.id)}
                                        />
                                        {playStatus.label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Row 4: 신곡 필터 */}
                    <div className="filter-group" style={{ marginTop: "0.5rem" }}>
                        <label className="filter-label">신곡 여부</label>
                        <div style={{ display: "flex", gap: "0.5rem", maxWidth: "320px" }}>
                            {[
                                { id: "all", label: "전체" },
                                { id: "new", label: "신곡" },
                                { id: "old", label: "구곡" },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`btn btn-outline ${recordNewFilter === opt.id ? "active" : ""}`}
                                    style={{
                                        flex: 1,
                                        padding: "0.4rem",
                                        fontSize: "0.8rem",
                                        borderColor: recordNewFilter === opt.id && opt.id === "new" ? "#ffd200" : "",
                                        color: recordNewFilter === opt.id && opt.id === "new" ? "#ffd200" : "",
                                    }}
                                    onClick={() => setRecordNewFilter(opt.id)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* BULK ACTION BAR */}
            <div className="bulk-action-bar">
                <div>
                    <span className="bulk-title">필터링된 곡:</span>
                    <span className="bulk-count">{filteredAndSortedRecords.length}개</span>
                </div>
                {filteredAndSortedRecords.length > 0 && (
                    <div className="bulk-control-group">
                        <span className="bulk-label">일괄 성과 입력:</span>
                        <div className="bulk-buttons">
                            <button className="bulk-btn btn-nc" onClick={() => handleBulkScoreConfirm("none")}>
                                NC
                            </button>
                            <button className="bulk-btn btn-clear" onClick={() => handleBulkScoreConfirm("clear")}>
                                C
                            </button>
                            <button className="bulk-btn btn-fc" onClick={() => handleBulkScoreConfirm("full_combo")}>
                                FC
                            </button>
                            <button className="bulk-btn btn-ap" onClick={() => handleBulkScoreConfirm("full_perfect")}>
                                AP
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* RECORD DATA LIST CONTAINER */}
            <div className="record-list-container" style={{ marginTop: "1.5rem" }}>
                <div
                    style={{
                        maxHeight: "calc(100vh - 350px)",
                        minHeight: "450px",
                        overflowY: "auto",
                        paddingRight: "0.5rem",
                    }}
                >
                    <div className="record-grid-header">
                        <span>순위</span>
                        <span>자켓</span>
                        <span style={{ textAlign: "left" }}>곡 정보</span>
                        <span>난이도</span>
                        <span>레벨</span>
                        <span>FC 상수</span>
                        <span>AP 상수</span>
                        <span>{ratingMode === "potential" ? "Potential" : "Music R"}</span>
                        <span>성과 설정</span>
                    </div>

                    {filteredAndSortedRecords.length === 0 ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "5rem 0",
                                color: "var(--text-muted)",
                                fontSize: "0.95rem",
                            }}
                        >
                            조건에 매칭되는 플레이 기록이 없습니다.
                        </div>
                    ) : (
                        visibleRecords.map((item, index) => {
                            const diffNames = {
                                easy: "EASY",
                                normal: "NORMAL",
                                hard: "HARD",
                                expert: "EXPERT",
                                master: "MASTER",
                                append: "APPEND",
                            };

                            return (
                                <div key={`${item.song.id}-${item.diff}`} className="record-row-item record-grid-row">
                                    {/* Rank */}
                                    <div className="record-rank-col">#{index + 1}</div>

                                    {/* Jacket */}
                                    <div className="record-jacket-col" style={{ position: "relative" }}>
                                        <JacketImage songId={item.song.id} size={50} />
                                        {isNewSong(item.song) && (
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    top: "0px",
                                                    left: "0px",
                                                    background: "linear-gradient(135deg, #ff4545ed, #f42516)",
                                                    color: "#ffffff",
                                                    fontWeight: 800,
                                                    fontSize: "0.5rem",
                                                    padding: "0.1rem 0.25rem",
                                                    borderRadius: "3px",
                                                    zIndex: 2,
                                                    letterSpacing: "0.05em",
                                                }}
                                            >
                                                NEW
                                            </span>
                                        )}
                                    </div>

                                    {/* Title / Composer */}
                                    <div className="record-info-col">
                                        <div className="record-title" title={getSongTitle(item.song)}>
                                            {getSongTitle(item.song)}
                                        </div>
                                        <div className="record-composer">{item.song.composer || "-"}</div>
                                        {/* Mobile sub-info row */}
                                        <div className="record-mobile-meta">
                                            <span className={`diff-badge diff-${item.diff} mini`}>
                                                {item.diff === "append" ? "APD" : diffNames[item.diff].substring(0, 3)}{" "}
                                                {item.level}
                                            </span>
                                            <span
                                                className="meta-rating"
                                                style={{
                                                    color:
                                                        item.rating > 0
                                                            ? ratingMode === "potential"
                                                                ? "#c77dff"
                                                                : "var(--color-pink)"
                                                            : "var(--text-muted)",
                                                }}
                                            >
                                                {ratingMode === "potential" ? "Pot" : "R"}:{" "}
                                                {item.rating > 0
                                                    ? ratingMode === "potential"
                                                        ? item.rating.toFixed(1)
                                                        : Math.round(item.rating)
                                                    : "-"}
                                            </span>
                                            <span className="meta-constant">
                                                C(FC): {item.fcConstant.toFixed(1)}
                                                {!item.hasFcConstant && "?"}
                                            </span>
                                            <span className="meta-constant">
                                                C(AP): {item.apConstant.toFixed(1)}
                                                {!item.hasApConstant && "?"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Difficulty Badge */}
                                    <div className="record-diff-col">
                                        <span className={`diff-badge diff-${item.diff}`}>{diffNames[item.diff]}</span>
                                    </div>

                                    {/* Level */}
                                    <div className="record-level-col">{item.level}</div>

                                    {/* FC Constant */}
                                    <div className="record-fc-col">
                                        {item.fcConstant.toFixed(1)}
                                        {!item.hasFcConstant && "?"}
                                    </div>

                                    {/* AP Constant */}
                                    <div className="record-ap-col">
                                        {item.apConstant.toFixed(1)}
                                        {!item.hasApConstant && "?"}
                                    </div>

                                    {/* Music R */}
                                    <div
                                        className="record-rating-col"
                                        style={{
                                            color:
                                                item.rating > 0
                                                    ? ratingMode === "potential"
                                                        ? "#c77dff"
                                                        : "var(--color-pink)"
                                                    : "var(--text-muted)",
                                        }}
                                    >
                                        {item.rating > 0
                                            ? ratingMode === "potential"
                                                ? item.rating.toFixed(1)
                                                : Math.round(item.rating)
                                            : "-"}
                                    </div>

                                    {/* Action / Selector */}
                                    <div className="record-action-col">
                                        <select
                                            className={`record-status-select status-${item.status}`}
                                            value={item.status}
                                            onChange={(e) => handleScoreChange(item.song.id, item.diff, e.target.value)}
                                        >
                                            <option value="none">NC</option>
                                            <option value="clear">C</option>
                                            <option value="full_combo">FC</option>
                                            <option value="full_perfect">AP</option>
                                        </select>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {/* Sentinel for IntersectionObserver */}
                    {filteredAndSortedRecords.length > recordVisibleCount && (
                        <div
                            ref={recordSentinelRef}
                            style={{
                                height: "45px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                color: "var(--text-muted)",
                                fontSize: "0.85rem",
                                margin: "1rem 0",
                            }}
                        >
                            <span>기록을 불러오는 중...</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
