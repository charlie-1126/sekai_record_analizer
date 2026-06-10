import React, { useState, useMemo } from "react";
import { Calculator as CalcIcon, Search } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { calculateRating, getConstant } from "../../utils/ratingUtils";

export const Calculator = ({
    songs,
    playerRating,
    playerAppendRating,
    b39List,
    appendB15List,
    allRatings,
    appendRatings,
    settingsTitleLang,
}) => {
    // --- States ---
    const [calcSongSearch, setCalcSongSearch] = useState("");
    const [calcSelectedSong, setCalcSelectedSong] = useState(null);
    const [calcDiff, setCalcDiff] = useState("master");
    const [calcGoal, setCalcGoal] = useState("full_perfect");
    const [showCalcDropdown, setShowCalcDropdown] = useState(false);

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

    return (
        <section className="glass-panel calculator-panel">
            <h2 className="section-title" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
                <CalcIcon size={22} style={{ color: "var(--color-cyan)" }} /> Music R 계산기
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
                                            <option value="easy">
                                                EASY ({calcSelectedSong.levels.easy})
                                            </option>
                                        )}
                                        {calcSelectedSong.levels.normal && (
                                            <option value="normal">
                                                NORMAL ({calcSelectedSong.levels.normal})
                                            </option>
                                        )}
                                        {calcSelectedSong.levels.hard && (
                                            <option value="hard">
                                                HARD ({calcSelectedSong.levels.hard})
                                            </option>
                                        )}
                                        {calcSelectedSong.levels.expert && (
                                            <option value="expert">
                                                EXPERT ({calcSelectedSong.levels.expert})
                                            </option>
                                        )}
                                        {calcSelectedSong.levels.master && (
                                            <option value="master">
                                                MASTER ({calcSelectedSong.levels.master})
                                            </option>
                                        )}
                                        {calcSelectedSong.levels.append && (
                                            <option value="append">
                                                APPEND ({calcSelectedSong.levels.append})
                                            </option>
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
                                        <option value="full_perfect">AP [8.0]</option>
                                        <option value="full_combo">FC [7.5]</option>
                                        <option value="clear">Clear [5.0]</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT COLUMN: Results and simulations */}
                <div>
                    {calcSelectedSong ? (
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
                                    style={{
                                        color: calcResult.isAppend ? "var(--color-append)" : "inherit",
                                    }}
                                >
                                    {calcResult.rating} 점
                                </div>

                                <div
                                    style={{
                                        margin: "0.75rem 0",
                                        borderTop: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                ></div>

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
