import React, { useState, useMemo, useEffect } from "react";
import { Calculator as CalcIcon, Search, Sparkles } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { calculateRating, getConstant } from "../../utils/ratingUtils";
import { calculateSongPotential, computePotentialRating, isNewSong } from "../../utils/potentialUtils";

export const Calculator = ({
    songs,
    playerRating,
    playerAppendRating,
    b39List,
    appendB15List,
    allRatings,
    appendRatings,
    settingsTitleLang,
    ratingMode = "b39",
    potentialData,
    userScoresMap,
    initialTarget,
    clearInitialTarget,
}) => {
    // --- States ---
    const [calcSongSearch, setCalcSongSearch] = useState("");
    const [calcSelectedSong, setCalcSelectedSong] = useState(null);
    const [calcDiff, setCalcDiff] = useState("master");
    const [calcGoal, setCalcGoal] = useState("full_perfect");
    const [showCalcDropdown, setShowCalcDropdown] = useState(false);

    useEffect(() => {
        if (ratingMode === "potential" && calcGoal === "clear") {
            setCalcGoal("full_combo");
        }
    }, [ratingMode, calcGoal]);

    useEffect(() => {
        if (initialTarget && initialTarget.song) {
            const { song, diff } = initialTarget;
            setCalcSelectedSong(song);
            setCalcSongSearch(getSongTitle(song));
            setCalcDiff(diff || "master");
            setShowCalcDropdown(false);
            if (clearInitialTarget) {
                clearInitialTarget();
            }
        }
    }, [initialTarget, clearInitialTarget]);

    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    // --- Search Autocomplete Suggestions ---
    const calculatorSuggestions = useMemo(() => {
        if (calcSongSearch.trim() === "" || calcSelectedSong) return [];
        const query = calcSongSearch.toLowerCase();
        return songs
            .filter((song) => {
                return (
                    (song.title_ko || "").toLowerCase().includes(query) ||
                    (song.title_jp || "").toLowerCase().includes(query) ||
                    (song.title_hangul || "").toLowerCase().includes(query) ||
                    (song.composer || "").toLowerCase().includes(query)
                );
            })
            .slice(0, 5);
    }, [calcSongSearch, calcSelectedSong, songs]);

    const selectCalcSong = (song) => {
        setCalcSelectedSong(song);
        setCalcSongSearch(getSongTitle(song));
        setShowCalcDropdown(false);

        const availableDiffs = ["master", "expert", "append", "hard", "normal", "easy"];
        for (const d of availableDiffs) {
            if (song.levels[d]) {
                setCalcDiff(d);
                break;
            }
        }
    };

    // --- Result calculation ---
    const calcResult = useMemo(() => {
        if (!calcSelectedSong) return null;

        const hasLevel = calcSelectedSong.levels[calcDiff];
        if (!hasLevel) return { valid: false, message: "해당 난이도가 없는 곡입니다." };

        const rating = calculateRating(calcSelectedSong, calcDiff, calcGoal);
        const constant = getConstant(calcSelectedSong, calcDiff, calcGoal);

        const targetB39 = b39List;
        const lastB39Rating = targetB39.length === 39 ? targetB39[38].rating : 0;

        let willEnter = false;
        let netGain = 0;
        let newPlayerRating = playerRating;
        let estimatedRank = 1;

        if (calcDiff === "append") {
            const newAppendRatings = [...appendRatings];
            const exactIdx = newAppendRatings.findIndex(
                (r) => r.song.id === calcSelectedSong.id && r.diff === "append",
            );

            const newHypotheticalRecord = {
                song: calcSelectedSong,
                diff: "append",
                status: calcGoal,
                level: calcSelectedSong.levels.append,
                constant,
                rating,
            };

            if (exactIdx !== -1) newAppendRatings[exactIdx] = newHypotheticalRecord;
            else newAppendRatings.push(newHypotheticalRecord);

            newAppendRatings.sort((a, b) => b.rating - a.rating);
            const newB15 = newAppendRatings.slice(0, 15);
            const newSum = Math.round(newB15.reduce((acc, curr) => acc + curr.rating, 0) * 2.6);
            const b15Index = newB15.findIndex((r) => r.song.id === calcSelectedSong.id);

            if (b15Index !== -1 && b15Index < 15) {
                willEnter = true;
                estimatedRank = b15Index + 1;
                netGain = Math.round(newSum - playerAppendRating);
                newPlayerRating = newSum;
            }

            return {
                valid: true,
                rating,
                constant,
                willEnter,
                estimatedRank,
                netGain,
                newPlayerRating,
                lastB39Rating: appendB15List.length === 15 ? appendB15List[14].rating : 0,
                isAppend: true,
            };
        } else {
            const newAllRatings = [...allRatings];
            const exactRecordIdx = newAllRatings.findIndex(
                (r) => r.song.id === calcSelectedSong.id && r.diff === calcDiff,
            );

            const newHypotheticalRecord = {
                song: calcSelectedSong,
                diff: calcDiff,
                status: calcGoal,
                level: calcSelectedSong.levels[calcDiff],
                constant,
                rating,
            };

            if (exactRecordIdx !== -1) newAllRatings[exactRecordIdx] = newHypotheticalRecord;
            else newAllRatings.push(newHypotheticalRecord);

            newAllRatings.sort((a, b) => b.rating - a.rating);
            const newB39 = newAllRatings.slice(0, 39);
            const newSum = Math.round(newB39.reduce((acc, curr) => acc + curr.rating, 0));

            const b39Index = newB39.findIndex((r) => r.song.id === calcSelectedSong.id && r.diff === calcDiff);

            if (b39Index !== -1 && b39Index < 39) {
                willEnter = true;
                estimatedRank = b39Index + 1;
                netGain = Math.round(newSum - playerRating);
                newPlayerRating = newSum;
            }

            return {
                valid: true,
                rating,
                constant,
                willEnter,
                estimatedRank,
                netGain,
                newPlayerRating,
                lastB39Rating,
                isAppend: false,
            };
        }
    }, [
        calcSelectedSong,
        calcDiff,
        calcGoal,
        b39List,
        playerRating,
        allRatings,
        appendRatings,
        playerAppendRating,
        appendB15List,
    ]);

    // --- Potential Result calculation ---
    const potentialCalcResult = useMemo(() => {
        if (!calcSelectedSong || ratingMode !== "potential" || !potentialData || !userScoresMap) return null;

        const hasLevel = calcSelectedSong.levels[calcDiff];
        if (!hasLevel) return { valid: false, message: "해당 난이도가 없는 곡입니다." };

        const newPotential = calculateSongPotential(calcSelectedSong, calcDiff, calcGoal);
        if (newPotential <= 0) return { valid: false, message: "이 설정은 Potential이 0 이하입니다." };

        const constant = getConstant(calcSelectedSong, calcDiff, calcGoal);
        const songIsNew = isNewSong(calcSelectedSong);

        // Simulate adding this song to the appropriate list
        // Build a modified userScoresMap
        const simMap = new Map(userScoresMap);
        const existingSong = simMap.get(String(calcSelectedSong.id)) || {};
        simMap.set(String(calcSelectedSong.id), { ...existingSong, [calcDiff]: calcGoal });

        const simResult = computePotentialRating(songs, simMap);
        const newPotential4 = simResult.potential4;
        const newPotential2 = simResult.potential2;
        const gain4 = newPotential4 - potentialData.potential4;
        const gain2 = newPotential2 - potentialData.potential2;

        // Find rank in new list
        const combinedNew = [...simResult.oldBest30, ...simResult.newBest10];
        const myIdx = combinedNew.findIndex((e) => e.song.id === calcSelectedSong.id && e.diff === calcDiff);
        const inNewBest10 = simResult.newBest10.some((e) => e.song.id === calcSelectedSong.id && e.diff === calcDiff);
        const inOldBest30 = simResult.oldBest30.some((e) => e.song.id === calcSelectedSong.id && e.diff === calcDiff);

        const cutOld = potentialData.oldBest30.length === 30 ? potentialData.oldBest30[29].potential : null;
        const cutNew = potentialData.newBest10.length === 10 ? potentialData.newBest10[9].potential : null;
        const relevantCut = songIsNew ? cutNew : cutOld;
        const willEnter = songIsNew ? inNewBest10 : inOldBest30;

        const rankInList = (songIsNew ? simResult.newBest10 : simResult.oldBest30).findIndex(
            (e) => e.song.id === calcSelectedSong.id && e.diff === calcDiff,
        );
        const estimatedRank = rankInList !== -1 ? rankInList + 1 : null;

        return {
            valid: true,
            newPotential,
            constant,
            songIsNew,
            willEnter,
            estimatedRank,
            newPotential4,
            newPotential2,
            gain4,
            gain2,
            cutLine: relevantCut,
            listType: songIsNew ? "New Best 10" : "Old Best 30",
        };
    }, [calcSelectedSong, calcDiff, calcGoal, ratingMode, potentialData, userScoresMap, songs]);

    return (
        <section className="glass-panel calculator-panel">
            <h2 className="section-title" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
                {ratingMode === "potential" ? (
                    <>
                        <CalcIcon size={22} style={{ color: "#c77dff" }} />
                        <span
                            style={{
                                background: "linear-gradient(135deg, #c77dff, #87ceeb)",
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Potential 계산기
                        </span>
                    </>
                ) : (
                    <>
                        <CalcIcon size={22} style={{ color: "var(--color-cyan)" }} /> Music R 계산기
                    </>
                )}
            </h2>

            <div className="calc-container-layout">
                {/* LEFT COLUMN: Search & Settings */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div className="filter-group autocomplete-container">
                        <label className="filter-label" style={{ fontWeight: 700 }}>
                            곡 검색
                        </label>
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
                                placeholder="곡 이름을 검색하세요..."
                                style={{ paddingLeft: "2.5rem", width: "100%" }}
                                value={calcSongSearch}
                                onChange={(e) => {
                                    setCalcSongSearch(e.target.value);
                                    setCalcSelectedSong(null);
                                    setShowCalcDropdown(true);
                                }}
                                onFocus={() => setShowCalcDropdown(true)}
                            />
                        </div>

                        {showCalcDropdown && calculatorSuggestions.length > 0 && (
                            <div className="autocomplete-dropdown">
                                {calculatorSuggestions.map((song) => (
                                    <div
                                        key={song.id}
                                        className="autocomplete-item"
                                        onClick={() => selectCalcSong(song)}
                                        style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
                                    >
                                        <JacketImage songId={song.id} size={30} />
                                        <span style={{ fontWeight: "600" }}>{getSongTitle(song)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {calcSelectedSong && (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "1rem",
                                    alignItems: "center",
                                    padding: "1rem",
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "8px",
                                }}
                            >
                                <JacketImage songId={calcSelectedSong.id} size={64} />
                                <div>
                                    <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>
                                        {getSongTitle(calcSelectedSong)}
                                    </h3>
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                        {calcSelectedSong.composer}
                                    </p>
                                </div>
                            </div>

                            <div className="stat-grid-half">
                                <div className="filter-group">
                                    <label className="filter-label">난이도</label>
                                    <select
                                        className="form-control"
                                        value={calcDiff}
                                        onChange={(e) => setCalcDiff(e.target.value)}
                                    >
                                        {calcSelectedSong.levels.easy && (
                                            <option value="easy">EASY ({calcSelectedSong.levels.easy})</option>
                                        )}
                                        {calcSelectedSong.levels.normal && (
                                            <option value="normal">NORMAL ({calcSelectedSong.levels.normal})</option>
                                        )}
                                        {calcSelectedSong.levels.hard && (
                                            <option value="hard">HARD ({calcSelectedSong.levels.hard})</option>
                                        )}
                                        {calcSelectedSong.levels.expert && (
                                            <option value="expert">EXPERT ({calcSelectedSong.levels.expert})</option>
                                        )}
                                        {calcSelectedSong.levels.master && (
                                            <option value="master">MASTER ({calcSelectedSong.levels.master})</option>
                                        )}
                                        {calcSelectedSong.levels.append && (
                                            <option value="append">APPEND ({calcSelectedSong.levels.append})</option>
                                        )}
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label className="filter-label">목표 성과</label>
                                    <select
                                        className="form-control"
                                        value={calcGoal}
                                        onChange={(e) => setCalcGoal(e.target.value)}
                                    >
                                        {ratingMode === "potential" ? (
                                            <>
                                                <option value="full_perfect">AP [보면상수 + 2.0]</option>
                                                <option value="full_combo">FC [보면상수 + 0.0]</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="full_perfect">AP [보면상수 * 8.0]</option>
                                                <option value="full_combo">FC [보면상수 * 7.5]</option>
                                                <option value="clear">Clear [보면상수 * 5.0]</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT COLUMN: Results and simulations */}
                <div>
                    {calcSelectedSong ? (
                        ratingMode === "potential" ? (
                            potentialCalcResult && potentialCalcResult.valid ? (
                                <div className="calc-result-box glow-potential">
                                    <div
                                        style={{
                                            textAlign: "center",
                                            fontSize: "0.85rem",
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        Potential
                                    </div>
                                    <div
                                        className="calc-rating-large"
                                        style={{
                                            background: "linear-gradient(135deg, #c77dff, #87ceeb)",
                                            WebkitBackgroundClip: "text",
                                            backgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        {potentialCalcResult.newPotential.toFixed(1)}
                                    </div>
                                    <div
                                        style={{ margin: "0.75rem 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                                    />
                                    {potentialCalcResult.willEnter ? (
                                        <div
                                            className="calc-compare-badge calc-compare-enter"
                                            style={{
                                                whiteSpace: "pre-line",
                                                fontFamily: "monospace",
                                                fontSize: "0.85rem",
                                                padding: "1rem",
                                                lineHeight: "1.6",
                                                textAlign: "left",
                                            }}
                                        >
                                            {potentialCalcResult.songIsNew ? "NB" : "OB"} #
                                            {potentialCalcResult.estimatedRank}
                                            {"\n"}
                                            Potential: {potentialCalcResult.newPotential2.toFixed(2)} (
                                            {potentialCalcResult.gain2 >= 0 ? "+" : ""}
                                            {potentialCalcResult.gain2.toFixed(2)})
                                        </div>
                                    ) : (
                                        <div
                                            className="calc-compare-badge calc-compare-fail"
                                            style={{
                                                whiteSpace: "pre-line",
                                                fontFamily: "monospace",
                                                fontSize: "0.85rem",
                                                padding: "1rem",
                                                lineHeight: "1.6",
                                                textAlign: "left",
                                            }}
                                        >
                                            {potentialCalcResult.songIsNew ? "NB" : "OB"} 진입 불가 (커트라인:{" "}
                                            {potentialCalcResult.cutLine !== null
                                                ? potentialCalcResult.cutLine.toFixed(1)
                                                : "없음"}
                                            ){"\n"} 현재 Potential: {potentialCalcResult.newPotential.toFixed(1)}
                                        </div>
                                    )}
                                </div>
                            ) : potentialCalcResult && !potentialCalcResult.valid ? (
                                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                                    {potentialCalcResult.message}
                                </div>
                            ) : null
                        ) : (
                            calcResult &&
                            calcResult.valid && (
                                <div className="calc-result-box glow-cyan">
                                    <div
                                        style={{
                                            textAlign: "center",
                                            fontSize: "0.85rem",
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        Music R
                                    </div>
                                    <div
                                        className="calc-rating-large"
                                        style={{ color: calcResult.isAppend ? "var(--color-append)" : "inherit" }}
                                    >
                                        {calcResult.rating}
                                    </div>
                                    <div
                                        style={{ margin: "0.75rem 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                                    />
                                    {calcResult.willEnter ? (
                                        <div
                                            className="calc-compare-badge calc-compare-enter"
                                            style={{
                                                whiteSpace: "pre-line",
                                                fontFamily: "monospace",
                                                fontSize: "0.85rem",
                                                padding: "1rem",
                                                lineHeight: "1.6",
                                                textAlign: "left",
                                            }}
                                        >
                                            {calcResult.isAppend ? "B15" : "B39"} #{calcResult.estimatedRank}
                                            {"\n"}
                                            종합 {calcResult.isAppend ? "어펜드" : "일반"} 레이팅:{" "}
                                            {calcResult.isAppend ? playerAppendRating : playerRating} →{" "}
                                            {calcResult.newPlayerRating} (
                                            {calcResult.netGain > 0 ? `+${calcResult.netGain}` : "0"})
                                        </div>
                                    ) : (
                                        <div
                                            className="calc-compare-badge calc-compare-fail"
                                            style={{
                                                whiteSpace: "pre-line",
                                                fontFamily: "monospace",
                                                fontSize: "0.85rem",
                                                padding: "1rem",
                                                lineHeight: "1.6",
                                                textAlign: "left",
                                            }}
                                        >
                                            {calcResult.isAppend ? "B15" : "B39"} 진입 불가 (커트라인:{" "}
                                            {calcResult.lastB39Rating}){"\n"}
                                            필요 점수: +{calcResult.lastB39Rating - calcResult.rating}
                                        </div>
                                    )}
                                </div>
                            )
                        )
                    ) : (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "4rem 2rem",
                                color: "var(--text-muted)",
                                border: "1px dashed var(--border-color)",
                                borderRadius: "12px",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: "220px",
                            }}
                        >
                            좌측 검색창에서 곡명을 입력하여 시뮬레이션을 시작하세요.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
