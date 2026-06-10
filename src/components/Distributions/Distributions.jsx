import React, { useState, useMemo, useRef } from "react";
import { BarChart3, Filter } from "lucide-react";
import { getConstant } from "../../utils/ratingUtils";

export default function Distributions({ songs, userScoresMap }) {
    const [isDistFilterExpanded, setIsDistFilterExpanded] = useState(true);
    const [distTab, setDistTab] = useState("level"); // level, constant, diff, unit
    const [distDiffs, setDistDiffs] = useState(["master", "expert", "append"]);
    const [distMinLevelInput, setDistMinLevelInput] = useState("");
    const [distMaxLevelInput, setDistMaxLevelInput] = useState("");
    const [distMinConstInput, setDistMinConstInput] = useState("");
    const [distMaxConstInput, setDistMaxConstInput] = useState("");
    const [distDisplayType, setDistDisplayType] = useState("count"); // count, percent

    const handleDistDiffFilterToggle = (diff) => {
        if (distDiffs.includes(diff)) {
            if (distDiffs.length > 1) {
                setDistDiffs(distDiffs.filter((d) => d !== diff));
            }
        } else {
            setDistDiffs([...distDiffs, diff]);
        }
    };

    const statsOverview = useMemo(() => {
        let total = 0;
        let ap = 0;
        let fc = 0;
        let clr = 0;
        let unplay = 0;

        let sumClearLvl = 0,
            countClearLvl = 0;
        let sumFcLvl = 0,
            countFcLvl = 0;
        let sumApLvl = 0,
            countApLvl = 0;
        let maxApLvl = 0;
        let maxFcLvl = 0;

        const minConstVal = distMinConstInput === "" ? 0.0 : parseFloat(distMinConstInput);
        const maxConstVal = distMaxConstInput === "" ? 100.0 : parseFloat(distMaxConstInput);
        const minLvlVal = distMinLevelInput === "" ? 0 : parseInt(distMinLevelInput);
        const maxLvlVal = distMaxLevelInput === "" ? 100 : parseInt(distMaxLevelInput);

        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id)) || {};
            distDiffs.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const constant = getConstant(song, diff, "clear");
                if (constant < minConstVal || constant > maxConstVal) return;

                total++;
                const status = userPlay[diff];
                if (status === "full_perfect") {
                    ap++;
                    sumApLvl += lvl;
                    countApLvl++;
                    if (lvl > maxApLvl) maxApLvl = lvl;
                    if (lvl > maxFcLvl) maxFcLvl = lvl;
                    sumFcLvl += lvl;
                    countFcLvl++;
                    sumClearLvl += lvl;
                    countClearLvl++;
                } else if (status === "full_combo") {
                    fc++;
                    if (lvl > maxFcLvl) maxFcLvl = lvl;
                    sumFcLvl += lvl;
                    countFcLvl++;
                    sumClearLvl += lvl;
                    countClearLvl++;
                } else if (status === "clear") {
                    clr++;
                    sumClearLvl += lvl;
                    countClearLvl++;
                } else {
                    unplay++;
                }
            });
        });

        return {
            total,
            ap,
            fc,
            clr,
            unplay,
            avgClearLvl: countClearLvl > 0 ? (sumClearLvl / countClearLvl).toFixed(1) : "-",
            avgFcLvl: countFcLvl > 0 ? (sumFcLvl / countFcLvl).toFixed(1) : "-",
            avgApLvl: countApLvl > 0 ? (sumApLvl / countApLvl).toFixed(1) : "-",
            maxApLvl: maxApLvl > 0 ? maxApLvl : "-",
            maxFcLvl: maxFcLvl > 0 ? maxFcLvl : "-",
        };
    }, [songs, userScoresMap, distDiffs, distMinLevelInput, distMaxLevelInput, distMinConstInput, distMaxConstInput]);

    const filteredLevelData = useMemo(() => {
        const data = {};
        const minConstVal = distMinConstInput === "" ? 0.0 : parseFloat(distMinConstInput);
        const maxConstVal = distMaxConstInput === "" ? 100.0 : parseFloat(distMaxConstInput);
        const minLvlVal = distMinLevelInput === "" ? 0 : parseInt(distMinLevelInput);
        const maxLvlVal = distMaxLevelInput === "" ? 100 : parseInt(distMaxLevelInput);

        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id)) || {};
            distDiffs.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const constant = getConstant(song, diff, "clear");
                if (constant < minConstVal || constant > maxConstVal) return;

                if (!data[lvl]) {
                    data[lvl] = { label: `${lvl}`, total: 0, ap: 0, fc: 0, clear: 0, unplayed: 0 };
                }

                data[lvl].total++;
                const status = userPlay[diff];
                if (status === "full_perfect") data[lvl].ap++;
                else if (status === "full_combo") data[lvl].fc++;
                else if (status === "clear") data[lvl].clear++;
                else data[lvl].unplayed++;
            });
        });

        return Object.values(data).sort((a, b) => parseInt(a.label) - parseInt(b.label));
    }, [songs, userScoresMap, distDiffs, distMinLevelInput, distMaxLevelInput, distMinConstInput, distMaxConstInput]);

    const filteredConstantData = useMemo(() => {
        const data = {};
        const minConstVal = distMinConstInput === "" ? 0.0 : parseFloat(distMinConstInput);
        const maxConstVal = distMaxConstInput === "" ? 100.0 : parseFloat(distMaxConstInput);
        const minLvlVal = distMinLevelInput === "" ? 0 : parseInt(distMinLevelInput);
        const maxLvlVal = distMaxLevelInput === "" ? 100 : parseInt(distMaxLevelInput);

        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id)) || {};
            distDiffs.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const constant = getConstant(song, diff, "clear");
                if (constant < minConstVal || constant > maxConstVal) return;

                const binValue = Math.floor(constant * 2) / 2;
                const key = binValue.toFixed(1);

                if (!data[key]) {
                    const label = binValue % 1 === 0 ? `${binValue.toFixed(0)}.0~.4` : `${Math.floor(binValue)}.5~.9`;
                    data[key] = { label, sortVal: binValue, total: 0, ap: 0, fc: 0, clear: 0, unplayed: 0 };
                }

                data[key].total++;
                const status = userPlay[diff];
                if (status === "full_perfect") data[key].ap++;
                else if (status === "full_combo") data[key].fc++;
                else if (status === "clear") data[key].clear++;
                else data[key].unplayed++;
            });
        });

        return Object.values(data).sort((a, b) => a.sortVal - b.sortVal);
    }, [songs, userScoresMap, distDiffs, distMinLevelInput, distMaxLevelInput, distMinConstInput, distMaxConstInput]);

    const filteredDifficultyData = useMemo(() => {
        const diffNames = {
            easy: "EASY",
            normal: "NORMAL",
            hard: "HARD",
            expert: "EXPERT",
            master: "MASTER",
            append: "APPEND",
        };

        const data = [];
        const minConstVal = distMinConstInput === "" ? 0.0 : parseFloat(distMinConstInput);
        const maxConstVal = distMaxConstInput === "" ? 100.0 : parseFloat(distMaxConstInput);
        const minLvlVal = distMinLevelInput === "" ? 0 : parseInt(distMinLevelInput);
        const maxLvlVal = distMaxLevelInput === "" ? 100 : parseInt(distMaxLevelInput);

        distDiffs.forEach((diff) => {
            const item = {
                label: diffNames[diff] || diff.toUpperCase(),
                diff,
                total: 0,
                ap: 0,
                fc: 0,
                clear: 0,
                unplayed: 0,
            };
            songs.forEach((song) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const constant = getConstant(song, diff, "clear");
                if (constant < minConstVal || constant > maxConstVal) return;

                const userPlay = userScoresMap.get(String(song.id)) || {};
                item.total++;
                const status = userPlay[diff];
                if (status === "full_perfect") item.ap++;
                else if (status === "full_combo") item.fc++;
                else if (status === "clear") item.clear++;
                else item.unplayed++;
            });
            if (item.total > 0) {
                data.push(item);
            }
        });

        return data;
    }, [songs, userScoresMap, distDiffs, distMinLevelInput, distMaxLevelInput, distMinConstInput, distMaxConstInput]);

    const filteredUnitData = useMemo(() => {
        const unitNames = {
            VS: "버추얼 싱어",
            "L/n": "레오니",
            MMJ: "모모점",
            VBS: "비배스",
            WxS: "원더쇼",
            N25: "니고",
            Oth: "기타",
        };

        const dataMap = {};
        const minConstVal = distMinConstInput === "" ? 0.0 : parseFloat(distMinConstInput);
        const maxConstVal = distMaxConstInput === "" ? 100.0 : parseFloat(distMaxConstInput);
        const minLvlVal = distMinLevelInput === "" ? 0 : parseInt(distMinLevelInput);
        const maxLvlVal = distMaxLevelInput === "" ? 100 : parseInt(distMaxLevelInput);

        songs.forEach((song) => {
            const unit = song.unit_code || "Oth";
            distDiffs.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const constant = getConstant(song, diff, "clear");
                if (constant < minConstVal || constant > maxConstVal) return;

                if (!dataMap[unit]) {
                    dataMap[unit] = {
                        unit,
                        label: unitNames[unit] || unit,
                        total: 0,
                        ap: 0,
                        fc: 0,
                        clear: 0,
                        unplayed: 0,
                    };
                }

                const userPlay = userScoresMap.get(String(song.id)) || {};
                dataMap[unit].total++;
                const status = userPlay[diff];
                if (status === "full_perfect") dataMap[unit].ap++;
                else if (status === "full_combo") dataMap[unit].fc++;
                else if (status === "clear") dataMap[unit].clear++;
                else dataMap[unit].unplayed++;
            });
        });

        const order = ["VS", "L/n", "MMJ", "VBS", "WxS", "N25", "Oth"];
        return Object.values(dataMap).sort((a, b) => {
            const idxA = order.indexOf(a.unit);
            const idxB = order.indexOf(b.unit);
            const valA = idxA === -1 ? 999 : idxA;
            const valB = idxB === -1 ? 999 : idxB;
            return valA - valB;
        });
    }, [songs, userScoresMap, distDiffs, distMinLevelInput, distMaxLevelInput, distMinConstInput, distMaxConstInput]);

    const distChartData = useMemo(() => {
        if (distTab === "level") return filteredLevelData;
        if (distTab === "constant") return filteredConstantData;
        if (distTab === "diff") return filteredDifficultyData;
        if (distTab === "unit") return filteredUnitData;
        return [];
    }, [distTab, filteredLevelData, filteredConstantData, filteredDifficultyData, filteredUnitData]);

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
                        <BarChart3 size={22} style={{ color: "var(--color-cyan)" }} /> 분포
                    </h2>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsDistFilterExpanded(!isDistFilterExpanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.85rem",
                            padding: "0.35rem 0.6rem",
                        }}
                    >
                        <Filter size={14} /> {isDistFilterExpanded ? "필터 접기" : "필터 펼치기"}
                    </button>
                </div>
            </div>

            {/* SUB-TABS HEADER FOR DISTRIBUTION TYPES */}
            <div className="tabs-header" style={{ marginBottom: "1.5rem" }}>
                <button
                    className={`tab-btn ${distTab === "level" ? "active" : ""}`}
                    onClick={() => setDistTab("level")}
                >
                    레벨별 성과 분포
                </button>
                <button
                    className={`tab-btn ${distTab === "constant" ? "active" : ""}`}
                    onClick={() => setDistTab("constant")}
                >
                    상수별 성과 분포
                </button>
                <button
                    className={`tab-btn ${distTab === "diff" ? "active" : ""}`}
                    onClick={() => setDistTab("diff")}
                >
                    난이도별 성과 분포
                </button>
                <button
                    className={`tab-btn ${distTab === "unit" ? "active" : ""}`}
                    onClick={() => setDistTab("unit")}
                >
                    유닛별 성과 분포
                </button>
            </div>

            {/* DETAILED FILTER PANELS */}
            {isDistFilterExpanded && (
                <div className="table-filters-expanded" style={{ marginBottom: "2rem" }}>
                    {/* Row 1: Level range, Constant range, Display type */}
                    <div className="filters-row distributions-filters-grid">
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
                                    value={distMinLevelInput}
                                    onChange={(e) => setDistMinLevelInput(e.target.value)}
                                />
                                <span>~</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="form-control"
                                    placeholder="최대"
                                    style={{ width: "100%" }}
                                    value={distMaxLevelInput}
                                    onChange={(e) => setDistMaxLevelInput(e.target.value)}
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
                                    value={distMinConstInput}
                                    onChange={(e) => setDistMinConstInput(e.target.value)}
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
                                    value={distMaxConstInput}
                                    onChange={(e) => setDistMaxConstInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">표시 형식</label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    className={`btn btn-outline ${distDisplayType === "count" ? "active" : ""}`}
                                    style={{ flex: 1, padding: "0.45rem" }}
                                    onClick={() => setDistDisplayType("count")}
                                >
                                    곡 개수
                                </button>
                                <button
                                    className={`btn btn-outline ${distDisplayType === "percent" ? "active" : ""}`}
                                    style={{ flex: 1, padding: "0.45rem" }}
                                    onClick={() => setDistDisplayType("percent")}
                                >
                                    비율
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Difficulty Checkboxes */}
                    <div className="filter-group" style={{ marginTop: "1rem" }}>
                        <label className="filter-label">포함할 난이도</label>
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
                                const isActive = distDiffs.includes(diff);
                                return (
                                    <label
                                        key={diff}
                                        className={`checkbox-label ${isActive ? `active-${diff}` : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => handleDistDiffFilterToggle(diff)}
                                        />
                                        {diffNames[diff]}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* STATS OVERVIEW CARDS */}
            {statsOverview.total > 0 ? (
                <div className="distribution-summary-cards">
                    {/* 1. 총 대상 차트 수 */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            borderLeft: "3px solid var(--color-cyan)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                            }}
                        >
                            총 대상 차트 수
                        </span>
                        <span
                            style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--text-primary)" }}
                        >
                            {statsOverview.total}개
                        </span>
                    </div>
                    {/* 2. 최고 FC 레벨 */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            borderLeft: "3px solid var(--color-fc)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                            }}
                        >
                            최고 FC 레벨
                        </span>
                        <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--color-fc)" }}>
                            {statsOverview.maxFcLvl !== "-" ? `Lv.${statsOverview.maxFcLvl}` : "-"}
                        </span>
                    </div>
                    {/* 3. 최고 AP 레벨 */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            borderLeft: "3px solid var(--color-ap)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                            }}
                        >
                            최고 AP 레벨
                        </span>
                        <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--color-ap)" }}>
                            {statsOverview.maxApLvl !== "-" ? `Lv.${statsOverview.maxApLvl}` : "-"}
                        </span>
                    </div>
                    {/* 4. AP 수 */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            borderLeft: "3px solid var(--color-ap)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                            }}
                        >
                            AP
                        </span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.15rem",
                                marginTop: "0.1rem",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: "1.4rem",
                                    fontWeight: "800",
                                    color: "var(--color-ap)",
                                    lineHeight: "1",
                                }}
                            >
                                {statsOverview.ap}개
                            </span>
                            <span
                                style={{
                                    fontSize: "0.85rem",
                                    fontWeight: "600",
                                    color: "var(--text-muted)",
                                    lineHeight: "1",
                                }}
                            >
                                (
                                {statsOverview.total > 0
                                    ? Math.round((statsOverview.ap / statsOverview.total) * 100)
                                    : 0}
                                %)
                            </span>
                        </div>
                    </div>
                    {/* 5. FC 수 */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            borderLeft: "3px solid var(--color-fc)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                            }}
                        >
                            FC
                        </span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.15rem",
                                marginTop: "0.1rem",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: "1.4rem",
                                    fontWeight: "800",
                                    color: "var(--color-fc)",
                                    lineHeight: "1",
                                }}
                            >
                                {statsOverview.fc}개
                            </span>
                            <span
                                style={{
                                    fontSize: "0.85rem",
                                    fontWeight: "600",
                                    color: "var(--text-muted)",
                                    lineHeight: "1",
                                }}
                            >
                                (
                                {statsOverview.total > 0
                                    ? Math.round((statsOverview.fc / statsOverview.total) * 100)
                                    : 0}
                                %)
                            </span>
                        </div>
                    </div>
                    {/* 6. C 수 */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            borderLeft: "3px solid var(--color-clear)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                            }}
                        >
                            C
                        </span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.15rem",
                                marginTop: "0.1rem",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: "1.4rem",
                                    fontWeight: "800",
                                    color: "var(--color-clear)",
                                    lineHeight: "1",
                                }}
                            >
                                {statsOverview.clr}개
                            </span>
                            <span
                                style={{
                                    fontSize: "0.85rem",
                                    fontWeight: "600",
                                    color: "var(--text-muted)",
                                    lineHeight: "1",
                                }}
                            >
                                (
                                {statsOverview.total > 0
                                    ? Math.round((statsOverview.clr / statsOverview.total) * 100)
                                    : 0}
                                %)
                            </span>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* CHART VISUALIZATION AREA */}
            <div
                className="glass-panel"
                style={{
                    padding: "2rem",
                    background: "rgba(10, 15, 30, 0.4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                }}
            >
                <DistributionChart data={distChartData} displayType={distDisplayType} distTab={distTab} />

                {/* LEGEND SECTION */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "2rem",
                        flexWrap: "wrap",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: "1rem",
                        fontSize: "0.9rem",
                        fontWeight: "700",
                    }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                            style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                background: "var(--color-ap)",
                            }}
                        ></span>
                        AP
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                            style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                background: "var(--color-fc)",
                            }}
                        ></span>
                        FC
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                            style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                background: "var(--color-clear)",
                            }}
                        ></span>
                        C
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                            style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                background: "rgba(255, 255, 255, 0.08)",
                            }}
                        ></span>
                        NC
                    </span>
                </div>
            </div>
        </section>
    );
}

const DistributionChart = ({ data, displayType, distTab }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [hovered, setHovered] = useState(null); // { x, y, item, index, placement }

    if (!data || data.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-muted)", fontSize: "1.1rem" }}>
                조건에 합치하는 데이터가 없습니다. 필터를 조정해 보세요.
            </div>
        );
    }

    const svgWidth = 1000;
    const svgHeight = 450;
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };

    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;
    const chartBottom = svgHeight - padding.bottom;

    // Find max total for count display
    const maxTotal = Math.max(...data.map((d) => d.total), 1);

    // Calculate values for y-axis ticks
    const yTicks = [0, 0.25, 0.5, 0.75, 1];

    // Calculate bar layouts
    const n = data.length;
    const spacing = n > 20 ? 8 : n > 12 ? 14 : 24;
    const barWidth = (chartWidth - spacing * (n - 1)) / n;

    // Mouse interaction helper
    const handleMouseMove = (e, item, index) => {
        if (!svgRef.current || !containerRef.current) return;

        // Calculate absolute position on screen
        const clientX = e.clientX;
        const clientY = e.clientY;

        // Calculate position relative to outermost container
        const containerRect = containerRef.current.getBoundingClientRect();

        const tooltipWidth = 220;
        const tooltipHeight = 185;

        let placement = "top";
        let tooltipX = clientX - containerRect.left + 15;

        // Prevent overflowing screen width
        if (clientX + tooltipWidth + 20 > window.innerWidth) {
            tooltipX = clientX - containerRect.left - tooltipWidth - 15;
        }

        let tooltipY = clientY - containerRect.top - 10;
        // Prevent overflowing top screen height
        if (clientY - tooltipHeight - 10 < 0) {
            tooltipY = clientY - containerRect.top + 15;
            placement = "bottom";
        }

        setHovered({
            x: tooltipX,
            y: tooltipY,
            placement,
            item,
            index,
        });
    };

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <div className="chart-scroll-container dist-chart-container" style={{ position: "relative" }}>
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    width="100%"
                    height="100%"
                    style={{ overflow: "visible" }}
                >
                    <defs>
                        <linearGradient id="apGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                        <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c084fc" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                        <linearGradient id="clearGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                        <linearGradient id="unplayGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
                            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {yTicks.map((t) => {
                        const y = chartBottom - t * chartHeight;
                        const valueLabel =
                            displayType === "percent" ? `${Math.round(t * 100)}%` : `${Math.round(t * maxTotal)}`;

                        return (
                            <g key={t} opacity={0.65}>
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={svgWidth - padding.right}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={padding.left - 10}
                                    y={y + 4}
                                    fill="var(--text-secondary)"
                                    fontSize="12"
                                    fontWeight="600"
                                    textAnchor="end"
                                >
                                    {valueLabel}
                                </text>
                            </g>
                        );
                    })}

                    {/* Bars */}
                    {data.map((d, i) => {
                        const x = padding.left + i * (barWidth + spacing);

                        // Stacked heights
                        let h_ap, h_fc, h_clear, h_unplay;
                        if (displayType === "percent") {
                            h_ap = (d.ap / d.total) * chartHeight;
                            h_fc = (d.fc / d.total) * chartHeight;
                            h_clear = (d.clear / d.total) * chartHeight;
                            h_unplay = (d.unplayed / d.total) * chartHeight;
                        } else {
                            h_ap = (d.ap / maxTotal) * chartHeight;
                            h_fc = (d.fc / maxTotal) * chartHeight;
                            h_clear = (d.clear / maxTotal) * chartHeight;
                            h_unplay = (d.unplayed / maxTotal) * chartHeight;
                        }

                        // y positions
                        const y_unplay = chartBottom - h_unplay;
                        const y_clear = y_unplay - h_clear;
                        const y_fc = y_clear - h_fc;
                        const y_ap = y_fc - h_ap;

                        const isHovered = hovered && hovered.index === i;

                        return (
                            <g
                                key={d.label}
                                onMouseMove={(e) => handleMouseMove(e, d, i)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: "pointer" }}
                            >
                                {/* Background Rect for easy hovering */}
                                <rect
                                    x={x - spacing / 2}
                                    y={padding.top}
                                    width={barWidth + spacing}
                                    height={chartHeight}
                                    fill="transparent"
                                />

                                {/* Stacked rects */}
                                {h_unplay > 0 && (
                                    <rect
                                        x={x}
                                        y={y_unplay}
                                        width={barWidth}
                                        height={h_unplay}
                                        fill="url(#unplayGrad)"
                                        rx={h_clear === 0 && h_fc === 0 && h_ap === 0 ? 3 : 0}
                                        style={{ transition: "all 0.3s ease" }}
                                        opacity={isHovered ? 1 : 0.8}
                                    />
                                )}
                                {h_clear > 0 && (
                                    <rect
                                        x={x}
                                        y={y_clear}
                                        width={barWidth}
                                        height={h_clear}
                                        fill="url(#clearGrad)"
                                        rx={h_fc === 0 && h_ap === 0 ? 3 : 0}
                                        style={{ transition: "all 0.3s ease" }}
                                        opacity={isHovered ? 1 : 0.85}
                                    />
                                )}
                                {h_fc > 0 && (
                                    <rect
                                        x={x}
                                        y={y_fc}
                                        width={barWidth}
                                        height={h_fc}
                                        fill="url(#fcGrad)"
                                        rx={h_ap === 0 ? 3 : 0}
                                        style={{ transition: "all 0.3s ease" }}
                                        opacity={isHovered ? 1 : 0.85}
                                    />
                                )}
                                {h_ap > 0 && (
                                    <rect
                                        x={x}
                                        y={y_ap}
                                        width={barWidth}
                                        height={h_ap}
                                        fill="url(#apGrad)"
                                        rx={3}
                                        style={{ transition: "all 0.3s ease" }}
                                        opacity={isHovered ? 1 : 0.85}
                                    />
                                )}

                                {/* X-axis Label */}
                                <text
                                    x={x + barWidth / 2}
                                    y={chartBottom + 20}
                                    fill={isHovered ? "var(--color-cyan)" : "var(--text-secondary)"}
                                    fontSize={n > 20 ? "10" : "12"}
                                    fontWeight="700"
                                    textAnchor="middle"
                                    transform={n > 15 ? `rotate(-25, ${x + barWidth / 2}, ${chartBottom + 20})` : ""}
                                    style={{ transition: "fill 0.2s ease" }}
                                >
                                    {d.label}
                                </text>

                                {/* Top Total Count (only in count mode and if wide enough) */}
                                {displayType === "count" && barWidth > 18 && d.total > 0 && (
                                    <text
                                        x={x + barWidth / 2}
                                        y={y_ap - 6}
                                        fill="var(--text-primary)"
                                        fontSize="10"
                                        fontWeight="700"
                                        textAnchor="middle"
                                        opacity={isHovered ? 1 : 0.6}
                                    >
                                        {d.total}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* X Axis Line */}
                    <line
                        x1={padding.left}
                        y1={chartBottom}
                        x2={svgWidth - padding.right}
                        y2={chartBottom}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1.5"
                    />
                </svg>
            </div>

            {/* TOOLTIP */}
            {hovered && (
                <div
                    className="glass-panel"
                    style={{
                        position: "absolute",
                        left: `${hovered.x}px`,
                        top: `${hovered.y}px`,
                        pointerEvents: "none",
                        zIndex: 100,
                        padding: "1rem",
                        minWidth: "220px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(10, 15, 30, 0.95)",
                        borderRadius: "12px",
                        transform: hovered.placement === "bottom" ? "none" : "translateY(-100%)",
                        transition: "left 0.1s ease, top 0.1s ease",
                    }}
                >
                    <div
                        style={{
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            color: "var(--color-cyan)",
                            marginBottom: "0.5rem",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                            paddingBottom: "0.25rem",
                        }}
                    >
                        {hovered.item.label}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                            marginBottom: "0.4rem",
                            fontWeight: "700",
                        }}
                    >
                        <span style={{ color: "var(--text-secondary)" }}>총 대상 차트</span>
                        <span>{hovered.item.total}개</span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            color: "var(--color-ap)",
                            marginBottom: "0.3rem",
                        }}
                    >
                        <span>● AP</span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                lineHeight: 1.1,
                            }}
                        >
                            <span style={{ fontWeight: "700" }}>{hovered.item.ap}개</span>
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                                {hovered.item.total > 0 ? Math.round((hovered.item.ap / hovered.item.total) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            color: "var(--color-fc)",
                            marginBottom: "0.3rem",
                        }}
                    >
                        <span>● FC</span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                lineHeight: 1.1,
                            }}
                        >
                            <span style={{ fontWeight: "700" }}>{hovered.item.fc}개</span>
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                                {hovered.item.total > 0 ? Math.round((hovered.item.fc / hovered.item.total) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            color: "var(--color-clear)",
                            marginBottom: "0.3rem",
                        }}
                    >
                        <span>● C</span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                lineHeight: 1.1,
                            }}
                        >
                            <span style={{ fontWeight: "700" }}>{hovered.item.clear}개</span>
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                                {hovered.item.total > 0
                                    ? Math.round((hovered.item.clear / hovered.item.total) * 100)
                                    : 0}
                                %
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            color: "var(--text-muted)",
                        }}
                    >
                        <span>● NC</span>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                lineHeight: 1.1,
                            }}
                        >
                            <span style={{ fontWeight: "700" }}>{hovered.item.unplayed}개</span>
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                                {hovered.item.total > 0
                                    ? Math.round((hovered.item.unplayed / hovered.item.total) * 100)
                                    : 0}
                                %
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
