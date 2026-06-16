import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Plus, TrendingUp, XCircle, Sparkles, Filter } from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { calculateRating, getConstant, getRelativePercentages } from "../../utils/ratingUtils";
import { isNewSong, computePotentialRating, calculateSongPotential } from "../../utils/potentialUtils";
import { useSessionState } from "../../utils/useSessionState";
import { defaultSort } from "../../utils/scoreUtils";


export const Compare = ({
    currentUser,
    scores,
    songs,
    friendsList,
    fetchFriendsList,
    settingsTitleLang,
    ratingMode = "b39",
}) => {
    const navigate = useNavigate();

    // --- Friend States ---
    const [friendInputId, setFriendInputId] = useState("");
    const [friendAddError, setFriendAddError] = useState("");
    const [friendAddSuccess, setFriendAddSuccess] = useState("");

    // --- Compare States ---
    const [compareIncludeClear, setCompareIncludeClear] = useSessionState("pjsk_compare_include_clear", true);
    const [compareTargetId, setCompareTargetId] = useSessionState("pjsk_compare_target_id", "");
    const [compareData, setCompareData] = useState(null);
    const [compareError, setCompareError] = useState("");
    const [isComparing, setIsComparing] = useState(false);
    const [compareRatingType, setCompareRatingType] = useSessionState("pjsk_compare_rating_type", "player"); // "player", "append", "total"
    const [compareSearchInput, setCompareSearchInput] = useSessionState("pjsk_compare_search_input", "");
    const [compareSearch, setCompareSearch] = useSessionState("pjsk_compare_search", "");
    const [compareVisibleCount, setCompareVisibleCount] = useState(50);
    const [compareDiffFilters, setCompareDiffFilters] = useSessionState("pjsk_compare_diff_filters", [
        "easy",
        "normal",
        "hard",
        "expert",
        "master",
        "append",
    ]);
    const [compareResultFilter, setCompareResultFilter] = useSessionState("pjsk_compare_result_filter", "all"); // "all", "win", "lose", "draw"
    const [compareMinLevel, setCompareMinLevel] = useSessionState("pjsk_compare_min_level", "");
    const [compareMaxLevel, setCompareMaxLevel] = useSessionState("pjsk_compare_max_level", "");
    const [compareSortBy, setCompareSortBy] = useSessionState("pjsk_compare_sort_by", "gap"); // "level", "gap", "title", "ratingA", "ratingB"
    const [compareSortOrder, setCompareSortOrder] = useSessionState("pjsk_compare_sort_order", "desc"); // "asc", "desc"
    const [compareNewFilter, setCompareNewFilter] = useSessionState("pjsk_compare_new_filter", "all"); // "all", "new", "old"
    const [isCompareFilterExpanded, setIsCompareFilterExpanded] = useSessionState("pjsk_compare_filter_expanded", true);

    const hasAutoCompared = useRef(false);
    useEffect(() => {
        if (compareTargetId && compareTargetId.trim() && scores && scores.length > 0 && !hasAutoCompared.current) {
            hasAutoCompared.current = true;
            handleCompareSearch(null, compareTargetId);
        }
    }, [scores, compareTargetId]);

    // --- Debounce Search Term ---
    useEffect(() => {
        const handler = setTimeout(() => {
            setCompareSearch(compareSearchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [compareSearchInput]);

    // --- Reset visible count on filter changes ---
    useEffect(() => {
        setCompareVisibleCount(50);
    }, [
        compareSearch,
        compareDiffFilters,
        compareResultFilter,
        compareMinLevel,
        compareMaxLevel,
        compareSortBy,
        compareSortOrder,
        compareIncludeClear,
        compareNewFilter,
    ]);

    // --- Infinite scroll observer ---
    const compareObserver = useRef(null);
    const compareSentinelRef = useCallback((node) => {
        if (compareObserver.current) compareObserver.current.disconnect();
        compareObserver.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setCompareVisibleCount((prev) => prev + 50);
                }
            },
            { rootMargin: "200px" },
        );
        if (node) compareObserver.current.observe(node);
    }, []);

    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    // --- Add Friend ---
    const handleAddFriend = async (e) => {
        e.preventDefault();
        setFriendAddError("");
        setFriendAddSuccess("");

        if (!currentUser) {
            setFriendAddError("로그인 후 이용할 수 있습니다.");
            return;
        }

        if (!friendInputId.trim()) {
            setFriendAddError("추가할 ID를 입력해 주세요.");
            return;
        }

        try {
            const res = await fetch("/api/friends/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // [Fix H-2] Send token for requireAuth middleware
                    "Authorization": `Bearer ${currentUser.token}`,
                },
                body: JSON.stringify({
                    username: currentUser.username,
                    friendUsername: friendInputId.trim(),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setFriendAddSuccess(data.message);
                setFriendInputId("");
                fetchFriendsList(currentUser.username);
            } else {
                setFriendAddError(data.error || "친구 추가 실패");
            }
        } catch (e) {
            setFriendAddError("서버와의 통신 오류");
        }
    };

    // --- Remove Friend ---
    const handleRemoveFriend = async (friendUsername) => {
        if (!currentUser) return;
        if (!window.confirm(`${friendUsername}님을 친구 목록에서 삭제하시겠습니까?`)) return;

        try {
            const res = await fetch("/api/friends/remove", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // [Fix H-2] Send token for requireAuth middleware
                    "Authorization": `Bearer ${currentUser.token}`,
                },
                body: JSON.stringify({
                    username: currentUser.username,
                    friendUsername,
                }),
            });
            if (res.ok) {
                fetchFriendsList(currentUser.username);
            }
        } catch (e) {
            console.error("Failed to remove friend", e);
        }
    };

    // --- Fetch and set comparison data ---
    const handleCompareSearch = async (e, directTargetId) => {
        e?.preventDefault();
        setCompareError("");
        setCompareData(null);

        const targetId = directTargetId || compareTargetId;
        if (!targetId || !targetId.trim()) {
            setCompareError("비교할 상대방 ID를 입력해 주세요.");
            return;
        }

        if (directTargetId) {
            setCompareTargetId(directTargetId);
        }

        setIsComparing(true);
        try {
            const myId = currentUser ? currentUser.username : "Guest";
            const myNickname = currentUser ? currentUser.nickname : "나 (Guest)";

            const res = await fetch(`/api/scores/user/${targetId.trim()}`);
            if (!res.ok) {
                const errData = await res.json();
                setCompareError(errData.error || "상대방을 찾을 수 없습니다.");
                setIsComparing(false);
                return;
            }
            const targetData = await res.json();

            setCompareData({
                userA: {
                    username: myId,
                    nickname: myNickname,
                    scores: scores,
                },
                userB: {
                    username: targetData.username,
                    nickname: targetData.nickname,
                    scores: targetData.scores,
                },
            });
        } catch (err) {
            setCompareError("데이터 요청 중 오류가 발생했습니다.");
        } finally {
            setIsComparing(false);
        }
    };

    // --- Compute comparison results ---
    const compareResults = useMemo(() => {
        if (!compareData) return null;

        const computeUserStats = (userScores) => {
            const uScoresMap = new Map();
            userScores.forEach((s) => {
                if (s && s.id) uScoresMap.set(String(s.id), s);
            });

            const list = [];
            const appendList = [];
            songs.forEach((song) => {
                const play = uScoresMap.get(String(song.id));
                if (!play) return;

                ["easy", "normal", "hard", "expert", "master"].forEach((diff) => {
                    const status = play[diff];
                    if (status && status !== "none") {
                        const rating = ratingMode === "potential"
                            ? calculateSongPotential(song, diff, status)
                            : calculateRating(song, diff, status);
                        if (rating > 0) {
                            list.push({
                                song,
                                diff,
                                status,
                                level: song.levels[diff],
                                constant: getConstant(song, diff, status),
                                rating,
                            });
                        }
                    }
                });

                const appendStatus = play["append"];
                if (appendStatus && appendStatus !== "none") {
                    const rating = ratingMode === "potential"
                        ? calculateSongPotential(song, "append", appendStatus)
                        : calculateRating(song, "append", appendStatus);
                    if (rating > 0) {
                        appendList.push({
                            song,
                            diff: "append",
                            status: appendStatus,
                            level: song.levels["append"],
                            constant: getConstant(song, "append", appendStatus),
                            rating,
                        });
                    }
                }
            });

            const sorted = list.sort((a, b) => b.rating - a.rating);
            const b39 = sorted.slice(0, 39);
            const sum = ratingMode === "potential" ? 0 : Math.round(b39.reduce((acc, curr) => acc + curr.rating, 0));

            const appendSorted = appendList.sort((a, b) => b.rating - a.rating);
            const b15 = appendSorted.slice(0, 15);
            const appendSum = ratingMode === "potential" ? 0 : Math.round(b15.reduce((acc, curr) => acc + curr.rating, 0) * 2.6);
            const totalSum = sum + appendSum;

            let ap = 0,
                fc = 0,
                clr = 0;
            userScores.forEach((s) => {
                ["easy", "normal", "hard", "expert", "master", "append"].forEach((d) => {
                    if (s[d] === "full_perfect") ap++;
                    else if (s[d] === "full_combo") fc++;
                    else if (s[d] === "clear") clr++;
                });
            });

            const potResult = computePotentialRating(songs, uScoresMap);
            const potential = potResult.potential4;

            return { b39, sum, b15, appendSum, totalSum, ap, fc, clr, potential };
        };

        const resA = computeUserStats(compareData.userA.scores);
        const resB = computeUserStats(compareData.userB.scores);

        const mapA = new Map(compareData.userA.scores.filter((s) => s && s.id).map((s) => [String(s.id), s]));
        const mapB = new Map(compareData.userB.scores.filter((s) => s && s.id).map((s) => [String(s.id), s]));

        const commonList = [];
        songs.forEach((song) => {
            const playA = mapA.get(String(song.id));
            const playB = mapB.get(String(song.id));
            if (!playA && !playB) return;

            ["easy", "normal", "hard", "expert", "master", "append"].forEach((diff) => {
                const lvl = song.levels[diff];
                if (!lvl) return;

                const statA = playA ? playA[diff] : null;
                const statB = playB ? playB[diff] : null;

                if ((statA && statA !== "none") || (statB && statB !== "none")) {
                    commonList.push({
                        song,
                        diff,
                        level: lvl,
                        statA: statA || "none",
                        statB: statB || "none",
                        ratingA: statA ? (ratingMode === "potential" ? calculateSongPotential(song, diff, statA) : calculateRating(song, diff, statA)) : 0,
                        ratingB: statB ? (ratingMode === "potential" ? calculateSongPotential(song, diff, statB) : calculateRating(song, diff, statB)) : 0,
                    });
                }
            });
        });

        commonList.sort((a, b) => b.level - a.level);

        return { resA, resB, commonList };
    }, [compareData, songs, ratingMode]);

    // --- Filter and sort the detailed comparison rows ---
    const filteredCompareList = useMemo(() => {
        if (!compareResults) return [];

        let list = [...compareResults.commonList];

        // 1. Search filter
        if (compareSearch.trim()) {
            const query = compareSearch.toLowerCase().trim();
            list = list.filter((item) => {
                const titleKo = item.song.title_ko ? item.song.title_ko.toLowerCase() : "";
                const titleJp = item.song.title_jp ? item.song.title_jp.toLowerCase() : "";
                return titleKo.includes(query) || titleJp.includes(query);
            });
        }

        // 2. Difficulty filter
        list = list.filter((item) => compareDiffFilters.includes(item.diff));

        // 3. Level filters
        if (compareMinLevel !== "") {
            list = list.filter((item) => item.level >= parseInt(compareMinLevel, 10));
        }
        if (compareMaxLevel !== "") {
            list = list.filter((item) => item.level <= parseInt(compareMaxLevel, 10));
        }

        // 4. Compare Result Filter (win / lose / draw)
        if (compareResultFilter !== "all") {
            list = list.filter((item) => {
                const tierMap = compareIncludeClear
                    ? { full_perfect: 3, full_combo: 2, clear: 1, none: 0 }
                    : { full_perfect: 2, full_combo: 1, clear: 0, none: 0 };
                const tierA = tierMap[item.statA] || 0;
                const tierB = tierMap[item.statB] || 0;
                const tierDiff = tierA - tierB;
                if (compareResultFilter === "win") return tierDiff > 0;
                if (compareResultFilter === "lose") return tierDiff < 0;
                if (compareResultFilter === "draw") return tierDiff === 0;
                return true;
            });
        }

        // 5. New song filter
        if (compareNewFilter !== "all") {
            list = list.filter((item) => {
                const isNew = isNewSong(item.song);
                return compareNewFilter === "new" ? isNew : !isNew;
            });
        }

        // 6. Sorting
        list.sort((a, b) => {
            let cmp = 0;
            if (compareSortBy === "level") {
                cmp = a.level - b.level;
            } else if (compareSortBy === "gap") {
                const tierMap = compareIncludeClear
                    ? { full_perfect: 3, full_combo: 2, clear: 1, none: 0 }
                    : { full_perfect: 2, full_combo: 1, clear: 0, none: 0 };
                const tierDiffA = (tierMap[a.statA] || 0) - (tierMap[a.statB] || 0);
                const tierDiffB = (tierMap[b.statA] || 0) - (tierMap[b.statB] || 0);

                if (tierDiffA !== tierDiffB) {
                    cmp = tierDiffA - tierDiffB;
                } else {
                    cmp = (a.ratingA - a.ratingB) - (b.ratingA - b.ratingB);
                }
            } else if (compareSortBy === "title") {
                cmp = getSongTitle(a.song).localeCompare(getSongTitle(b.song));
            } else if (compareSortBy === "ratingA") {
                cmp = a.ratingA - b.ratingA;
            } else if (compareSortBy === "ratingB") {
                cmp = a.ratingB - b.ratingB;
            }

            if (cmp !== 0) {
                return compareSortOrder === "asc" ? cmp : -cmp;
            }

            // 2차 정렬: 내 성과 순 정렬(AP->FC->C->NC) 내림차순
            const statusMap = { full_perfect: 3, full_combo: 2, clear: 1, none: 0 };
            const myStatA = statusMap[a.statA] || 0;
            const myStatB = statusMap[b.statA] || 0;
            if (myStatA !== myStatB) {
                return myStatB - myStatA;
            }

            // 3차 정렬: 디폴트 정렬
            return defaultSort(a, b);
        });

        return list;
    }, [
        compareResults,
        compareSearch,
        compareDiffFilters,
        compareResultFilter,
        compareMinLevel,
        compareMaxLevel,
        compareSortBy,
        compareSortOrder,
        settingsTitleLang,
        compareIncludeClear,
        compareNewFilter,
    ]);

    const visibleCompareList = useMemo(() => {
        return filteredCompareList.slice(0, compareVisibleCount);
    }, [filteredCompareList, compareVisibleCount]);

    const filteredCounts = useMemo(() => {
        let apA = 0,
            fcA = 0,
            clrA = 0;
        let apB = 0,
            fcB = 0,
            clrB = 0;
        filteredCompareList.forEach((item) => {
            if (item.statA === "full_perfect") apA++;
            else if (item.statA === "full_combo") fcA++;
            else if (item.statA === "clear") clrA++;

            if (item.statB === "full_perfect") apB++;
            else if (item.statB === "full_combo") fcB++;
            else if (item.statB === "clear") clrB++;
        });
        return { apA, fcA, clrA, apB, fcB, clrB };
    }, [filteredCompareList]);

    return (
        <div className="compare-layout-grid">
            {/* Left: Friends list & Add friend sidebar */}
            <aside
                className="glass-panel"
                style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}
            >
                <h3
                    style={{
                        fontSize: "1.1rem",
                        fontWeight: "800",
                        color: "var(--color-cyan)",
                        borderBottom: "1px solid var(--border-color)",
                        paddingBottom: "0.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                    }}
                >
                    <Users size={18} /> 친구
                </h3>

                {/* Add Friend Form */}
                <form
                    onSubmit={handleAddFriend}
                    style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                >
                    <div className="filter-group" style={{ margin: 0 }}>
                        <label className="filter-label" style={{ fontSize: "0.8rem", fontWeight: "700" }}>
                            친구 추가
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="ID"
                                value={friendInputId}
                                onChange={(e) => setFriendInputId(e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    padding: "0.4rem 0.6rem",
                                    fontSize: "0.85rem",
                                }}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{
                                    flexShrink: 0,
                                    padding: "0.4rem 0.8rem",
                                    fontSize: "0.85rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    {friendAddError && (
                        <div
                            style={{ color: "var(--color-danger)", fontSize: "0.75rem", fontWeight: "700" }}
                        >
                            ⚠ {friendAddError}
                        </div>
                    )}
                    {friendAddSuccess && (
                        <div
                            style={{
                                color: "var(--color-success)",
                                fontSize: "0.75rem",
                                fontWeight: "700",
                            }}
                        >
                            ✓ {friendAddSuccess}
                        </div>
                    )}
                </form>

                {/* Friends List Container */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <label className="filter-label" style={{ fontSize: "0.8rem", fontWeight: "700" }}>
                        친구 목록
                    </label>
                    {friendsList.length === 0 ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "2rem 1rem",
                                fontSize: "0.8rem",
                                color: "var(--text-muted)",
                                border: "1px dashed var(--border-color)",
                                borderRadius: "8px",
                            }}
                        >
                            등록된 친구가 없습니다.
                            <br />위 입력창에서 친구를 추가하세요.
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                                maxHeight: "400px",
                                overflowY: "auto",
                                paddingRight: "0.25rem",
                            }}
                        >
                            {friendsList.map((friend) => (
                                <div
                                    key={friend.username}
                                    className="glass-panel hover-lift"
                                    style={{
                                        padding: "0.75rem",
                                        borderRadius: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer",
                                        border:
                                            compareTargetId.toLowerCase() === friend.username.toLowerCase()
                                                ? "1px solid var(--color-cyan)"
                                                : "1px solid var(--border-color)",
                                        background:
                                            compareTargetId.toLowerCase() === friend.username.toLowerCase()
                                                ? "rgba(0, 242, 254, 0.05)"
                                                : "",
                                    }}
                                    onClick={() => handleCompareSearch(null, friend.username)}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                fontWeight: "700",
                                                fontSize: "0.85rem",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                display: "inline-block",
                                                cursor: "pointer",
                                                transition: "color 0.2s",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/dashboard/${friend.username}`);
                                            }}
                                            onMouseEnter={(e) => {
                                                e.target.style.textDecoration = "underline";
                                                e.target.style.color = "var(--color-cyan)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.textDecoration = "none";
                                                e.target.style.color = "";
                                            }}
                                            title={`${friend.nickname}님의 대시보드 보기`}
                                        >
                                            {friend.nickname}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.7rem",
                                                color: "var(--text-secondary)",
                                                marginTop: "0.1rem",
                                            }}
                                        >
                                            @{friend.username}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.72rem",
                                                color: "var(--text-secondary)",
                                                fontWeight: "800",
                                                marginTop: "0.25rem",
                                            }}
                                        >
                                            {ratingMode === "potential" ? (
                                                <>
                                                    Potential:{" "}
                                                    <span style={{ color: "#c77dff" }}>
                                                        {(friend.potentialRating || 0.0).toFixed(2)}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    R:{" "}
                                                    <span style={{ color: "var(--color-cyan)" }}>
                                                        {friend.normalRating || 0}
                                                    </span>{" "}
                                                    / AR:{" "}
                                                    <span style={{ color: "var(--color-append)" }}>
                                                        {friend.appendRating || 0}
                                                    </span>{" "}
                                                    / TR:{" "}
                                                    <span style={{ color: "var(--color-success)" }}>
                                                        {friend.totalRating || 0}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                                        <button
                                            className="btn btn-outline animate-glow"
                                            style={{
                                                padding: "0.25rem",
                                                borderColor: "rgba(0, 242, 254, 0.3)",
                                                color: "var(--color-cyan)",
                                                background: "rgba(0, 242, 254, 0.02)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: "28px",
                                                height: "28px",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/dashboard/${friend.username}`);
                                            }}
                                            title={`${friend.nickname}님의 대시보드 보기`}
                                        >
                                            <TrendingUp size={14} />
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{
                                                padding: "0.25rem",
                                                borderColor: "rgba(220,53,69,0.3)",
                                                color: "var(--color-danger)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: "28px",
                                                height: "28px",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFriend(friend.username);
                                            }}
                                            title="친구 삭제"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>

            {/* Right: Compare details panel */}
            <section className="glass-panel" style={{ padding: "2rem", flex: 1, minWidth: 0 }}>
                <h2 className="section-title" style={{ marginBottom: "1.5rem" }}>
                    <Users size={22} style={{ color: "var(--color-cyan)", marginRight: "0.5rem" }} /> 기록 비교
                </h2>

                <form
                    onSubmit={handleCompareSearch}
                    style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem", maxWidth: "600px" }}
                >
                    <div style={{ flex: 1, position: "relative" }}>
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
                            placeholder="비교할 상대방의 계정 ID를 입력하세요."
                            style={{ paddingLeft: "2.5rem", width: "100%" }}
                            value={compareTargetId}
                            onChange={(e) => setCompareTargetId(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={isComparing}>
                        {isComparing ? "조회 중..." : "비교하기"}
                    </button>
                </form>

                {compareError && (
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1rem",
                            borderLeft: "4px solid var(--color-danger)",
                            color: "var(--color-danger)",
                            fontWeight: "700",
                            marginBottom: "2rem",
                        }}
                    >
                        ⚠ {compareError}
                    </div>
                )}

                {!compareResults ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "4rem 2rem",
                            color: "var(--text-muted)",
                            border: "1px dashed var(--border-color)",
                            borderRadius: "12px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "300px",
                        }}
                    >
                        <span style={{ fontSize: "2rem", marginBottom: "1rem" }}>👥</span>
                        <span>
                            비교할 친구 목록의 카드를 선택하거나 상단 검색창에 ID를 입력하여 성과 기록을 1대1 비교해 보세요!
                        </span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        {/* 셐포스 및 성과 종합 비교 */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                gap: "1.5rem",
                            }}
                        >
                            {/* Rating comparison widget */}
                            <div
                                className="glass-panel"
                                style={{
                                    padding: "1.5rem",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyItems: "center",
                                    textAlign: "center",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "1rem",
                                        flexWrap: "wrap",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <h4
                                        style={{
                                            color: "var(--text-secondary)",
                                            margin: 0,
                                            fontSize: "0.95rem",
                                            fontWeight: "700",
                                        }}
                                    >
                                        {ratingMode === "potential" ? (
                                            "Potential 비교"
                                        ) : (
                                            compareRatingType === "player"
                                                ? "Player R"
                                                : compareRatingType === "append"
                                                  ? "Append R"
                                                  : "Total R"
                                        )}
                                    </h4>
                                    {ratingMode !== "potential" && (
                                        <div style={{ display: "flex", gap: "0.25rem" }}>
                                            {["player", "append", "total"].map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    className={`btn btn-outline ${compareRatingType === type ? "active" : ""}`}
                                                    style={{
                                                        padding: "0.2rem 0.5rem",
                                                        fontSize: "0.75rem",
                                                        borderRadius: "6px",
                                                        background:
                                                            compareRatingType === type
                                                                ? "rgba(0, 242, 254, 0.15)"
                                                                : "",
                                                        borderColor:
                                                            compareRatingType === type
                                                                ? "var(--color-cyan)"
                                                                : "var(--border-color)",
                                                        color:
                                                            compareRatingType === type
                                                                ? "var(--color-cyan)"
                                                                : "var(--text-secondary)",
                                                    }}
                                                    onClick={() => setCompareRatingType(type)}
                                                >
                                                    {type === "player"
                                                        ? "Player R"
                                                        : type === "append"
                                                          ? "Append R"
                                                          : "Total R"}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const valA =
                                        ratingMode === "potential"
                                            ? compareResults.resA.potential
                                            : compareRatingType === "player"
                                                ? compareResults.resA.sum
                                                : compareRatingType === "append"
                                                  ? compareResults.resA.appendSum
                                                  : compareResults.resA.totalSum;
                                    const valB =
                                        ratingMode === "potential"
                                            ? compareResults.resB.potential
                                            : compareRatingType === "player"
                                                ? compareResults.resB.sum
                                                : compareRatingType === "append"
                                                  ? compareResults.resB.appendSum
                                                  : compareResults.resB.totalSum;

                                    const { pctA, pctB } = getRelativePercentages(valA, valB, ratingMode === "potential");

                                    return (
                                        <>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    marginBottom: "0.5rem",
                                                    fontWeight: "700",
                                                }}
                                            >
                                                <span>{compareData.userA.nickname}</span>
                                                <span>{compareData.userB.nickname}</span>
                                            </div>

                                            <div
                                                style={{
                                                    height: "12px",
                                                    background: "rgba(255,255,255,0.05)",
                                                    borderRadius: "999px",
                                                    overflow: "hidden",
                                                    display: "flex",
                                                    position: "relative",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${pctA}%`,
                                                        background:
                                                            "linear-gradient(90deg, var(--color-cyan), #00b4d8)",
                                                        transition: "width 0.3s ease",
                                                    }}
                                                ></div>
                                                <div
                                                    style={{
                                                        width: `${pctB}%`,
                                                        background:
                                                            "linear-gradient(90deg, #d90429, var(--color-pink))",
                                                        transition: "width 0.3s ease",
                                                    }}
                                                ></div>
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        left: "50%",
                                                        top: "0",
                                                        width: "2px",
                                                        height: "100%",
                                                        background: "rgba(255, 255, 255, 0.4)",
                                                        zIndex: 10,
                                                        transform: "translateX(-50%)",
                                                        pointerEvents: "none",
                                                    }}
                                                ></div>
                                            </div>

                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "1fr auto 1fr",
                                                    fontWeight: "700",
                                                    marginTop: "0.5rem",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        color: "var(--color-cyan)",
                                                        textAlign: "left",
                                                    }}
                                                >
                                                    {ratingMode === "potential" ? valA.toFixed(2) : valA}
                                                </span>
                                                <span
                                                    style={{
                                                        color:
                                                            valA > valB
                                                                ? "var(--color-cyan)"
                                                                : valA < valB
                                                                  ? "var(--color-pink)"
                                                                  : "var(--text-muted)",
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    {valA > valB
                                                        ? `+${(valA - valB).toFixed(ratingMode === "potential" ? 2 : 0)}`
                                                        : valA < valB
                                                          ? `-${(valB - valA).toFixed(ratingMode === "potential" ? 2 : 0)}`
                                                          : ratingMode === "potential" ? "0.00" : "0"}
                                                </span>
                                                <span
                                                    style={{
                                                        color: "var(--color-pink)",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {ratingMode === "potential" ? valB.toFixed(2) : valB}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Achievements counts comparison */}
                            <div
                                className="glass-panel"
                                style={{
                                    padding: "1.5rem",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "1rem",
                                }}
                            >
                                <h4
                                    style={{
                                        color: "var(--text-secondary)",
                                        margin: 0,
                                        fontSize: "0.9rem",
                                        fontWeight: "700",
                                        borderBottom: "1px solid var(--border-color)",
                                        paddingBottom: "0.5rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <span>성과 개수 비교</span>
                                    <span
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-muted)",
                                            fontWeight: "500",
                                        }}
                                    >
                                        필터링 결과: {filteredCompareList.length}개 곡 기준
                                    </span>
                                </h4>

                                <div style={{ overflowX: "auto" }}>
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: "0.85rem",
                                            textAlign: "center",
                                        }}
                                    >
                                        <thead>
                                            <tr
                                                style={{
                                                    borderBottom: "1px solid var(--border-color)",
                                                    color: "var(--text-secondary)",
                                                    fontWeight: "700",
                                                }}
                                            >
                                                <th style={{ padding: "0.5rem", textAlign: "left" }}>성과</th>
                                                <th
                                                    style={{
                                                        padding: "0.5rem",
                                                        color: "var(--color-cyan)",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {compareData.userA.nickname}
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "0.5rem",
                                                        color: "var(--color-pink)",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {compareData.userB.nickname}
                                                </th>
                                                <th style={{ padding: "0.5rem", textAlign: "right" }}>차이</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* AP Row */}
                                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        textAlign: "left",
                                                        fontWeight: "700",
                                                        color: "var(--color-ap)",
                                                    }}
                                                >
                                                    AP
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                        color: "var(--color-cyan)",
                                                    }}
                                                >
                                                    {filteredCounts.apA}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                        color: "var(--color-pink)",
                                                    }}
                                                >
                                                    {filteredCounts.apB}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {(() => {
                                                        const diff = filteredCounts.apA - filteredCounts.apB;
                                                        return (
                                                            <span
                                                                style={{
                                                                    color:
                                                                        diff > 0
                                                                            ? "var(--color-cyan)"
                                                                            : diff < 0
                                                                              ? "var(--color-pink)"
                                                                              : "var(--text-muted)",
                                                                }}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                            {/* FC Row */}
                                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        textAlign: "left",
                                                        fontWeight: "700",
                                                        color: "var(--color-fc)",
                                                    }}
                                                >
                                                    FC
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                        color: "var(--color-cyan)",
                                                    }}
                                                >
                                                    {filteredCounts.fcA}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                        color: "var(--color-pink)",
                                                    }}
                                                >
                                                    {filteredCounts.fcB}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {(() => {
                                                        const diff = filteredCounts.fcA - filteredCounts.fcB;
                                                        return (
                                                            <span
                                                                style={{
                                                                    color:
                                                                        diff > 0
                                                                            ? "var(--color-cyan)"
                                                                            : diff < 0
                                                                              ? "var(--color-pink)"
                                                                              : "var(--text-muted)",
                                                                }}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                            {/* C Row */}
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        textAlign: "left",
                                                        fontWeight: "700",
                                                        color: "var(--color-clear)",
                                                    }}
                                                >
                                                    C
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                        color: "var(--color-cyan)",
                                                    }}
                                                >
                                                    {filteredCounts.clrA}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                        color: "var(--color-pink)",
                                                    }}
                                                >
                                                    {filteredCounts.clrB}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.6rem 0.5rem",
                                                        fontWeight: "700",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {(() => {
                                                        const diff = filteredCounts.clrA - filteredCounts.clrB;
                                                        return (
                                                            <span
                                                                style={{
                                                                    color:
                                                                        diff > 0
                                                                            ? "var(--color-cyan)"
                                                                            : diff < 0
                                                                              ? "var(--color-pink)"
                                                                              : "var(--text-muted)",
                                                                }}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Common Songs Score comparison */}
                        <div className="glass-panel" style={{ padding: "1.5rem" }}>
                            <h3
                                style={{
                                    fontSize: "1.1rem",
                                    marginBottom: "1.25rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "0.5rem",
                                    flexWrap: "wrap",
                                }}
                            >
                                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Sparkles size={18} style={{ color: "var(--color-cyan)" }} /> 상세 비교
                                </span>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "1rem",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <label
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.35rem",
                                            cursor: "pointer",
                                            fontSize: "0.8rem",
                                            color: "var(--text-secondary)",
                                            userSelect: "none",
                                            fontWeight: "normal",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={compareIncludeClear}
                                            onChange={(e) => setCompareIncludeClear(e.target.checked)}
                                            style={{
                                                width: "14px",
                                                height: "14px",
                                                accentColor: "var(--color-cyan)",
                                                cursor: "pointer",
                                            }}
                                        />
                                        클리어를 성과로 인정
                                    </label>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => setIsCompareFilterExpanded(!isCompareFilterExpanded)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.25rem",
                                            fontSize: "0.85rem",
                                            padding: "0.25rem 0.5rem",
                                        }}
                                    >
                                        <Filter size={12} />{" "}
                                        {isCompareFilterExpanded ? "필터 접기" : "필터 펼치기"}
                                    </button>
                                </div>
                            </h3>

                            {/* FILTER PANEL FOR DETAILED COMPARISON */}
                            {isCompareFilterExpanded && (
                                <div
                                    className="glass-panel"
                                    style={{
                                        padding: "1rem",
                                        borderRadius: "8px",
                                        marginBottom: "1.25rem",
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                        gap: "1rem",
                                        alignItems: "end",
                                        border: "1px solid rgba(255, 255, 255, 0.05)",
                                    }}
                                >
                                    {/* 1. Song search */}
                                    <div className="filter-group" style={{ margin: 0 }}>
                                        <label className="filter-label">곡 검색</label>
                                        <div style={{ position: "relative" }}>
                                            <Search
                                                size={14}
                                                style={{
                                                    position: "absolute",
                                                    left: "10px",
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    color: "var(--text-muted)",
                                                }}
                                            />
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="곡명 검색..."
                                                style={{
                                                    paddingLeft: "2.2rem",
                                                    width: "100%",
                                                    paddingRight: "0.5rem",
                                                }}
                                                value={compareSearchInput}
                                                onChange={(e) => setCompareSearchInput(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* 2. Difficulty filters */}
                                    <div className="filter-group" style={{ margin: 0 }}>
                                        <label className="filter-label">난이도</label>
                                        <div className="filter-checkbox-group difficulty-checkbox-group compare-diff-group">
                                            {["easy", "normal", "hard", "expert", "master", "append"].map(
                                                (d) => {
                                                    const isActive = compareDiffFilters.includes(d);
                                                    const diffColors = {
                                                        easy: { color: "var(--color-easy)", bg: "rgba(16, 185, 129, 0.08)" },
                                                        normal: { color: "var(--color-normal)", bg: "rgba(59, 130, 246, 0.08)" },
                                                        hard: { color: "var(--color-hard)", bg: "rgba(245, 158, 11, 0.08)" },
                                                        expert: { color: "var(--color-expert)", bg: "rgba(239, 68, 68, 0.08)" },
                                                        master: { color: "var(--color-master)", bg: "rgba(139, 92, 246, 0.08)" },
                                                        append: { color: "var(--color-append)", bg: "rgba(255, 105, 180, 0.08)" },
                                                    };
                                                    return (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            className={`btn btn-outline ${isActive ? "active" : ""}`}
                                                            style={{
                                                                padding: "0.25rem 0.4rem",
                                                                fontSize: "0.72rem",
                                                                borderRadius: "6px",
                                                                borderColor: isActive
                                                                    ? diffColors[d].color
                                                                    : "var(--border-color)",
                                                                color: isActive
                                                                    ? diffColors[d].color
                                                                    : "var(--text-secondary)",
                                                                backgroundColor: isActive
                                                                    ? diffColors[d].bg
                                                                    : "transparent",
                                                            }}
                                                            onClick={() => {
                                                                if (isActive) {
                                                                    if (compareDiffFilters.length > 1) {
                                                                        setCompareDiffFilters(
                                                                            compareDiffFilters.filter(
                                                                                (f) => f !== d,
                                                                            ),
                                                                        );
                                                                    }
                                                                } else {
                                                                    setCompareDiffFilters([
                                                                        ...compareDiffFilters,
                                                                        d,
                                                                    ]);
                                                                }
                                                            }}
                                                        >
                                                            {d.toUpperCase()}
                                                        </button>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Level filters */}
                                    <div className="filter-group" style={{ margin: 0 }}>
                                        <label className="filter-label">레벨 범위</label>
                                        <div
                                            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                                        >
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="form-control"
                                                placeholder="최소"
                                                style={{ width: "100%", padding: "0.45rem 0.6rem" }}
                                                value={compareMinLevel}
                                                onChange={(e) => setCompareMinLevel(e.target.value)}
                                            />
                                            <span
                                                style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                                            >
                                                ~
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="form-control"
                                                placeholder="최대"
                                                style={{ width: "100%", padding: "0.45rem 0.6rem" }}
                                                value={compareMaxLevel}
                                                onChange={(e) => setCompareMaxLevel(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="filter-group" style={{ margin: 0 }}>
                                        <label className="filter-label">성과 격차</label>
                                        <select
                                            className="form-control"
                                            style={{ width: "100%", padding: "0.45rem 1rem" }}
                                            value={compareResultFilter}
                                            onChange={(e) => setCompareResultFilter(e.target.value)}
                                        >
                                            <option value="all">ALL</option>
                                            <option value="win">(+)</option>
                                            <option value="lose">(-)</option>
                                            <option value="draw">0</option>
                                        </select>
                                    </div>

                                    {/* 신곡 필터 */}
                                    <div className="filter-group" style={{ margin: 0 }}>
                                        <label className="filter-label">신곡 여부</label>
                                        <select
                                            className="form-control"
                                            style={{ width: "100%", padding: "0.45rem 1rem" }}
                                            value={compareNewFilter}
                                            onChange={(e) => setCompareNewFilter(e.target.value)}
                                        >
                                            <option value="all">전체</option>
                                            <option value="new">신곡</option>
                                            <option value="old">구곡</option>
                                        </select>
                                    </div>

                                    {/* 5. Sorting Options */}
                                    <div className="filter-group" style={{ margin: 0 }}>
                                        <label className="filter-label">정렬</label>
                                        <div style={{ display: "flex", gap: "0.4rem" }}>
                                            <select
                                                className="form-control"
                                                style={{ flex: 1.5, padding: "0.45rem" }}
                                                value={compareSortBy}
                                                onChange={(e) => setCompareSortBy(e.target.value)}
                                            >
                                                <option value="level">레벨</option>
                                                <option value="gap">성과 격차</option>
                                                <option value="title">곡명</option>
                                                <option value="ratingA">{ratingMode === "potential" ? "내 Potential" : "내 레이팅"}</option>
                                                <option value="ratingB">{ratingMode === "potential" ? "상대 Potential" : "상대 레이팅"}</option>
                                            </select>
                                            <select
                                                className="form-control"
                                                style={{ flex: 1, padding: "0.45rem" }}
                                                value={compareSortOrder}
                                                onChange={(e) => setCompareSortOrder(e.target.value)}
                                            >
                                                <option value="desc">내림차순</option>
                                                <option value="asc">오름차순</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {filteredCompareList.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "3rem 0",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    조건에 일치하는 비교 결과가 없습니다.
                                </div>
                            ) : (
                                visibleCompareList.map(
                                    ({ song, diff, level, statA, statB, ratingA, ratingB }) => {
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
                                            none: "-",
                                        };

                                        const tierMap = compareIncludeClear
                                            ? { full_perfect: 3, full_combo: 2, clear: 1, none: 0 }
                                            : { full_perfect: 2, full_combo: 1, clear: 0, none: 0 };
                                        const tierA = tierMap[statA] || 0;
                                        const tierB = tierMap[statB] || 0;
                                        const tierDiff = tierA - tierB;

                                        return (
                                            <div key={`${song.id}-${diff}`} className="compare-record-row">
                                                <JacketImage songId={song.id} size={36} />

                                                <div style={{ minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontWeight: "600",
                                                            fontSize: "0.9rem",
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {getSongTitle(song)}
                                                    </div>
                                                    <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                                                        {diff.toUpperCase()} {level}
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <span
                                                        className={`status-badge ${statusLabels[statA]}`}
                                                        style={{
                                                            fontSize: "0.65rem",
                                                            padding: "0.1rem 0.35rem",
                                                        }}
                                                    >
                                                        {statusText[statA]}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            color: "var(--text-muted)",
                                                            marginTop: "0.15rem",
                                                        }}
                                                    >
                                                        {ratingA.toFixed(ratingMode === "potential" ? 2 : 1)}
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <span
                                                        className={`status-badge ${statusLabels[statB]}`}
                                                        style={{
                                                            fontSize: "0.65rem",
                                                            padding: "0.1rem 0.35rem",
                                                        }}
                                                    >
                                                        {statusText[statB]}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            color: "var(--text-muted)",
                                                            marginTop: "0.15rem",
                                                        }}
                                                    >
                                                        {ratingB.toFixed(ratingMode === "potential" ? 2 : 1)}
                                                    </span>
                                                </div>

                                                {(() => {
                                                    let gapStyle = {
                                                        color: "var(--text-muted)",
                                                        fontWeight: "400",
                                                        fontSize: "0.85rem",
                                                    };
                                                    let displayText = "0";

                                                    if (tierDiff === 3) {
                                                        gapStyle = {
                                                            color: "#00f2fe",
                                                            textShadow: "0 0 8px rgba(0, 242, 254, 0.6)",
                                                            fontWeight: "900",
                                                            fontSize: "1.05rem",
                                                        };
                                                        displayText = "+3";
                                                    } else if (tierDiff === 2) {
                                                        gapStyle = {
                                                            color: "#00b4d8",
                                                            fontWeight: "700",
                                                            fontSize: "0.95rem",
                                                        };
                                                        displayText = "+2";
                                                    } else if (tierDiff === 1) {
                                                        gapStyle = {
                                                            color: "#bde0fe",
                                                            fontWeight: "500",
                                                            fontSize: "0.85rem",
                                                        };
                                                        displayText = "+1";
                                                    } else if (tierDiff === -1) {
                                                        gapStyle = {
                                                            color: "#ffb3c1",
                                                            fontWeight: "500",
                                                            fontSize: "0.85rem",
                                                        };
                                                        displayText = "-1";
                                                    } else if (tierDiff === -2) {
                                                        gapStyle = {
                                                            color: "#ff4d6d",
                                                            fontWeight: "700",
                                                            fontSize: "0.95rem",
                                                        };
                                                        displayText = "-2";
                                                    } else if (tierDiff === -3) {
                                                        gapStyle = {
                                                            color: "#ff003c",
                                                            textShadow: "0 0 8px rgba(255, 0, 60, 0.6)",
                                                            fontWeight: "900",
                                                            fontSize: "1.05rem",
                                                        };
                                                        displayText = "-3";
                                                    }

                                                    return (
                                                        <div
                                                            style={{
                                                                textAlign: "center",
                                                                ...gapStyle,
                                                            }}
                                                        >
                                                            {displayText}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    },
                                )
                            )}
                        </div>
                        {/* Sentinel for IntersectionObserver */}
                        {filteredCompareList.length > compareVisibleCount && (
                            <div
                                ref={compareSentinelRef}
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
                                <span>비교 결과를 불러오는 중...</span>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};
