import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Search } from "lucide-react";
import { useSessionState } from "../../utils/useSessionState";

export const Ranking = ({
    currentUser,
    ratingMode = "b39",
    myNormalRating,
    myAppendRating,
    myPotentialRating,
    myApCount,
    myFcCount,
    myClearCount,
}) => {
    const navigate = useNavigate();

    // --- State ---
    const [rankings, setRankings] = useState([]);
    const [isRankingsLoading, setIsRankingsLoading] = useState(false);
    const [rankingsSearch, setRankingsSearch] = useSessionState("pjsk_rankings_search", "");
    const [rankingsSortBy, setRankingsSortBy] = useSessionState("pjsk_rankings_sort_by", ratingMode === "potential" ? "potential" : "total"); // total, normal, append, ap, fc, potential
    const [rankingsSortOrder, setRankingsSortOrder] = useSessionState("pjsk_rankings_sort_order", "desc");

    // --- Fetch Rankings ---
    useEffect(() => {
        const fetchRankings = async () => {
            setIsRankingsLoading(true);
            try {
                const res = await fetch("/api/rankings");
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        // Filter out admin user
                        setRankings(data.rankings.filter((user) => user.username.toLowerCase() !== "admin"));
                    }
                }
            } catch (e) {
                console.error("Failed to fetch rankings:", e);
            } finally {
                setIsRankingsLoading(false);
            }
        };
        fetchRankings();
    }, []);

    const sortedAndFilteredRankings = useMemo(() => {
        let list = rankings.map((user) => {
            const isMe = currentUser && currentUser.username.toLowerCase() === user.username.toLowerCase();
            if (isMe) {
                return {
                    ...user,
                    normalRating: myNormalRating ?? user.normalRating,
                    appendRating: myAppendRating ?? user.appendRating,
                    potentialRating: myPotentialRating ?? user.potentialRating,
                    totalRating: (myNormalRating ?? user.normalRating) + (myAppendRating ?? user.appendRating),
                    apCount: myApCount ?? user.apCount,
                    fcCount: myFcCount ?? user.fcCount,
                    clearCount: myClearCount ?? user.clearCount,
                };
            }
            return user;
        });

        // Sort dynamically
        list.sort((a, b) => {
            let valA = 0,
                valB = 0;
            if (rankingsSortBy === "total") {
                valA = a.totalRating || 0;
                valB = b.totalRating || 0;
            } else if (rankingsSortBy === "normal") {
                valA = a.normalRating || 0;
                valB = b.normalRating || 0;
            } else if (rankingsSortBy === "append") {
                valA = a.appendRating || 0;
                valB = b.appendRating || 0;
            } else if (rankingsSortBy === "potential") {
                valA = a.potentialRating || 0;
                valB = b.potentialRating || 0;
            } else if (rankingsSortBy === "ap") {
                valA = a.apCount || 0;
                valB = b.apCount || 0;
            } else if (rankingsSortBy === "fc") {
                valA = a.fcCount || 0;
                valB = b.fcCount || 0;
            } else if (rankingsSortBy === "clear") {
                valA = a.clearCount || 0;
                valB = b.clearCount || 0;
            }

            if (rankingsSortOrder === "desc") {
                return valB - valA;
            } else {
                return valA - valB;
            }
        });

        // Assign absolute rank based on sorted order
        const rankedList = list.map((user, idx) => ({
            ...user,
            absoluteRank: idx + 1,
        }));

        // Filter by nickname search query after sorting
        if (rankingsSearch.trim()) {
            const query = rankingsSearch.toLowerCase().trim();
            return rankedList.filter((r) => r.nickname && r.nickname.toLowerCase().includes(query));
        }

        return rankedList;
    }, [
        rankings,
        rankingsSearch,
        rankingsSortBy,
        rankingsSortOrder,
        currentUser,
        myNormalRating,
        myAppendRating,
        myPotentialRating,
        myApCount,
        myFcCount,
        myClearCount,
    ]);

    return (
        <section className="glass-panel" style={{ padding: "2rem" }}>
            <div className="section-title-bar">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                    }}
                >
                    <h2 className="section-title" style={{ margin: 0 }}>
                        <Trophy size={22} style={{ color: "var(--color-cyan)" }} /> 랭킹
                    </h2>
                </div>
            </div>

            {/* Search & Sort Filters */}
            <div className="table-filters-expanded" style={{ display: "block", marginBottom: "1.5rem" }}>
                <div
                    className="filters-row constants-filters-grid"
                    style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: "1rem" }}
                >
                    <div className="filter-group">
                        <label className="filter-label">닉네임 검색</label>
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
                                placeholder="검색할 유저 닉네임을 입력하세요..."
                                style={{ paddingLeft: "2.5rem", width: "100%" }}
                                value={rankingsSearch}
                                onChange={(e) => setRankingsSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">정렬 기준</label>
                        <select
                            className="form-control"
                            style={{ width: "100%", cursor: "pointer" }}
                            value={rankingsSortBy}
                            onChange={(e) => setRankingsSortBy(e.target.value)}
                        >
                            {ratingMode === "potential" ? (
                                <>
                                    <option value="potential">Potential</option>
                                    <option value="ap">AP 수</option>
                                    <option value="fc">FC 수</option>
                                    <option value="clear">C 수</option>
                                </>
                            ) : (
                                <>
                                    <option value="total">Total R</option>
                                    <option value="normal">Player R</option>
                                    <option value="append">Append R</option>
                                    <option value="ap">AP 수</option>
                                    <option value="fc">FC 수</option>
                                    <option value="clear">C 수</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
                    >
                        <button
                            type="button"
                            className="btn btn-outline"
                            style={{ height: "42px", padding: "0 1rem" }}
                            onClick={() => setRankingsSortOrder(rankingsSortOrder === "desc" ? "asc" : "desc")}
                        >
                            {rankingsSortOrder === "desc" ? "내림차순 ↓" : "올림차순 ↑"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Ranking Table List */}
            {isRankingsLoading ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                    랭킹 데이터를 로딩하고 있습니다...
                </div>
            ) : sortedAndFilteredRankings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                    조건에 부합하는 랭킹 정보가 없습니다.
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            minWidth: "600px",
                            textAlign: "left",
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    borderBottom: "2px solid var(--border-color)",
                                    color: "var(--text-secondary)",
                                    fontSize: "0.85rem",
                                    fontWeight: "700",
                                }}
                            >
                                <th style={{ padding: "1rem", textAlign: "center" }}>순위</th>
                                <th style={{ padding: "1rem", textAlign: "left" }}>닉네임</th>
                                {ratingMode === "potential" ? (
                                    <th style={{ padding: "1rem 0.75rem", textAlign: "center", color: "#c77dff" }}>
                                        Potential
                                    </th>
                                ) : (
                                    <>
                                        <th style={{ padding: "1rem 0rem", textAlign: "center" }}>Total R</th>
                                        <th style={{ padding: "1rem 0rem", textAlign: "center" }}>Player R</th>
                                        <th style={{ padding: "1rem 0rem", textAlign: "center" }}>Append R</th>
                                    </>
                                )}
                                <th style={{ padding: "1rem 0.5rem 1rem 2.5rem", textAlign: "center" }}>AP</th>
                                <th style={{ padding: "1rem 0.5rem", textAlign: "center" }}>FC</th>
                                <th style={{ padding: "1rem 1.5rem 1rem 0.5rem", textAlign: "center" }}>C</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredRankings.map((user) => {
                                const isMe =
                                    currentUser && currentUser.username.toLowerCase() === user.username.toLowerCase();
                                return (
                                    <tr
                                        key={user.username}
                                        style={{
                                            borderBottom: "1px solid var(--border-color)",
                                            background: isMe ? "rgba(0, 242, 254, 0.05)" : "transparent",
                                            transition: "var(--transition-smooth)",
                                            fontWeight: isMe ? "700" : "normal",
                                            cursor: "pointer",
                                        }}
                                        className="hover-lift"
                                        onClick={() => navigate(`/dashboard/${user.username}`)}
                                        title={`${user.nickname}님의 대시보드 보기`}
                                    >
                                        <td style={{ padding: "1rem", textAlign: "center" }}>
                                            {user.absoluteRank === 1 ? (
                                                <span
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        filter: "drop-shadow(0 0 5px rgba(255,215,0,0.5))",
                                                    }}
                                                >
                                                    🥇
                                                </span>
                                            ) : user.absoluteRank === 2 ? (
                                                <span
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        filter: "drop-shadow(0 0 5px rgba(192,192,192,0.5))",
                                                    }}
                                                >
                                                    🥈
                                                </span>
                                            ) : user.absoluteRank === 3 ? (
                                                <span
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        filter: "drop-shadow(0 0 5px rgba(205,127,50,0.5))",
                                                    }}
                                                >
                                                    🥉
                                                </span>
                                            ) : (
                                                `#${user.absoluteRank}`
                                            )}
                                        </td>
                                        <td style={{ padding: "1rem", textAlign: "left" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                {isMe && (
                                                    <span
                                                        className="diff-badge diff-easy"
                                                        style={{
                                                            fontSize: "0.65rem",
                                                            padding: "0.05rem 0.25rem",
                                                            borderRadius: "4px",
                                                        }}
                                                    >
                                                        ME
                                                    </span>
                                                )}
                                                <span
                                                    style={{
                                                        color: isMe ? "var(--color-cyan)" : "var(--text-primary)",
                                                    }}
                                                >
                                                    {user.nickname}
                                                </span>
                                            </div>
                                        </td>
                                        {ratingMode === "potential" ? (
                                            <td
                                                style={{
                                                    padding: "1rem 0.75rem",
                                                    textAlign: "center",
                                                    fontWeight: "800",
                                                    background: "linear-gradient(135deg, #c77dff, #87ceeb)",
                                                    WebkitBackgroundClip: "text",
                                                    backgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                }}
                                            >
                                                {user.potentialRating
                                                    ? (Math.floor(user.potentialRating * 100) / 100).toFixed(2)
                                                    : "0.00"}
                                            </td>
                                        ) : (
                                            <>
                                                <td
                                                    style={{
                                                        padding: "1rem 0.75rem",
                                                        textAlign: "center",
                                                        fontWeight: "800",
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {Math.round(user.totalRating)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "1rem 0.75rem",
                                                        textAlign: "center",
                                                        color: "var(--color-cyan)",
                                                        fontWeight: "700",
                                                    }}
                                                >
                                                    {Math.round(user.normalRating)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "1rem 0.75rem",
                                                        textAlign: "center",
                                                        color: "var(--color-append)",
                                                        fontWeight: "700",
                                                    }}
                                                >
                                                    {Math.round(user.appendRating)}
                                                </td>
                                            </>
                                        )}
                                        <td
                                            style={{
                                                padding: "1rem 0.5rem 1rem 2.5rem",
                                                textAlign: "center",
                                                color: "var(--color-ap)",
                                                fontWeight: "700",
                                            }}
                                        >
                                            {user.apCount}
                                        </td>
                                        <td
                                            style={{
                                                padding: "1rem 0.5rem",
                                                textAlign: "center",
                                                color: "var(--color-fc)",
                                                fontWeight: "700",
                                            }}
                                        >
                                            {user.fcCount}
                                        </td>
                                        <td
                                            style={{
                                                padding: "1rem 1.5rem 1rem 0.5rem",
                                                textAlign: "center",
                                                color: "var(--color-clear)",
                                                fontWeight: "700",
                                            }}
                                        >
                                            {user.clearCount}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};
