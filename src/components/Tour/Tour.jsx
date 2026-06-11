import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Target, XCircle, CheckCircle2 } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { isNewSong } from "../../utils/potentialUtils";

export const Tour = ({
    songs,
    scores,
    onJacketClick,
    settingsTitleLang,
}) => {
    // --- States ---
    const [tourDiffs, setTourDiffs] = useState(["master"]);
    const [tourMinLevel, setTourMinLevel] = useState(30);
    const [tourMaxLevel, setTourMaxLevel] = useState(30);
    const [tourGoal, setTourGoal] = useState("fc");
    const [tourNewFilter, setTourNewFilter] = useState("all"); // "all", "new", "old"
    const [tourRemainingVisibleCount, setTourRemainingVisibleCount] = useState(30);
    const [tourCompletedVisibleCount, setTourCompletedVisibleCount] = useState(30);
    const [isTourFilterExpanded, setIsTourFilterExpanded] = useState(true);

    // --- Infinite scroll observers ---
    const tourRemainingObserver = useRef(null);
    const tourRemainingSentinelRef = useCallback((node) => {
        if (tourRemainingObserver.current) tourRemainingObserver.current.disconnect();
        tourRemainingObserver.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setTourRemainingVisibleCount((prev) => prev + 30);
                }
            },
            { rootMargin: "200px" },
        );
        if (node) tourRemainingObserver.current.observe(node);
    }, []);

    const tourCompletedObserver = useRef(null);
    const tourCompletedSentinelRef = useCallback((node) => {
        if (tourCompletedObserver.current) tourCompletedObserver.current.disconnect();
        tourCompletedObserver.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setTourCompletedVisibleCount((prev) => prev + 30);
                }
            },
            { rootMargin: "200px" },
        );
        if (node) tourCompletedObserver.current.observe(node);
    }, []);

    // --- Reset visibility counts on filter changes ---
    useEffect(() => {
        setTourRemainingVisibleCount(30);
        setTourCompletedVisibleCount(30);
    }, [tourDiffs, tourMinLevel, tourMaxLevel, tourGoal, tourNewFilter]);

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

    // --- Compute available levels for the selection options ---
    const tourAvailableLevels = useMemo(() => {
        const levelsSet = new Set();
        songs.forEach((song) => {
            tourDiffs.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl) levelsSet.add(lvl);
            });
        });
        return Array.from(levelsSet).sort((a, b) => a - b);
    }, [tourDiffs, songs]);

    // --- Adjust min/max level options dynamically ---
    useEffect(() => {
        if (tourAvailableLevels.length > 0) {
            if (!tourAvailableLevels.includes(tourMinLevel)) {
                setTourMinLevel(tourAvailableLevels[0]);
            }
            if (!tourAvailableLevels.includes(tourMaxLevel)) {
                setTourMaxLevel(tourAvailableLevels[tourAvailableLevels.length - 1]);
            }
        }
    }, [tourDiffs, tourAvailableLevels]);

    // --- Compute charts matching filters ---
    const tourCharts = useMemo(() => {
        const charts = [];
        songs.forEach((song) => {
            const songNew = isNewSong(song);
            if (tourNewFilter === "new" && !songNew) return;
            if (tourNewFilter === "old" && songNew) return;

            tourDiffs.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl && lvl >= tourMinLevel && lvl <= tourMaxLevel) {
                    charts.push({ song, diff, level: lvl });
                }
            });
        });
        return charts.sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            const titleA = a.song.title_ko || a.song.title_jp || "";
            const titleB = b.song.title_ko || b.song.title_jp || "";
            return titleA.localeCompare(titleB);
        });
    }, [tourDiffs, tourMinLevel, tourMaxLevel, tourNewFilter, songs]);

    // --- Compute statistics ---
    const tourStats = useMemo(() => {
        let completedCount = 0;
        const completedList = [];
        const remainingList = [];

        tourCharts.forEach(({ song, diff, level }) => {
            const userPlay = userScoresMap.get(String(song.id));
            const status = userPlay ? userPlay[diff] : null;

            let isGoalMet = false;
            if (tourGoal === "fc") {
                isGoalMet = status === "full_combo" || status === "full_perfect";
            } else if (tourGoal === "ap") {
                isGoalMet = status === "full_perfect";
            }

            const chartInfo = { song, diff, level, status };

            if (isGoalMet) {
                completedCount++;
                completedList.push(chartInfo);
            } else {
                remainingList.push(chartInfo);
            }
        });

        const total = tourCharts.length;
        const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        return {
            total,
            completedCount,
            remainingCount: total - completedCount,
            percentage,
            completedList,
            remainingList,
        };
    }, [tourCharts, tourGoal, userScoresMap]);

    return (
        <section className="glass-panel" style={{ padding: "2rem" }}>
            <div className="section-title-bar">
                <div>
                    <h2 className="section-title">
                        <Target size={22} style={{ color: "var(--color-cyan)" }} /> 곡 순회
                    </h2>
                </div>
            </div>

            <div className="tour-layout">
                <aside className="glass-panel tour-selection">
                    <h3
                        onClick={() => setIsTourFilterExpanded(!isTourFilterExpanded)}
                        style={{
                            fontSize: "1rem",
                            borderBottom: "1px solid var(--border-color)",
                            paddingBottom: "0.5rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                        }}
                    >
                        <span>순회 타겟</span>
                        <span
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                fontWeight: "500",
                            }}
                        >
                            {isTourFilterExpanded ? "접기" : "펼치기"}
                        </span>
                    </h3>

                    {isTourFilterExpanded && (
                        <>
                            <div className="filter-group">
                                <label className="filter-label">난이도</label>
                                <div
                                    className="filter-checkbox-group"
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(3, 1fr)",
                                        gap: "0.4rem",
                                    }}
                                >
                                    {["easy", "normal", "hard", "expert", "master", "append"].map(
                                        (diff) => {
                                            const diffNames = {
                                                easy: "EASY",
                                                normal: "NORMAL",
                                                hard: "HARD",
                                                expert: "EXPERT",
                                                master: "MASTER",
                                                append: "APPEND",
                                            };
                                            const isActive = tourDiffs.includes(diff);
                                            return (
                                                <label
                                                    key={diff}
                                                    className={`checkbox-label ${isActive ? `active-${diff}` : ""}`}
                                                    style={{
                                                        justifyContent: "center",
                                                        padding: "0.35rem 0.25rem",
                                                        fontSize: "0.75rem",
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isActive}
                                                        onChange={() => {
                                                            if (isActive) {
                                                                if (tourDiffs.length > 1) {
                                                                    setTourDiffs(
                                                                        tourDiffs.filter((d) => d !== diff),
                                                                    );
                                                                }
                                                            } else {
                                                                setTourDiffs([...tourDiffs, diff]);
                                                            }
                                                        }}
                                                    />
                                                    {diffNames[diff]}
                                                </label>
                                            );
                                        },
                                    )}
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">목표 레벨</label>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <select
                                        className="form-control"
                                        value={tourMinLevel}
                                        style={{ flex: 1 }}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setTourMinLevel(val);
                                            if (tourMaxLevel < val) {
                                                setTourMaxLevel(val);
                                            }
                                        }}
                                    >
                                        {tourAvailableLevels.length > 0 ? (
                                            tourAvailableLevels.map((lvl) => (
                                                <option key={lvl} value={lvl}>
                                                    {lvl}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="">-</option>
                                        )}
                                    </select>
                                    <span style={{ color: "var(--text-muted)" }}>~</span>
                                    <select
                                        className="form-control"
                                        value={tourMaxLevel}
                                        style={{ flex: 1 }}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setTourMaxLevel(val);
                                            if (tourMinLevel > val) {
                                                setTourMinLevel(val);
                                            }
                                        }}
                                    >
                                        {tourAvailableLevels.length > 0 ? (
                                            tourAvailableLevels.map((lvl) => (
                                                <option key={lvl} value={lvl}>
                                                    {lvl}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="">-</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">달성 목표</label>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        className={`btn btn-outline ${tourGoal === "fc" ? "active" : ""}`}
                                        style={{ flex: 1, padding: "0.4rem" }}
                                        onClick={() => setTourGoal("fc")}
                                    >
                                        FC
                                    </button>
                                    <button
                                        className={`btn btn-outline ${tourGoal === "ap" ? "active" : ""}`}
                                        style={{ flex: 1, padding: "0.4rem" }}
                                        onClick={() => setTourGoal("ap")}
                                    >
                                        AP
                                    </button>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">신곡 여부</label>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    {[
                                        { id: "all", label: "전체" },
                                        { id: "new", label: "신곡" },
                                        { id: "old", label: "구곡" },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            className={`btn btn-outline ${tourNewFilter === opt.id ? "active" : ""}`}
                                            style={{
                                                flex: 1,
                                                padding: "0.4rem",
                                                fontSize: "0.8rem",
                                                borderColor: tourNewFilter === opt.id && opt.id === "new" ? "#ffd200" : "",
                                                color: tourNewFilter === opt.id && opt.id === "new" ? "#ffd200" : "",
                                            }}
                                            onClick={() => setTourNewFilter(opt.id)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tour-stat-circle" style={{ margin: "1.5rem auto 1rem auto" }}>
                                <svg className="tour-gauge-svg" viewBox="0 0 100 100">
                                    <defs>
                                        <linearGradient
                                            id="gaugeGradient"
                                            x1="0%"
                                            y1="0%"
                                            x2="100%"
                                            y2="100%"
                                        >
                                            <stop offset="0%" stopColor="var(--color-cyan)" />
                                            <stop offset="100%" stopColor="var(--color-pink)" />
                                        </linearGradient>
                                        <linearGradient
                                            id="gaugeGradientSuccess"
                                            x1="0%"
                                            y1="0%"
                                            x2="100%"
                                            y2="100%"
                                        >
                                            <stop offset="0%" stopColor="var(--color-cyan)" />
                                            <stop offset="100%" stopColor="var(--color-success)" />
                                        </linearGradient>
                                    </defs>
                                    <circle className="tour-gauge-bg" cx="50" cy="50" r="44" />
                                    <circle
                                        className="tour-gauge-fill"
                                        cx="50"
                                        cy="50"
                                        r="44"
                                        stroke={
                                            tourStats.percentage > 70
                                                ? "url(#gaugeGradientSuccess)"
                                                : "url(#gaugeGradient)"
                                        }
                                        style={{
                                            strokeDasharray: 2 * Math.PI * 44,
                                            strokeDashoffset:
                                                2 * Math.PI * 44 * (1 - tourStats.percentage / 100),
                                        }}
                                    />
                                </svg>
                                <div className="tour-stat-content">
                                    <span className="tour-pct">{tourStats.percentage}%</span>
                                    <span className="tour-fraction">
                                        {tourStats.completedCount} / {tourStats.total}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </aside>

                <div className="tour-lists">
                    {/* Uncompleted (CRITICAL HUNT LIST) */}
                    <div
                        className="glass-panel song-list-panel"
                        style={{ borderLeft: "4px solid var(--color-pink)" }}
                    >
                        <h3
                            style={{
                                fontSize: "1.1rem",
                                marginBottom: "1rem",
                                color: "var(--color-pink)",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <XCircle size={18} /> 미완료 곡 ({tourStats.remainingCount}곡)
                        </h3>

                        <div className="tour-grid">
                            {tourStats.remainingList.length === 0
                                ? null
                                : tourStats.remainingList
                                      .slice(0, tourRemainingVisibleCount)
                                      .map(({ song, diff, level, status }) => {
                                          const diffColors = {
                                              easy: "diff-easy",
                                              normal: "diff-normal",
                                              hard: "diff-hard",
                                              expert: "diff-expert",
                                              master: "diff-master",
                                              append: "diff-append",
                                          };
                                          const currentStatus = status || "none";
                                          const statusLabels = {
                                              full_perfect: "status-ap",
                                              full_combo: "status-fc",
                                              clear: "status-clear",
                                              none: "status-none",
                                          };
                                          const statusText = {
                                              full_perfect: "AP",
                                              full_combo: "FC",
                                              clear: "C",
                                              none: "NC",
                                          };
                                          return (
                                              <div
                                                  key={`${song.id}-${diff}`}
                                                  className="glass-panel tour-song-card hover-lift"
                                                  style={{
                                                      display: "flex",
                                                      flexDirection: "row",
                                                      gap: "0.75rem",
                                                      alignItems: "center",
                                                      cursor: "pointer",
                                                  }}
                                                  onClick={() =>
                                                      onJacketClick(song, diff, currentStatus)
                                                  }
                                              >
                                                  <JacketImage songId={song.id} size={42} />
                                                  <div style={{ flex: 1, minWidth: 0 }}>
                                                      <div className="tour-song-title">
                                                          {getSongTitle(song)}
                                                      </div>
                                                      <div
                                                          style={{
                                                              display: "flex",
                                                              alignItems: "center",
                                                              gap: "0.4rem",
                                                              marginTop: "0.2rem",
                                                          }}
                                                      >
                                                          <span
                                                              className={`diff-badge ${diffColors[diff] || ""}`}
                                                              style={{
                                                                  fontSize: "0.65rem",
                                                                  padding: "0.05rem 0.3rem",
                                                              }}
                                                          >
                                                              {diff.toUpperCase()} {level}
                                                          </span>
                                                          <span
                                                              className={`status-badge ${statusLabels[currentStatus]}`}
                                                              style={{
                                                                  fontSize: "0.65rem",
                                                                  padding: "0.1rem 0.35rem",
                                                              }}
                                                          >
                                                              {statusText[currentStatus]}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                            {/* Sentinel for IntersectionObserver */}
                            {tourStats.remainingList.length > tourRemainingVisibleCount && (
                                <div
                                    ref={tourRemainingSentinelRef}
                                    style={{
                                        gridColumn: "1 / -1",
                                        height: "45px",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        color: "var(--text-muted)",
                                        fontSize: "0.85rem",
                                        margin: "1rem 0",
                                    }}
                                >
                                    <span>미완료 곡을 불러오는 중...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Completed */}
                    <div
                        className="glass-panel song-list-panel"
                        style={{ borderLeft: "4px solid var(--color-success)" }}
                    >
                        <h3
                            style={{
                                fontSize: "1.1rem",
                                marginBottom: "1rem",
                                color: "var(--color-success)",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <CheckCircle2 size={18} /> 완료 곡 ({tourStats.completedCount}곡)
                        </h3>

                        <div className="tour-grid">
                            {tourStats.completedList
                                .slice(0, tourCompletedVisibleCount)
                                .map(({ song, diff, level, status }) => {
                                    const diffColors = {
                                        easy: "diff-easy",
                                        normal: "diff-normal",
                                        hard: "diff-hard",
                                        expert: "diff-expert",
                                        master: "diff-master",
                                        append: "diff-append",
                                    };
                                    const currentStatus = status || "none";
                                    const statusLabels = {
                                        full_perfect: "status-ap",
                                        full_combo: "status-fc",
                                        clear: "status-clear",
                                        none: "status-none",
                                    };
                                    const statusText = {
                                        full_perfect: "AP",
                                        full_combo: "FC",
                                        clear: "C",
                                        none: "NC",
                                    };
                                    return (
                                        <div
                                            key={`${song.id}-${diff}`}
                                            className="glass-panel tour-song-card hover-lift"
                                            style={{
                                                opacity: 0.6,
                                                display: "flex",
                                                flexDirection: "row",
                                                gap: "0.75rem",
                                                alignItems: "center",
                                                cursor: "pointer",
                                            }}
                                            onClick={() => onJacketClick(song, diff, currentStatus)}
                                        >
                                            <JacketImage songId={song.id} size={42} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="tour-song-title">{getSongTitle(song)}</div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "0.4rem",
                                                        marginTop: "0.2rem",
                                                    }}
                                                >
                                                    <span
                                                        className={`diff-badge ${diffColors[diff] || ""}`}
                                                        style={{
                                                            fontSize: "0.65rem",
                                                            padding: "0.05rem 0.3rem",
                                                        }}
                                                    >
                                                        {diff.toUpperCase()} {level}
                                                    </span>
                                                    <span
                                                        className={`status-badge ${statusLabels[currentStatus]}`}
                                                        style={{
                                                            fontSize: "0.65rem",
                                                            padding: "0.1rem 0.35rem",
                                                        }}
                                                    >
                                                        {statusText[currentStatus]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            {/* Sentinel for IntersectionObserver */}
                            {tourStats.completedList.length > tourCompletedVisibleCount && (
                                <div
                                    ref={tourCompletedSentinelRef}
                                    style={{
                                        gridColumn: "1 / -1",
                                        height: "45px",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        color: "var(--text-muted)",
                                        fontSize: "0.85rem",
                                        margin: "1rem 0",
                                    }}
                                >
                                    <span>완료 곡을 불러오는 중...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
