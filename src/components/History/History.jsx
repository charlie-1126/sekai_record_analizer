import React, { useState, useMemo } from "react";
import {
    Search,
    Filter,
    Calendar,
    Award,
    Sparkles,
    ArrowUpDown,
    Music,
    Clock,
    ChevronRight,
    Trophy,
} from "lucide-react";
import { JacketImage } from "../Common/JacketImage";
import { getSongTitle, getConstant } from "../../utils/ratingUtils";
import { dayjs, getFcApDates } from "../../utils/dateUtils";

export default function History({
    songs = [],
    scores = [],
    settingsTitleLang = "jp",
    setSelectedJacketSong = null,
    setActiveTab = null,
}) {
    // --- State & Filters ---
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState({ fc: true, ap: true });
    const [onlyBreakthroughs, setOnlyBreakthroughs] = useState(false);
    const [selectedDiff, setSelectedDiff] = useState("all"); // all, easy, normal, hard, expert, master, append
    const [minLevel, setMinLevel] = useState(5);
    const [maxLevel, setMaxLevel] = useState(38);
    const [sortOrder, setSortOrder] = useState("desc"); // desc (newest first), asc (oldest first)

    const diffNames = {
        easy: "EASY",
        normal: "NORMAL",
        hard: "HARD",
        expert: "EXPERT",
        master: "MASTER",
        append: "APPEND",
    };

    // --- Extract History Events with Dates & Calculate Breakthroughs ---
    const rawHistoryList = useMemo(() => {
        if (!songs.length || !scores.length) return [];

        const userScoresMap = new Map();
        scores.forEach((s) => {
            if (s && s.id) {
                userScoresMap.set(String(s.id), s);
            }
        });

        const events = [];

        songs.forEach((song) => {
            const songIdStr = String(song.id);
            const userScore = userScoresMap.get(songIdStr);
            if (!userScore || !userScore.dates) return;

            const difficulties = ["easy", "normal", "hard", "expert", "master", "append"];

            difficulties.forEach((diff) => {
                const dates = getFcApDates(userScore, diff);
                const lvl = (song.levels && song.levels[diff]) || 0;
                if (lvl === 0) return;

                // FC Event
                if (dates.fc) {
                    const fcConstVal = getConstant(song, diff, "fc");
                    const finalFcConst = typeof fcConstVal === "number" && !isNaN(fcConstVal) ? fcConstVal : lvl;
                    events.push({
                        id: `${songIdStr}_${diff}_fc_${dates.fc}`,
                        song,
                        diff,
                        type: "fc",
                        date: dates.fc,
                        level: lvl,
                        fcConstant: finalFcConst,
                        currentStatus: userScore[diff] || "none",
                    });
                }

                // AP Event
                if (dates.ap) {
                    const apConstVal = getConstant(song, diff, "ap");
                    const finalApConst = typeof apConstVal === "number" && !isNaN(apConstVal) ? apConstVal : lvl;
                    events.push({
                        id: `${songIdStr}_${diff}_ap_${dates.ap}`,
                        song,
                        diff,
                        type: "ap",
                        date: dates.ap,
                        level: lvl,
                        apConstant: finalApConst,
                        currentStatus: userScore[diff] || "none",
                    });
                }
            });
        });

        // Calculate running max constants chronologically ascending to detect breakthrough milestones
        events.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            const constA = a.type === "ap" ? a.apConstant : a.fcConstant;
            const constB = b.type === "ap" ? b.apConstant : b.fcConstant;
            return constA - constB;
        });

        let runningMaxFc = -1;
        let runningMaxAp = -1;

        events.forEach((item) => {
            if (item.type === "fc") {
                if (item.fcConstant > runningMaxFc) {
                    item.isBreakthrough = true;
                    runningMaxFc = item.fcConstant;
                } else {
                    item.isBreakthrough = false;
                }
            } else if (item.type === "ap") {
                if (item.apConstant > runningMaxAp) {
                    item.isBreakthrough = true;
                    runningMaxAp = item.apConstant;
                } else {
                    item.isBreakthrough = false;
                }
            }
        });

        return events;
    }, [songs, scores]);

    // --- Filter & Sort Events ---
    const filteredEvents = useMemo(() => {
        return rawHistoryList
            .filter((item) => {
                // Breakthrough toggle filter
                if (onlyBreakthroughs && !item.isBreakthrough) return false;

                // Status filter (FC / AP)
                if (!statusFilter.fc && item.type === "fc") return false;
                if (!statusFilter.ap && item.type === "ap") return false;

                // Difficulty filter
                if (selectedDiff !== "all" && item.diff !== selectedDiff) return false;

                // Level filter
                const min = minLevel === "" ? 0 : Number(minLevel);
                const max = maxLevel === "" ? 99 : Number(maxLevel);
                if (item.level < min || item.level > max) return false;

                // Search query filter
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const title = getSongTitle(item.song, settingsTitleLang).toLowerCase();
                    const composer = (item.song.composer || "").toLowerCase();
                    if (!title.includes(q) && !composer.includes(q)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const dateA = a.date;
                const dateB = b.date;
                if (dateA !== dateB) {
                    return sortOrder === "desc" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
                }
                // Secondary sort by level desc, then song id
                if (b.level !== a.level) return b.level - a.level;
                return String(a.song.id).localeCompare(String(b.song.id));
            });
    }, [
        rawHistoryList,
        onlyBreakthroughs,
        statusFilter,
        selectedDiff,
        minLevel,
        maxLevel,
        searchQuery,
        sortOrder,
        settingsTitleLang,
    ]);

    // --- Group Events by Date for Timeline Display ---
    const groupedTimeline = useMemo(() => {
        const groups = [];
        let currentGroup = null;

        filteredEvents.forEach((item) => {
            if (!currentGroup || currentGroup.date !== item.date) {
                currentGroup = {
                    date: item.date,
                    formattedDate: dayjs(item.date).format("YYYY-MM-DD"),
                    items: [],
                };
                groups.push(currentGroup);
            }
            currentGroup.items.push(item);
        });

        return groups;
    }, [filteredEvents]);

    // Stats
    const totalFcCount = useMemo(() => rawHistoryList.filter((e) => e.type === "fc").length, [rawHistoryList]);
    const totalApCount = useMemo(() => rawHistoryList.filter((e) => e.type === "ap").length, [rawHistoryList]);

    return (
        <div className="history-tab-container animate-fade-in" style={{ paddingBottom: "2rem" }}>
            {/* Timeline Header Banner */}
            <div
                className="glass-panel"
                style={{
                    padding: "0.85rem 1.25rem",
                    marginBottom: "0.75rem",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, rgba(13, 18, 33, 0.85) 0%, rgba(22, 29, 49, 0.75) 100%)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: "1.35rem",
                                fontWeight: 800,
                                color: "var(--text-primary)",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                margin: 0,
                            }}
                        >
                            <Clock style={{ color: "var(--color-cyan)" }} size={24} />
                            <span>타임라인</span>
                        </h2>
                    </div>

                    {/* Stats Counter Pills */}
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                        <div
                            className="stat-pill"
                            style={{
                                background: "rgba(192, 132, 252, 0.12)",
                                border: "1px solid rgba(192, 132, 252, 0.3)",
                                padding: "0.35rem 0.75rem",
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "baseline",
                                gap: "0.35rem",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: "0.8rem",
                                    color: "var(--color-fc)",
                                    fontWeight: 700,
                                }}
                            >
                                FC:
                            </span>
                            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                {totalFcCount}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>개</span>
                        </div>
                        <div
                            className="stat-pill"
                            style={{
                                background: "rgba(56, 189, 248, 0.12)",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                padding: "0.35rem 0.75rem",
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "baseline",
                                gap: "0.35rem",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: "0.8rem",
                                    color: "var(--color-ap)",
                                    fontWeight: 700,
                                }}
                            >
                                AP:
                            </span>
                            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                {totalApCount}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>개</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Controls Panel */}
            <div
                className="glass-panel"
                style={{ padding: "0.85rem 1rem", marginBottom: "1rem", borderRadius: "14px" }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "1rem",
                        alignItems: "center",
                    }}
                >
                    {/* Search Input */}
                    <div style={{ position: "relative" }}>
                        <Search
                            size={16}
                            style={{
                                position: "absolute",
                                left: "0.75rem",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "var(--text-muted)",
                            }}
                        />
                        <input
                            type="text"
                            placeholder="곡 제목 또는 작곡가 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "0.55rem 0.75rem 0.55rem 2.3rem",
                                background: "rgba(0, 0, 0, 0.3)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                fontSize: "0.85rem",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Achievement Type & Breakthrough Filter */}
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: 700,
                                minWidth: "36px",
                            }}
                        >
                            성과:
                        </span>
                        <button
                            type="button"
                            className={`btn ${statusFilter.ap ? "btn-primary" : "btn-outline"}`}
                            onClick={() => setStatusFilter((prev) => ({ ...prev, ap: !prev.ap }))}
                            style={{
                                padding: "0.35rem 0.65rem",
                                fontSize: "0.8rem",
                                borderColor: statusFilter.ap ? "var(--color-ap)" : "var(--border-color)",
                                background: statusFilter.ap ? "rgba(56, 189, 248, 0.2)" : "transparent",
                                color: statusFilter.ap ? "var(--color-ap)" : "var(--text-muted)",
                                fontWeight: 700,
                            }}
                        >
                            AP
                        </button>
                        <button
                            type="button"
                            className={`btn ${statusFilter.fc ? "btn-primary" : "btn-outline"}`}
                            onClick={() => setStatusFilter((prev) => ({ ...prev, fc: !prev.fc }))}
                            style={{
                                padding: "0.35rem 0.65rem",
                                fontSize: "0.8rem",
                                borderColor: statusFilter.fc ? "var(--color-fc)" : "var(--border-color)",
                                background: statusFilter.fc ? "rgba(192, 132, 252, 0.2)" : "transparent",
                                color: statusFilter.fc ? "var(--color-fc)" : "var(--text-muted)",
                                fontWeight: 700,
                            }}
                        >
                            FC
                        </button>

                        {/* Breakthrough Only Toggle */}
                        <button
                            type="button"
                            className={`btn ${onlyBreakthroughs ? "btn-primary" : "btn-outline"}`}
                            onClick={() => setOnlyBreakthroughs((prev) => !prev)}
                            style={{
                                padding: "0.35rem 0.65rem",
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                borderColor: onlyBreakthroughs ? "var(--color-cyan)" : "var(--border-color)",
                                background: onlyBreakthroughs ? "rgba(0, 242, 254, 0.2)" : "transparent",
                                color: onlyBreakthroughs ? "var(--color-cyan)" : "var(--text-muted)",
                                fontWeight: 700,
                                marginLeft: "0.2rem",
                            }}
                        >
                            <Trophy
                                size={14}
                                style={{ color: onlyBreakthroughs ? "var(--color-cyan)" : "var(--color-yellow)" }}
                            />
                        </button>
                    </div>

                    {/* Difficulty Select */}
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontWeight: 700,
                                minWidth: "40px",
                            }}
                        >
                            난이도:
                        </span>
                        <select
                            value={selectedDiff}
                            onChange={(e) => setSelectedDiff(e.target.value)}
                            style={{
                                flex: 1,
                                padding: "0.5rem 0.75rem",
                                background: "rgba(0, 0, 0, 0.4)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                fontSize: "0.85rem",
                            }}
                        >
                            <option value="all">전체 난이도</option>
                            <option value="easy">EASY</option>
                            <option value="normal">NORMAL</option>
                            <option value="hard">HARD</option>
                            <option value="expert">EXPERT</option>
                            <option value="master">MASTER</option>
                            <option value="append">APPEND</option>
                        </select>
                    </div>

                    {/* Level Range & Sort Order */}
                    <div
                        style={{
                            display: "flex",
                            gap: "0.75rem",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                            }}
                        >
                            <span style={{ fontWeight: 700 }}>레벨:</span>
                            <input
                                type="number"
                                min={5}
                                max={38}
                                value={minLevel}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setMinLevel(val === "" ? "" : Number(val));
                                }}
                                style={{
                                    width: "42px",
                                    padding: "0.25rem",
                                    textAlign: "center",
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "4px",
                                    color: "var(--text-primary)",
                                }}
                            />
                            <span>~</span>
                            <input
                                type="number"
                                min={5}
                                max={38}
                                value={maxLevel}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setMaxLevel(val === "" ? "" : Number(val));
                                }}
                                style={{
                                    width: "42px",
                                    padding: "0.25rem",
                                    textAlign: "center",
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "4px",
                                    color: "var(--text-primary)",
                                }}
                            />
                        </div>

                        {/* Sort Order Toggle */}
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                            style={{
                                padding: "0.4rem 0.75rem",
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                borderColor: "var(--border-hover)",
                                color: "var(--text-primary)",
                                fontWeight: 700,
                            }}
                            title="정렬 순서 변경"
                        >
                            <ArrowUpDown size={14} />
                            <span>{sortOrder === "desc" ? "최신순" : "오래된순"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline View */}
            {rawHistoryList.length === 0 ? (
                <div
                    className="glass-panel"
                    style={{
                        textAlign: "center",
                        padding: "5rem 2rem",
                        borderRadius: "16px",
                        color: "var(--text-muted)",
                    }}
                >
                    <Calendar size={48} style={{ opacity: 0.4, marginBottom: "1rem", color: "var(--color-cyan)" }} />
                    <h3
                        style={{
                            fontSize: "1.2rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: "0.5rem",
                        }}
                    >
                        기록된 FC / AP 달성 날짜가 없습니다
                    </h3>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                        개인 기록 탭에서 곡을 클릭하여 FC 또는 AP를 한 날짜를 기록해 보세요!
                    </p>
                    {setActiveTab && (
                        <button
                            className="btn btn-primary animate-glow"
                            onClick={() => setActiveTab("records")}
                            style={{ padding: "0.6rem 1.25rem", fontSize: "0.9rem" }}
                        >
                            개인 기록 보러가기 <ChevronRight size={16} />
                        </button>
                    )}
                </div>
            ) : filteredEvents.length === 0 ? (
                <div
                    className="glass-panel"
                    style={{
                        textAlign: "center",
                        padding: "4rem 2rem",
                        borderRadius: "16px",
                        color: "var(--text-muted)",
                    }}
                >
                    <Filter size={40} style={{ opacity: 0.4, marginBottom: "0.75rem" }} />
                    <h4
                        style={{
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: "0.25rem",
                        }}
                    >
                        조건에 매칭되는 곡이 없습니다
                    </h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        상단의 검색어 또는 필터 조건(성과, 난이도, 레벨 범위)을 변경해 보세요.
                    </p>
                </div>
            ) : (
                <div className="history-timeline-container" style={{ position: "relative", padding: "1rem 0" }}>
                    {/* Central Glowing Timeline Axis */}
                    <div className="timeline-spine" />

                    {/* Timeline Date Groups */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {groupedTimeline.map((group, index) => {
                            // Calculate date gap spacer
                            let gapSpacer = null;
                            if (index > 0) {
                                const prevGroup = groupedTimeline[index - 1];
                                const d1 = dayjs(group.date);
                                const d2 = dayjs(prevGroup.date);
                                const diffDays = Math.abs(d1.diff(d2, "day"));

                                if (diffDays > 0) {
                                    // Visual height is proportional to the square root of the days difference, clamped to avoid extremely long lines.
                                    // 24px base spacing + proportional scaling up to a max of 220px.
                                    const spacerHeight = 24 + Math.min(Math.sqrt(diffDays - 1) * 36, 196);

                                    gapSpacer = (
                                        <div
                                            className="timeline-gap-container"
                                            style={{ height: `${spacerHeight}px` }}
                                        />
                                    );
                                }
                            }

                            return (
                                <React.Fragment key={group.date}>
                                    {gapSpacer}
                                    <div className="timeline-group">
                                        {/* Spine Node Marker Dot */}
                                        <div className="timeline-marker-dot" />

                                        {/* Date Node Header */}
                                        <div className="timeline-date-header">
                                            <div className="date-pill">
                                                <Calendar size={14} />
                                                <span>{group.formattedDate}</span>
                                                <span
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        color: "var(--text-muted)",
                                                        marginLeft: "0.25rem",
                                                    }}
                                                >
                                                    • {group.items.length} Record
                                                </span>
                                            </div>
                                        </div>

                                        {/* Items in this Date Group */}
                                        <div className="timeline-group-items">
                                            {group.items.map((item) => {
                                                const isAp = item.type === "ap";
                                                const isBreakthrough = item.isBreakthrough;
                                                const breakthroughClass = isBreakthrough
                                                    ? isAp
                                                        ? "breakthrough-card-ap"
                                                        : "breakthrough-card-fc"
                                                    : "";

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`history-card glass-panel ${breakthroughClass}`}
                                                        onClick={() =>
                                                            setSelectedJacketSong &&
                                                            setSelectedJacketSong({ song: item.song, diff: item.diff })
                                                        }
                                                        style={{
                                                            padding: "0.85rem 1rem",
                                                            borderRadius: "12px",
                                                            cursor: "pointer",
                                                            transition: "all 0.25s ease",
                                                            display: "flex",
                                                            gap: "0.85rem",
                                                            alignItems: "center",
                                                            border: !isBreakthrough
                                                                ? isAp
                                                                    ? "1px solid rgba(56, 189, 248, 0.25)"
                                                                    : "1px solid rgba(192, 132, 252, 0.25)"
                                                                : undefined,
                                                            background: !isBreakthrough
                                                                ? isAp
                                                                    ? "rgba(56, 189, 248, 0.04)"
                                                                    : "rgba(192, 132, 252, 0.04)"
                                                                : undefined,
                                                            position: "relative",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {/* Jacket Image */}
                                                        <div
                                                            style={{
                                                                flexShrink: 0,
                                                                width: "52px",
                                                                height: "52px",
                                                                borderRadius: "8px",
                                                                overflow: "hidden",
                                                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                                            }}
                                                        >
                                                            <JacketImage
                                                                songId={item.song.id}
                                                                size={52}
                                                                style={{
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    objectFit: "cover",
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Song & Achievement Details */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "0.4rem",
                                                                    marginBottom: "0.25rem",
                                                                    flexWrap: "wrap",
                                                                }}
                                                            >
                                                                <span
                                                                    className={`diff-badge diff-${item.diff}`}
                                                                    style={{
                                                                        fontSize: "0.68rem",
                                                                        padding: "0.1rem 0.35rem",
                                                                    }}
                                                                >
                                                                    {diffNames[item.diff]}
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        fontSize: "0.75rem",
                                                                        fontWeight: 800,
                                                                        color: "var(--text-secondary)",
                                                                    }}
                                                                >
                                                                    Lv.{item.level}
                                                                </span>
                                                                {(item.fcConstant || item.apConstant) && (
                                                                    <span
                                                                        style={{
                                                                            fontSize: "0.72rem",
                                                                            color: "var(--text-muted)",
                                                                        }}
                                                                    >
                                                                        (
                                                                        {item.type === "ap"
                                                                            ? item.apConstant?.toFixed(1) || item.level
                                                                            : item.fcConstant?.toFixed(1) || item.level}
                                                                        )
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div
                                                                style={{
                                                                    fontSize: "0.9rem",
                                                                    fontWeight: 700,
                                                                    color: "var(--text-primary)",
                                                                    whiteSpace: "nowrap",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                }}
                                                                title={getSongTitle(item.song, settingsTitleLang)}
                                                            >
                                                                {getSongTitle(item.song, settingsTitleLang)}
                                                            </div>

                                                            <div
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    color: "var(--text-muted)",
                                                                    whiteSpace: "nowrap",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    marginTop: "0.15rem",
                                                                }}
                                                            >
                                                                {item.song.composer || "Unknown"}
                                                            </div>
                                                        </div>

                                                        {/* Achievement Badge (AP or FC) */}
                                                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                                                            <span
                                                                className={`record-status-badge status-${item.type === "ap" ? "full_perfect" : "full_combo"}`}
                                                                style={{
                                                                    fontSize: "0.8rem",
                                                                    padding: "0.3rem 0.65rem",
                                                                }}
                                                            >
                                                                {item.type === "ap" ? "AP" : "FC"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
