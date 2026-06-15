import React, { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";

export const RatingGraph = ({ effectiveUser, mode = "b39" }) => {
    // --- Graph Filters & Hover States ---
    const [graphRangeType, setGraphRangeType] = useState("all"); // 7d, 1m, 6m, 1y, all, custom
    const [graphCustomStart, setGraphCustomStart] = useState("");
    const [graphCustomEnd, setGraphCustomEnd] = useState("");
    const [showTotalLine, setShowTotalLine] = useState(true);
    const [showNormalLine, setShowNormalLine] = useState(true);
    const [showAppendLine, setShowAppendLine] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState(null);

    // --- Process daily rating history ---
    const dailyRatingHistoryData = useMemo(() => {
        if (!effectiveUser || !effectiveUser.rating_history) return [];
        const history = effectiveUser.rating_history;
        const sortedDates = Object.keys(history).sort();
        if (sortedDates.length === 0) return [];

        const firstDateStr = sortedDates[0];

        // Use formatter to get today's date in Asia/Seoul timezone (e.g. YYYY-MM-DD)
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        const todayStr = formatter.format(new Date());

        // Parse dates in UTC to avoid local timezone/DST differences
        const startUTC = new Date(firstDateStr + "T00:00:00Z");
        const endUTC = new Date(todayStr + "T00:00:00Z");

        const data = [];
        let lastNormal = 0;
        let lastAppend = 0;

        const curr = new Date(startUTC);
        while (curr <= endUTC) {
            const year = curr.getUTCFullYear();
            const month = String(curr.getUTCMonth() + 1).padStart(2, "0");
            const day = String(curr.getUTCDate()).padStart(2, "0");
            const dateStr = `${year}-${month}-${day}`;

            const val = history[dateStr];
            if (val !== undefined && val !== null) {
                lastNormal = typeof val === "object" ? Number(val.normal) || 0 : Number(val) || 0;
                lastAppend = typeof val === "object" ? Number(val.append) || 0 : 0;
            }

            data.push({
                date: dateStr,
                normal: lastNormal,
                append: lastAppend,
                total: lastNormal + lastAppend,
            });

            curr.setUTCDate(curr.getUTCDate() + 1);
        }

        return data.filter((d) => d.total > 0);
    }, [effectiveUser]);

    // --- Process daily potential history ---
    const dailyPotentialHistoryData = useMemo(() => {
        if (!effectiveUser || !effectiveUser.rating_history) return [];
        const history = effectiveUser.rating_history;
        const sortedDates = Object.keys(history).sort();
        if (sortedDates.length === 0) return [];

        const firstDateStr = sortedDates[0];
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        const todayStr = formatter.format(new Date());
        const startUTC = new Date(firstDateStr + "T00:00:00Z");
        const endUTC = new Date(todayStr + "T00:00:00Z");

        const data = [];
        let lastPotential = 0;

        const curr = new Date(startUTC);
        while (curr <= endUTC) {
            const year = curr.getUTCFullYear();
            const month = String(curr.getUTCMonth() + 1).padStart(2, "0");
            const day = String(curr.getUTCDate()).padStart(2, "0");
            const dateStr = `${year}-${month}-${day}`;

            const val = history[dateStr];
            if (val !== undefined && val !== null && typeof val === "object") {
                const p = Number(val.potential) || 0;
                if (p > 0) lastPotential = p;
            }

            data.push({
                date: dateStr,
                potential: lastPotential,
            });

            curr.setUTCDate(curr.getUTCDate() + 1);
        }

        return data.filter((d) => d.potential > 0);
    }, [effectiveUser]);

    if (!effectiveUser) {
        return (
            <div
                style={{
                    height: "160px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255, 255, 255, 0.01)",
                    border: "1px dashed var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    padding: "1rem",
                    textAlign: "center",
                }}
            >
                🔒 로그인 시 레이팅 상승 추세 그래프가 이곳에 표시됩니다.
            </div>
        );
    }

    const activeHistoryData = useMemo(() => {
        return mode === "potential" ? dailyPotentialHistoryData : dailyRatingHistoryData;
    }, [mode, dailyPotentialHistoryData, dailyRatingHistoryData]);

    if (activeHistoryData.length === 0) {
        return (
            <div
                style={{
                    height: "160px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255, 255, 255, 0.01)",
                    border: "1px dashed var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    padding: "1rem",
                    textAlign: "center",
                }}
            >
                {mode === "potential"
                    ? "등록된 Potential 히스토리가 없습니다. 기록 저장 시 그래프가 생성됩니다."
                    : "등록된 레이팅 히스토리가 없습니다. 기록 저장 시 그래프가 생성됩니다."}
            </div>
        );
    }

    const width = 600;
    const height = 200;
    const paddingX = 45;
    const paddingY = 30;

    // Get today's date string in Seoul timezone
    const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    const todayUTCMs = new Date(todayStr + "T00:00:00Z").getTime();

    let minTime = null;
    let maxTime = null;

    if (graphRangeType === "7d") {
        minTime = todayUTCMs - 6 * 24 * 60 * 60 * 1000;
        maxTime = todayUTCMs;
    } else if (graphRangeType === "1m") {
        minTime = todayUTCMs - 29 * 24 * 60 * 60 * 1000;
        maxTime = todayUTCMs;
    } else if (graphRangeType === "6m") {
        minTime = todayUTCMs - 179 * 24 * 60 * 60 * 1000;
        maxTime = todayUTCMs;
    } else if (graphRangeType === "1y") {
        minTime = todayUTCMs - 364 * 24 * 60 * 60 * 1000;
        maxTime = todayUTCMs;
    } else if (graphRangeType === "custom") {
        minTime = graphCustomStart
            ? new Date(graphCustomStart + "T00:00:00Z").getTime()
            : Math.min(...activeHistoryData.map((d) => new Date(d.date + "T00:00:00Z").getTime()));
        maxTime = graphCustomEnd
            ? new Date(graphCustomEnd + "T00:00:00Z").getTime()
            : Math.max(...activeHistoryData.map((d) => new Date(d.date + "T00:00:00Z").getTime()));
    } else {
        // "all"
        const times = activeHistoryData.map((d) => new Date(d.date + "T00:00:00Z").getTime());
        minTime = Math.min(...times);
        maxTime = todayUTCMs;
    }

    if (maxTime <= minTime) {
        minTime = maxTime - 24 * 60 * 60 * 1000;
    }

    const timeRange = maxTime - minTime || 1;

    const insidePoints = activeHistoryData.filter((d) => {
        const t = new Date(d.date + "T00:00:00Z").getTime();
        return t >= minTime && t <= maxTime;
    });

    const beforePoints = activeHistoryData.filter((d) => {
        const t = new Date(d.date + "T00:00:00Z").getTime();
        return t < minTime;
    });
    const lastPointBefore = beforePoints.length > 0 ? beforePoints[beforePoints.length - 1] : null;

    const formatDate = (ms) => {
        const d = new Date(ms);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    let activeDataList = [...insidePoints];
    if (lastPointBefore) {
        const hasStart = activeDataList.some((p) => new Date(p.date + "T00:00:00Z").getTime() === minTime);
        if (!hasStart) {
            activeDataList.unshift({
                date: formatDate(minTime),
                normal: lastPointBefore.normal,
                append: lastPointBefore.append,
                total: lastPointBefore.total,
                potential: lastPointBefore.potential,
                isVirtual: true,
            });
        }
    }

    if (activeDataList.length > 0) {
        const latest = activeDataList[activeDataList.length - 1];
        const latestTime = new Date(latest.date + "T00:00:00Z").getTime();
        if (latestTime < maxTime) {
            activeDataList.push({
                date: formatDate(maxTime),
                normal: latest.normal,
                append: latest.append,
                total: latest.total,
                potential: latest.potential,
                isVirtual: true,
            });
        }
    }

    if (activeDataList.length === 1) {
        const p = activeDataList[0];
        const pTime = new Date(p.date + "T00:00:00Z").getTime();
        if (pTime > minTime) {
            activeDataList.unshift({
                date: formatDate(minTime),
                normal: p.normal,
                append: p.append,
                total: p.total,
                potential: p.potential,
                isVirtual: true,
            });
        }
        if (pTime < maxTime) {
            activeDataList.push({
                date: formatDate(maxTime),
                normal: p.normal,
                append: p.append,
                total: p.total,
                potential: p.potential,
                isVirtual: true,
            });
        }
    }

    const renderGraphControls = () => {
        const activeColor = mode === "potential" ? "#c77dff" : "var(--color-cyan)";
        const activeBg = mode === "potential" ? "rgba(199, 125, 255, 0.08)" : "rgba(0, 242, 254, 0.08)";

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span
                        style={{
                            fontSize: "0.8rem",
                            fontWeight: "700",
                            color: "var(--text-secondary)",
                            marginRight: "0.5rem",
                        }}
                    >
                        조회 기간:
                    </span>
                    {[
                        { id: "7d", label: "7일" },
                        { id: "1m", label: "1달" },
                        { id: "6m", label: "6달" },
                        { id: "1y", label: "1년" },
                        { id: "all", label: "전체" },
                        { id: "custom", label: "직접 설정" },
                    ].map((btn) => (
                        <button
                            key={btn.id}
                            type="button"
                            className="btn btn-outline"
                            style={{
                                padding: "0.25rem 0.6rem",
                                fontSize: "0.8rem",
                                borderRadius: "6px",
                                borderColor: graphRangeType === btn.id ? activeColor : "var(--border-color)",
                                background: graphRangeType === btn.id ? activeBg : "transparent",
                                color: graphRangeType === btn.id ? activeColor : "var(--text-secondary)",
                            }}
                            onClick={() => setGraphRangeType(btn.id)}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {graphRangeType === "custom" && (
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <input
                                type="date"
                                className="form-control"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", width: "135px" }}
                                value={graphCustomStart}
                                onChange={(e) => setGraphCustomStart(e.target.value)}
                            />
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>~</span>
                            <input
                                type="date"
                                className="form-control"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", width: "135px" }}
                                value={graphCustomEnd}
                                onChange={(e) => setGraphCustomEnd(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (activeDataList.length === 0) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {renderGraphControls()}
                <div
                    style={{
                        height: "160px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255, 255, 255, 0.01)",
                        border: "1px dashed var(--border-color)",
                        borderRadius: "12px",
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                        padding: "1rem",
                        textAlign: "center",
                    }}
                >
                    📅 선택한 기간 내에 레이팅 기록이 존재하지 않습니다.
                </div>
            </div>
        );
    }

    let maxVal, minVal;
    if (mode === "potential") {
        const potentials = activeDataList.map((d) => d.potential).filter((v) => v > 0);
        maxVal = potentials.length > 0 ? Math.max(...potentials) : 40.0;
        minVal = potentials.length > 0 ? Math.min(...potentials) : 0.0;
    } else {
        const totals = showTotalLine ? activeDataList.map((d) => d.total) : [];
        const normals = showNormalLine ? activeDataList.map((d) => d.normal) : [];
        const appends = showAppendLine ? activeDataList.map((d) => d.append) : [];
        const allVals = [...totals, ...normals, ...appends].filter((v) => v > 0);
        maxVal = allVals.length > 0 ? Math.max(...allVals) : 10000;
        minVal = allVals.length > 0 ? Math.min(...allVals) : 0;
    }
    const range = maxVal - minVal;

    let yMin, yMax;
    if (mode === "potential") {
        yMin = range === 0 ? minVal - 0.5 : minVal - Math.max(0.2, range * 0.05);
        yMax = range === 0 ? maxVal + 0.5 : maxVal + Math.max(0.2, range * 0.05);
    } else {
        yMin = range === 0 ? minVal - 50 : minVal - Math.max(30, Math.round(range * 0.05));
        yMax = range === 0 ? maxVal + 50 : maxVal + Math.max(30, Math.round(range * 0.05));
    }
    const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

    const points = activeDataList.map((d) => {
        const t = new Date(d.date + "T00:00:00Z").getTime();
        const x = paddingX + ((t - minTime) / timeRange) * (width - 2 * paddingX);
        if (mode === "potential") {
            const yPotential = height - paddingY - (((d.potential || 0) - yMin) / yRange) * (height - 2 * paddingY);
            return { x, yPotential, ...d };
        } else {
            const yTotal = height - paddingY - (((d.total || 0) - yMin) / yRange) * (height - 2 * paddingY);
            const yNormal = height - paddingY - (((d.normal || 0) - yMin) / yRange) * (height - 2 * paddingY);
            const yAppend =
                d.append > 0
                    ? height - paddingY - (((d.append || 0) - yMin) / yRange) * (height - 2 * paddingY)
                    : height - paddingY;
            return { x, yTotal, yNormal, yAppend, ...d };
        }
    });

    let linePathTotal = "";
    let linePathNormal = "";
    let linePathAppend = "";
    let linePathPotential = "";

    if (points.length > 0) {
        if (mode === "potential") {
            linePathPotential = `M ${points[0].x} ${points[0].yPotential}`;
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                linePathPotential += ` L ${curr.x} ${prev.yPotential} L ${curr.x} ${curr.yPotential}`;
            }
        } else {
            linePathTotal = `M ${points[0].x} ${points[0].yTotal}`;
            linePathNormal = `M ${points[0].x} ${points[0].yNormal}`;

            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                linePathTotal += ` L ${curr.x} ${prev.yTotal} L ${curr.x} ${curr.yTotal}`;
                linePathNormal += ` L ${curr.x} ${prev.yNormal} L ${curr.x} ${curr.yNormal}`;
            }

            const appendPoints = points.filter((p) => p.append > 0);
            if (appendPoints.length > 0) {
                linePathAppend = `M ${appendPoints[0].x} ${appendPoints[0].yAppend}`;
                for (let i = 1; i < appendPoints.length; i++) {
                    const prev = appendPoints[i - 1];
                    const curr = appendPoints[i];
                    linePathAppend += ` L ${curr.x} ${prev.yAppend} L ${curr.x} ${curr.yAppend}`;
                }
            }
        }
    }

    const areaPathTotal =
        mode !== "potential" && points.length > 1 && linePathTotal
            ? `${linePathTotal} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
            : "";

    const areaPathPotential =
        mode === "potential" && points.length > 1 && linePathPotential
            ? `${linePathPotential} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
            : "";

    const labelTicks = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
        const t = minTime + (i / tickCount) * timeRange;
        const x = paddingX + (i / tickCount) * (width - 2 * paddingX);
        const dateStr = formatDate(t).substring(5); // MM-DD
        labelTicks.push({ x, label: dateStr });
    }

    return (
        <div style={{ position: "relative", width: "100%", overflow: "visible", marginBottom: "1rem" }}>
            {renderGraphControls()}

            <div className="chart-scroll-container trend-chart-container" style={{ position: "relative" }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                    <defs>
                        <linearGradient id="totalLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                        <linearGradient id="normalLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                        <linearGradient id="appendLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f472b6" />
                            <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="potentialLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#c77dff" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                        <linearGradient id="potentialAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#c77dff" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#c77dff" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Legend with click triggers */}
                    {mode === "potential" ? (
                        <g transform={`translate(${paddingX}, 12)`} fontSize="9" fontWeight="700">
                            <circle cx="5" cy="5" r="4" fill="#c77dff" />
                            <text x="15" y="8" fill="var(--text-primary)">
                                Potential
                            </text>
                        </g>
                    ) : (
                        <g transform={`translate(${paddingX}, 12)`} fontSize="9" fontWeight="700">
                            <g
                                style={{
                                    cursor: "pointer",
                                    opacity: showTotalLine ? 1 : 0.4,
                                    transition: "opacity 0.2s",
                                }}
                                onClick={() => setShowTotalLine(!showTotalLine)}
                            >
                                <circle cx="5" cy="5" r="4" fill="#fbbf24" />
                                <text x="15" y="8" fill="var(--text-primary)">
                                    Total R
                                </text>
                            </g>

                            <g
                                style={{
                                    cursor: "pointer",
                                    opacity: showNormalLine ? 1 : 0.4,
                                    transition: "opacity 0.2s",
                                }}
                                onClick={() => setShowNormalLine(!showNormalLine)}
                            >
                                <circle cx="85" cy="5" r="4" fill="#22d3ee" />
                                <text x="95" y="8" fill="var(--text-primary)">
                                    Player R
                                </text>
                            </g>

                            <g
                                style={{
                                    cursor: "pointer",
                                    opacity: showAppendLine ? 1 : 0.4,
                                    transition: "opacity 0.2s",
                                }}
                                onClick={() => setShowAppendLine(!showAppendLine)}
                            >
                                <circle cx="165" cy="5" r="4" fill="#f472b6" />
                                <text x="175" y="8" fill="var(--text-primary)">
                                    Append R
                                </text>
                            </g>
                        </g>
                    )}

                    {/* Y-Axis Horizontal Grid lines */}
                    <line
                        x1={paddingX}
                        y1={paddingY}
                        x2={width - paddingX}
                        y2={paddingY}
                        stroke="rgba(255,255,255,0.03)"
                        strokeDasharray="4 4"
                    />
                    <line
                        x1={paddingX}
                        y1={(height - paddingY * 2) / 2 + paddingY}
                        x2={width - paddingX}
                        y2={(height - paddingY * 2) / 2 + paddingY}
                        stroke="rgba(255,255,255,0.03)"
                        strokeDasharray="4 4"
                    />
                    <line
                        x1={paddingX}
                        y1={height - paddingY}
                        x2={width - paddingX}
                        y2={height - paddingY}
                        stroke="rgba(255,255,255,0.08)"
                    />

                    {/* Time-axis Grid Ticks & Labels */}
                    {labelTicks.map((tick, index) => (
                        <g key={index}>
                            {index > 0 && index < tickCount && (
                                <line
                                    x1={tick.x}
                                    y1={paddingY}
                                    x2={tick.x}
                                    y2={height - paddingY}
                                    stroke="rgba(255, 255, 255, 0.02)"
                                    strokeDasharray="2 2"
                                />
                            )}
                            <text
                                x={tick.x}
                                y={height - 8}
                                fill="var(--text-muted)"
                                fontSize="9"
                                textAnchor="middle"
                                fontWeight="600"
                            >
                                {tick.label}
                            </text>
                        </g>
                    ))}

                    {/* Area & Lines */}
                    {mode === "potential" ? (
                        <>
                            {areaPathPotential && <path d={areaPathPotential} fill="url(#potentialAreaGrad)" />}
                            {linePathPotential && (
                                <path
                                    d={linePathPotential}
                                    fill="none"
                                    stroke="#c77dff"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}
                        </>
                    ) : (
                        <>
                            {showTotalLine && areaPathTotal && <path d={areaPathTotal} fill="url(#areaGrad)" />}
                            {showAppendLine && linePathAppend && (
                                <path
                                    d={linePathAppend}
                                    fill="none"
                                    stroke="#f472b6"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}
                            {showNormalLine && linePathNormal && (
                                <path
                                    d={linePathNormal}
                                    fill="none"
                                    stroke="#22d3ee"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}
                            {showTotalLine && linePathTotal && (
                                <path
                                    d={linePathTotal}
                                    fill="none"
                                    stroke="#fbbf24"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}
                        </>
                    )}

                    {hoveredPoint && (
                        <g>
                            <line
                                x1={hoveredPoint.x}
                                y1={paddingY}
                                x2={hoveredPoint.x}
                                y2={height - paddingY}
                                stroke="rgba(255, 255, 255, 0.15)"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                            />
                            {mode === "potential" ? (
                                <circle
                                    cx={hoveredPoint.x}
                                    cy={hoveredPoint.yPotential}
                                    r="5.5"
                                    fill="#111827"
                                    stroke="#c77dff"
                                    strokeWidth="2.5"
                                />
                            ) : (
                                <>
                                    {showAppendLine && hoveredPoint.append > 0 && (
                                        <circle
                                            cx={hoveredPoint.x}
                                            cy={hoveredPoint.yAppend}
                                            r="5"
                                            fill="#111827"
                                            stroke="#f472b6"
                                            strokeWidth="2.5"
                                        />
                                    )}
                                    {showNormalLine && (
                                        <circle
                                            cx={hoveredPoint.x}
                                            cy={hoveredPoint.yNormal}
                                            r="5"
                                            fill="#111827"
                                            stroke="#22d3ee"
                                            strokeWidth="2.5"
                                        />
                                    )}
                                    {showTotalLine && (
                                        <circle
                                            cx={hoveredPoint.x}
                                            cy={hoveredPoint.yTotal}
                                            r="5.5"
                                            fill="#111827"
                                            stroke="#fbbf24"
                                            strokeWidth="2.5"
                                        />
                                    )}
                                </>
                            )}
                        </g>
                    )}

                    {points.map((p, i) => (
                        <rect
                            key={i}
                            x={p.x - 12}
                            y={paddingY}
                            width="24"
                            height={height - paddingY * 2}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoveredPoint(p)}
                            onMouseLeave={() => setHoveredPoint(null)}
                        />
                    ))}

                    <text
                        x={paddingX - 8}
                        y={paddingY + 3}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="end"
                        fontWeight="600"
                    >
                        {mode === "potential" ? yMax.toFixed(1) : Math.round(yMax)}
                    </text>
                    <text
                        x={paddingX - 8}
                        y={(height - paddingY * 2) / 2 + paddingY + 3}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="end"
                        fontWeight="600"
                    >
                        {mode === "potential" ? ((yMax + yMin) / 2).toFixed(1) : Math.round((yMax + yMin) / 2)}
                    </text>
                    <text
                        x={paddingX - 8}
                        y={height - paddingY + 3}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="end"
                        fontWeight="600"
                    >
                        {mode === "potential" ? yMin.toFixed(1) : Math.round(yMin)}
                    </text>
                </svg>

                {hoveredPoint &&
                    (() => {
                        const xPercent = (hoveredPoint.x / width) * 100;
                        let tooltipLeftPercent = xPercent;
                        let tooltipTransformX = "-50%";

                        if (xPercent < 15) {
                            tooltipLeftPercent = 5;
                            tooltipTransformX = "0%";
                        } else if (xPercent > 85) {
                            tooltipLeftPercent = 95;
                            tooltipTransformX = "-100%";
                        }

                        const activeY =
                            mode === "potential"
                                ? hoveredPoint.yPotential
                                : showTotalLine
                                  ? hoveredPoint.yTotal
                                  : showNormalLine
                                    ? hoveredPoint.yNormal
                                    : hoveredPoint.yAppend;
                        const yPercent = (activeY / height) * 100;
                        const isUpperHalf = yPercent < 50;

                        let tooltipTopPercent = yPercent;
                        let tooltipTransformY = "-100%";
                        let yOffsetPercent = -8;

                        if (isUpperHalf) {
                            tooltipTransformY = "0%";
                            yOffsetPercent = 8;
                        }

                        return (
                            <div
                                style={{
                                    position: "absolute",
                                    left: `${tooltipLeftPercent}%`,
                                    top: `${tooltipTopPercent + yOffsetPercent}%`,
                                    transform: `translate(${tooltipTransformX}, ${tooltipTransformY})`,
                                    background: "rgba(17, 24, 39, 0.95)",
                                    border: "1px solid var(--border-color)",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "8px",
                                    fontSize: "0.75rem",
                                    color: "var(--text-primary)",
                                    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.4)",
                                    pointerEvents: "none",
                                    zIndex: 100,
                                    whiteSpace: "nowrap",
                                    textAlign: "center",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.65rem",
                                        color: "var(--text-muted)",
                                        marginBottom: "0.2rem",
                                    }}
                                >
                                    {hoveredPoint.date}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.15rem",
                                        textAlign: "left",
                                    }}
                                >
                                    {mode === "potential" ? (
                                        <div style={{ fontWeight: "800", color: "#c77dff" }}>
                                            Potential: {(Math.floor(hoveredPoint.potential * 100) / 100).toFixed(2)}
                                        </div>
                                    ) : (
                                        <>
                                            {showTotalLine && (
                                                <div style={{ fontWeight: "800", color: "#fbbf24" }}>
                                                    Total R: {Math.round(hoveredPoint.total)}
                                                </div>
                                            )}
                                            {showNormalLine && (
                                                <div
                                                    style={{ fontSize: "0.7rem", color: "#22d3ee", fontWeight: "700" }}
                                                >
                                                    Player R: {Math.round(hoveredPoint.normal)}
                                                </div>
                                            )}
                                            {showAppendLine && (
                                                <div
                                                    style={{ fontSize: "0.7rem", color: "#f472b6", fontWeight: "700" }}
                                                >
                                                    Append R: {Math.round(hoveredPoint.append)}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
            </div>
        </div>
    );
};
