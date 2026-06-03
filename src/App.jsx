import React, { useState, useEffect, useMemo, useRef } from "react";
import defaultScores from "./sekai_scores.json";
import {
    Music,
    Search,
    Filter,
    Target,
    Calculator,
    Award,
    Download,
    TrendingUp,
    CheckCircle2,
    XCircle,
    Plus,
    RotateCcw,
    FileJson,
    Layers,
    Globe,
    User,
    UserCheck,
    LogOut,
    Users,
    FileUp,
    ChevronRight,
    Sparkles,
    ClipboardList,
    BarChart3,
    Menu,
    ChevronDown,
    ChevronUp,
    X,
    Settings,
} from "lucide-react";
import "./App.css";

const getRelativePercentages = (valA, valB) => {
    if (valA === 0 && valB === 0) return { pctA: 50, pctB: 50 };
    if (valA === 0) return { pctA: 0, pctB: 100 };
    if (valB === 0) return { pctA: 100, pctB: 0 };

    const diff = Math.abs(valA - valB);

    if (diff === 0) return { pctA: 50, pctB: 50 };

    // If difference is 1600 or less, treat total bar scale as 2000.
    // If difference is greater than 1600, scale the bar dynamically (diff + 400) to ensure smooth transitions.
    const scale = diff <= 1600 ? 2000 : diff + 400;
    const offset = (diff / scale) * 50;

    if (valA > valB) {
        return {
            pctA: 50 + offset,
            pctB: 50 - offset,
        };
    } else {
        return {
            pctA: 50 - offset,
            pctB: 50 + offset,
        };
    }
};

function App() {
    // --- Core States ---
    const [songs, setSongs] = useState([]);
    const [scores, setScores] = useState([]);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [dashboardSubTab, setDashboardSubTab] = useState("b39"); // b39 or b15 (append)
    const [isLoadingSongs, setIsLoadingSongs] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openMobileAccordions, setOpenMobileAccordions] = useState({ records: false, tools: false });

    // --- Auth States ---
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem("pjsk_auth");
        return saved ? JSON.parse(saved) : null;
    });
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [authUsername, setAuthUsername] = useState("");
    const [authNickname, setAuthNickname] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authError, setAuthError] = useState("");

    // --- Friends & Settings States ---
    const [friendsList, setFriendsList] = useState([]);
    const [friendInputId, setFriendInputId] = useState("");
    const [friendAddError, setFriendAddError] = useState("");
    const [friendAddSuccess, setFriendAddSuccess] = useState("");
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [showTotalLine, setShowTotalLine] = useState(true);
    const [showNormalLine, setShowNormalLine] = useState(true);
    const [showAppendLine, setShowAppendLine] = useState(true);
    const [graphRangeType, setGraphRangeType] = useState("all"); // 7d, 1m, 6m, 1y, all, custom
    const [graphCustomStart, setGraphCustomStart] = useState("");
    const [graphCustomEnd, setGraphCustomEnd] = useState("");
    const [settingsNickname, setSettingsNickname] = useState("");
    const [settingsTitleLang, setSettingsTitleLang] = useState("jp");
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState("");

    // --- Compare Tab States ---
    const [compareTargetId, setCompareTargetId] = useState("");
    const [compareData, setCompareData] = useState(null);
    const [compareError, setCompareError] = useState("");
    const [isComparing, setIsComparing] = useState(false);
    const [compareRatingType, setCompareRatingType] = useState("player"); // "player", "append", "total"
    const [compareSearch, setCompareSearch] = useState("");
    const [compareDiffFilters, setCompareDiffFilters] = useState([
        "easy",
        "normal",
        "hard",
        "expert",
        "master",
        "append",
    ]);
    const [compareResultFilter, setCompareResultFilter] = useState("all"); // "all", "win", "lose", "draw"
    const [compareMinLevel, setCompareMinLevel] = useState("");
    const [compareMaxLevel, setCompareMaxLevel] = useState("");
    const [compareSortBy, setCompareSortBy] = useState("level"); // "level", "gap", "title", "ratingA", "ratingB"
    const [compareSortOrder, setCompareSortOrder] = useState("desc"); // "asc", "desc"

    // --- Record Table States ---
    const [recordSearch, setRecordSearch] = useState("");
    const [recordDiffFilters, setRecordDiffFilters] = useState([
        "easy",
        "normal",
        "hard",
        "expert",
        "master",
        "append",
    ]);
    const [recordPlayFilters, setRecordPlayFilters] = useState(["unplayed", "played", "fc", "ap"]);
    const [recordMinFcConstInput, setRecordMinFcConstInput] = useState("");
    const [recordMaxFcConstInput, setRecordMaxFcConstInput] = useState("");
    const [recordMinApConstInput, setRecordMinApConstInput] = useState("");
    const [recordMaxApConstInput, setRecordMaxApConstInput] = useState("");
    const [recordMinLevel, setRecordMinLevel] = useState("");
    const [recordMaxLevel, setRecordMaxLevel] = useState("");
    const [recordSortBy, setRecordSortBy] = useState("level"); // title, status, level, constant
    const [recordSortOrder, setRecordSortOrder] = useState("desc"); // asc, desc

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

    const handleJacketClick = (songId, diff, currentStatus) => {
        const statusCycle = ["none", "clear", "full_combo", "full_perfect"];
        const currentIndex = statusCycle.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % statusCycle.length;
        const nextStatus = statusCycle[nextIndex];
        handleScoreChange(songId, diff, nextStatus);
    };

    // --- Constant Table States (리뉴얼) ---
    const [constSearch, setConstSearch] = useState("");
    // Checkboxes for multiple selections
    const [constDiffFilters, setConstDiffFilters] = useState(["master"]); // Easy, Normal, Hard, Expert, Master, Append 복합
    const [constPlayFilters, setConstPlayFilters] = useState(["unplayed", "played", "fc", "ap"]); // 복합
    // Text numerical inputs for constants
    const [constMinLevelInput, setConstMinLevelInput] = useState("");
    const [constMaxLevelInput, setConstMaxLevelInput] = useState("");
    const [constMinLevel, setConstMinLevel] = useState("");
    const [constMaxLevel, setConstMaxLevel] = useState("");
    const [constType, setConstType] = useState("fc"); // "fc", "ap"

    // --- Tour Guide States ---
    const [tourDiffs, setTourDiffs] = useState(["master"]);
    const [tourMinLevel, setTourMinLevel] = useState(30);
    const [tourMaxLevel, setTourMaxLevel] = useState(30);
    const [tourGoal, setTourGoal] = useState("fc");

    // --- Calculator States ---
    const [calcSongSearch, setCalcSongSearch] = useState("");
    const [calcSelectedSong, setCalcSelectedSong] = useState(null);
    const [calcDiff, setCalcDiff] = useState("master");
    const [calcGoal, setCalcGoal] = useState("full_perfect");
    const [showCalcDropdown, setShowCalcDropdown] = useState(false);

    // --- Distribution Tab States ---
    const [distTab, setDistTab] = useState("level"); // level, constant, diff, unit
    const [distDiffs, setDistDiffs] = useState(["master", "expert", "append"]);
    const [distMinLevelInput, setDistMinLevelInput] = useState("");
    const [distMaxLevelInput, setDistMaxLevelInput] = useState("");
    const [distMinConstInput, setDistMinConstInput] = useState("");
    const [distMaxConstInput, setDistMaxConstInput] = useState("");
    const [distDisplayType, setDistDisplayType] = useState("count"); // count, percent

    // --- Import Preview Modal States ---
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [pendingImportScores, setPendingImportScores] = useState(null);
    const [previewCalculatedData, setPreviewCalculatedData] = useState(null);

    const fileInputRef = useRef(null);

    // --- Fetch Songs from Server DB ---
    const fetchSongsFromServer = async () => {
        setIsLoadingSongs(true);
        let loaded = false;
        try {
            const res = await fetch("/api/songs");
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    setSongs(data);
                    loaded = true;
                }
            }
        } catch (e) {
            console.warn("Could not fetch songs from server, trying static JSON fallback.", e);
        }

        if (!loaded) {
            try {
                const res = await fetch("/songs_data.json");
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setSongs(data);
                    }
                }
            } catch (e) {
                console.error("Failed to load songs from static JSON fallback.", e);
            }
        }
        setIsLoadingSongs(false);
    };

    useEffect(() => {
        fetchSongsFromServer();
    }, []);

    // --- Fetch User Scores from Server ---
    const fetchScoresFromServer = async (username) => {
        try {
            const res = await fetch(`/api/scores/user/${username}`);
            if (res.ok) {
                const data = await res.json();
                if (data.scores) {
                    setScores(data.scores);
                    localStorage.setItem("pjsk_user_scores", JSON.stringify(data.scores));
                }
            }
        } catch (e) {
            console.error("Error fetching user scores from server:", e);
        }
    };

    // --- Fetch Friends List ---
    const fetchFriendsList = async (username) => {
        try {
            const res = await fetch(`/api/friends/list/${username}`);
            if (res.ok) {
                const data = await res.json();
                setFriendsList(data);
            }
        } catch (e) {
            console.error("Error fetching friends list:", e);
        }
    };

    // --- Sync local scores to server ---
    const syncScoresToServer = async (userObj, currentScores, ratingObj) => {
        if (!userObj) return;

        let ratings = ratingObj;
        if (!ratings) {
            const tempCalc = calculateTempRatings(currentScores);
            ratings = {
                normal: tempCalc.playerRating,
                append: tempCalc.playerAppendRating,
            };
        }

        try {
            const res = await fetch("/api/scores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: userObj.username,
                    scores: currentScores,
                    rating: ratings,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.rating_history) {
                    const updatedUser = {
                        ...userObj,
                        rating_history: data.rating_history,
                    };
                    setCurrentUser(updatedUser);
                    localStorage.setItem("pjsk_auth", JSON.stringify(updatedUser));
                }
            }
        } catch (e) {
            console.error("Failed to auto-save scores to server:", e);
        }
    };

    // --- Auto Login Session Recovery & Initialization ---
    useEffect(() => {
        const initAuth = async () => {
            const saved = localStorage.getItem("pjsk_auth");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.token) {
                        const res = await fetch(`/api/auth/me?token=${parsed.token}`);
                        if (res.ok) {
                            const data = await res.json();
                            const userObj = {
                                username: data.user.username,
                                nickname: data.user.nickname,
                                token: parsed.token,
                                friends: data.user.friends || [],
                                settings: data.user.settings || { songTitleLang: "jp" },
                                rating_history: data.user.rating_history || {},
                            };
                            setCurrentUser(userObj);
                            setScores(data.user.scores || []);
                            localStorage.setItem("pjsk_user_scores", JSON.stringify(data.user.scores || []));
                            setSettingsNickname(data.user.nickname);
                            setSettingsTitleLang(data.user.settings?.songTitleLang || "jp");
                            fetchFriendsList(data.user.username);
                        } else {
                            // Invalid token
                            setCurrentUser(null);
                            localStorage.removeItem("pjsk_auth");
                            localStorage.removeItem("pjsk_user_scores");
                            setScores([]);
                        }
                    }
                } catch (e) {
                    console.error("Failed to verify auto login session:", e);
                }
            }
        };
        initAuth();
    }, []);

    // Load user scores & details when currentUser changes (e.g. login/register)
    useEffect(() => {
        if (currentUser) {
            fetchScoresFromServer(currentUser.username);
            fetchFriendsList(currentUser.username);
            setSettingsNickname(currentUser.nickname);
            setSettingsTitleLang(currentUser.settings?.songTitleLang || "jp");
        } else {
            const saved = localStorage.getItem("pjsk_user_scores");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const isDemo =
                        parsed &&
                        parsed.length > 0 &&
                        defaultScores &&
                        defaultScores.scores &&
                        parsed.length === defaultScores.scores.length &&
                        parsed[0] &&
                        defaultScores.scores[0] &&
                        parsed[0].id === defaultScores.scores[0].id;

                    if (isDemo) {
                        localStorage.removeItem("pjsk_user_scores");
                        setScores([]);
                    } else {
                        setScores(parsed);
                    }
                } catch (e) {
                    console.error(e);
                    setScores([]);
                }
            } else {
                setScores([]);
            }
            setFriendsList([]);
        }
    }, [currentUser]);

    const updateScores = (newScores) => {
        setScores(newScores);
        localStorage.setItem("pjsk_user_scores", JSON.stringify(newScores));
        if (currentUser) {
            const tempCalc = calculateTempRatings(newScores);
            const ratingObj = {
                normal: tempCalc.playerRating,
                append: tempCalc.playerAppendRating,
            };
            syncScoresToServer(currentUser, newScores, ratingObj);
        }
    };

    // --- Song Title Localization Helper ---
    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    // --- Rating Trend Graph Renderer ---
    const dailyRatingHistoryData = useMemo(() => {
        if (!currentUser || !currentUser.rating_history) return [];
        const history = currentUser.rating_history;
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
    }, [currentUser]);

    const renderRatingGraph = () => {
        if (!currentUser) {
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

        if (dailyRatingHistoryData.length === 0) {
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
                    📈 등록된 레이팅 히스토리가 없습니다. 기록 저장 시 그래프가 생성됩니다.
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

        // 1. Compute visual X scale time limits (all aligned to UTC midnight timestamps)
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
                : Math.min(...dailyRatingHistoryData.map((d) => new Date(d.date + "T00:00:00Z").getTime()));
            maxTime = graphCustomEnd
                ? new Date(graphCustomEnd + "T00:00:00Z").getTime()
                : Math.max(...dailyRatingHistoryData.map((d) => new Date(d.date + "T00:00:00Z").getTime()));
        } else {
            // "all"
            const times = dailyRatingHistoryData.map((d) => new Date(d.date + "T00:00:00Z").getTime());
            minTime = Math.min(...times);
            maxTime = todayUTCMs; // Show up to today (Seoul date)
        }

        const timeRange = maxTime - minTime || 1;

        // 2. Filter data in range and construct step boundaries (prepend / append virtual points)
        const insidePoints = dailyRatingHistoryData.filter((d) => {
            const t = new Date(d.date + "T00:00:00Z").getTime();
            return t >= minTime && t <= maxTime;
        });

        const beforePoints = dailyRatingHistoryData.filter((d) => {
            const t = new Date(d.date + "T00:00:00Z").getTime();
            return t < minTime;
        });
        const lastPointBefore = beforePoints.length > 0 ? beforePoints[beforePoints.length - 1] : null;

        // Format timestamp to YYYY-MM-DD string in UTC
        const formatDate = (ms) => {
            const d = new Date(ms);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, "0");
            const day = String(d.getUTCDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        let activeDataList = [...insidePoints];
        if (lastPointBefore) {
            // Prepend virtual starting point at the left edge of the chart (minTime)
            // with the values carrying over from the latest point before the window.
            const hasStart = activeDataList.some((p) => new Date(p.date + "T00:00:00Z").getTime() === minTime);
            if (!hasStart) {
                activeDataList.unshift({
                    date: formatDate(minTime),
                    normal: lastPointBefore.normal,
                    append: lastPointBefore.append,
                    total: lastPointBefore.total,
                    isVirtual: true,
                });
            }
        }

        if (activeDataList.length > 0) {
            const latest = activeDataList[activeDataList.length - 1];
            const latestTime = new Date(latest.date + "T00:00:00Z").getTime();
            if (latestTime < maxTime) {
                // Append virtual ending point at the right edge of the chart (maxTime / today)
                // to maintain the latest rating state until today.
                activeDataList.push({
                    date: formatDate(maxTime),
                    normal: latest.normal,
                    append: latest.append,
                    total: latest.total,
                    isVirtual: true,
                });
            }
        }

        // Render message if no records fall in or before selected range
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

        // 3. Compute visual Y scale limits
        const totals = showTotalLine ? activeDataList.map((d) => d.total) : [];
        const normals = showNormalLine ? activeDataList.map((d) => d.normal) : [];
        const appends = showAppendLine ? activeDataList.map((d) => d.append) : [];
        const allVals = [...totals, ...normals, ...appends].filter((v) => v > 0);

        const maxVal = allVals.length > 0 ? Math.max(...allVals) : 10000;
        const minVal = allVals.length > 0 ? Math.min(...allVals) : 0;
        const range = maxVal - minVal;

        const yMin = range === 0 ? minVal - 50 : minVal - Math.max(30, Math.round(range * 0.05));
        const yMax = range === 0 ? maxVal + 50 : maxVal + Math.max(30, Math.round(range * 0.05));
        const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

        // 4. Map data points to SVG coordinates
        const points = activeDataList.map((d) => {
            const t = new Date(d.date + "T00:00:00Z").getTime();
            const x = paddingX + ((t - minTime) / timeRange) * (width - 2 * paddingX);
            const yTotal = height - paddingY - (((d.total || 0) - yMin) / yRange) * (height - 2 * paddingY);
            const yNormal = height - paddingY - (((d.normal || 0) - yMin) / yRange) * (height - 2 * paddingY);
            const yAppend =
                d.append > 0
                    ? height - paddingY - (((d.append || 0) - yMin) / yRange) * (height - 2 * paddingY)
                    : height - paddingY;
            return { x, yTotal, yNormal, yAppend, ...d };
        });

        // 5. Draw step-after paths instead of straight diagonals
        let linePathTotal = "";
        let linePathNormal = "";
        let linePathAppend = "";

        if (points.length > 0) {
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

        const areaPathTotal =
            points.length > 1 && linePathTotal
                ? `${linePathTotal} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
                : "";

        // Compute timeline grid ticks
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
                    </defs>

                    {/* Legend with click triggers */}
                    <g transform={`translate(${paddingX}, 12)`} fontSize="9" fontWeight="700">
                        <g
                            style={{ cursor: "pointer", opacity: showTotalLine ? 1 : 0.4, transition: "opacity 0.2s" }}
                            onClick={() => setShowTotalLine(!showTotalLine)}
                        >
                            <circle cx="5" cy="5" r="4" fill="#fbbf24" />
                            <text x="15" y="8" fill="var(--text-primary)">
                                Total R
                            </text>
                        </g>

                        <g
                            style={{ cursor: "pointer", opacity: showNormalLine ? 1 : 0.4, transition: "opacity 0.2s" }}
                            onClick={() => setShowNormalLine(!showNormalLine)}
                        >
                            <circle cx="85" cy="5" r="4" fill="#22d3ee" />
                            <text x="95" y="8" fill="var(--text-primary)">
                                Player R
                            </text>
                        </g>

                        <g
                            style={{ cursor: "pointer", opacity: showAppendLine ? 1 : 0.4, transition: "opacity 0.2s" }}
                            onClick={() => setShowAppendLine(!showAppendLine)}
                        >
                            <circle cx="165" cy="5" r="4" fill="#f472b6" />
                            <text x="175" y="8" fill="var(--text-primary)">
                                Append R
                            </text>
                        </g>
                    </g>

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
                    {showTotalLine && areaPathTotal && <path d={areaPathTotal} fill="url(#areaGrad)" />}
                    {showAppendLine && linePathAppend && (
                        <path
                            d={linePathAppend}
                            fill="none"
                            stroke="url(#appendLineGrad)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {showNormalLine && linePathNormal && (
                        <path
                            d={linePathNormal}
                            fill="none"
                            stroke="url(#normalLineGrad)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {showTotalLine && linePathTotal && (
                        <path
                            d={linePathTotal}
                            fill="none"
                            stroke="url(#totalLineGrad)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}

                    {/* Dynamic Hover Highlights */}
                    {hoveredPoint && (
                        <g>
                            {/* Vertical hover guide line */}
                            <line
                                x1={hoveredPoint.x}
                                y1={paddingY}
                                x2={hoveredPoint.x}
                                y2={height - paddingY}
                                stroke="rgba(255, 255, 255, 0.15)"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                            />
                            {/* Highlighted dots on hovered point values */}
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
                        </g>
                    )}

                    {/* Invisible vertical hover column bars */}
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

                    {/* Y-axis labels */}
                    <text
                        x={paddingX - 8}
                        y={paddingY + 3}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="end"
                        fontWeight="600"
                    >
                        {Math.round(yMax)}
                    </text>
                    <text
                        x={paddingX - 8}
                        y={(height - paddingY * 2) / 2 + paddingY + 3}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="end"
                        fontWeight="600"
                    >
                        {Math.round((yMax + yMin) / 2)}
                    </text>
                    <text
                        x={paddingX - 8}
                        y={height - paddingY + 3}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="end"
                        fontWeight="600"
                    >
                        {Math.round(yMin)}
                    </text>
                </svg>

                {/* Graph tooltip */}
                {hoveredPoint && (
                    <div
                        style={{
                            position: "absolute",
                            left: `${(hoveredPoint.x / width) * 100}%`,
                            top: `${((showTotalLine ? hoveredPoint.yTotal : showNormalLine ? hoveredPoint.yNormal : hoveredPoint.yAppend) / height) * 100 - 15}%`,
                            transform: "translate(-50%, -100%)",
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
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                            {hoveredPoint.date}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", textAlign: "left" }}>
                            {showTotalLine && (
                                <div style={{ fontWeight: "800", color: "#fbbf24" }}>
                                    Total R: {Math.round(hoveredPoint.total)}
                                </div>
                            )}
                            {showNormalLine && (
                                <div style={{ fontSize: "0.7rem", color: "#22d3ee", fontWeight: "700" }}>
                                    Player R: {Math.round(hoveredPoint.normal)}
                                </div>
                            )}
                            {showAppendLine && (
                                <div style={{ fontSize: "0.7rem", color: "#f472b6", fontWeight: "700" }}>
                                    Append R: {Math.round(hoveredPoint.append)}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderGraphControls = () => {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                {/* Range Preset Buttons */}
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
                            className={`btn btn-outline`}
                            style={{
                                padding: "0.25rem 0.6rem",
                                fontSize: "0.8rem",
                                borderRadius: "6px",
                                borderColor: graphRangeType === btn.id ? "var(--color-cyan)" : "var(--border-color)",
                                background: graphRangeType === btn.id ? "rgba(0, 242, 254, 0.08)" : "transparent",
                                color: graphRangeType === btn.id ? "var(--color-cyan)" : "var(--text-secondary)",
                            }}
                            onClick={() => setGraphRangeType(btn.id)}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Custom Date Inputs (Conditional) */}
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

    // --- Friend Management Handlers ---
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
                headers: { "Content-Type": "application/json" },
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

    const handleRemoveFriend = async (friendUsername) => {
        if (!currentUser) return;
        if (!window.confirm(`${friendUsername}님을 친구 목록에서 삭제하시겠습니까?`)) return;

        try {
            const res = await fetch("/api/friends/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    // --- Profile & Settings Saver Handler ---
    const handleSaveSettings = async (newNickname, newTitleLang) => {
        const nicknameToSave = newNickname !== undefined ? newNickname : settingsNickname;
        const langToSave = newTitleLang !== undefined ? newTitleLang : settingsTitleLang;

        if (!currentUser) {
            setSettingsMessage("⚠ 로그인 세션이 없습니다.");
            return;
        }

        if (!nicknameToSave.trim()) {
            setSettingsMessage("⚠ 닉네임은 비워둘 수 없습니다.");
            return;
        }

        setSettingsMessage("");
        setIsSavingSettings(true);

        try {
            const settingsObj = {
                songTitleLang: langToSave,
            };
            const res = await fetch("/api/user/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: currentUser.username,
                    nickname: nicknameToSave.trim(),
                    settings: settingsObj,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                // Update local auth state
                const updatedUser = {
                    ...currentUser,
                    nickname: data.nickname,
                    settings: data.settings,
                };
                setCurrentUser(updatedUser);
                localStorage.setItem("pjsk_auth", JSON.stringify(updatedUser));
            } else {
                setSettingsMessage(`⚠ ${data.error || "설정 저장 실패"}`);
            }
        } catch (err) {
            setSettingsMessage("⚠ 서버 연결 실패");
        } finally {
            setIsSavingSettings(false);
        }
    };

    // --- Auth Handlers ---
    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError("");

        if (!authUsername || !authPassword || (isRegisterMode && !authNickname)) {
            setAuthError("모든 정보를 정확하게 입력해 주세요.");
            return;
        }

        const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
        const payload = isRegisterMode
            ? { username: authUsername, nickname: authNickname, password: authPassword }
            : { username: authUsername, password: authPassword };

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                setAuthError(data.error || "인증 처리에 실패했습니다.");
                return;
            }

            if (isRegisterMode) {
                alert("회원가입이 완료되었습니다! 로그인 창으로 전환합니다.");
                setIsRegisterMode(false);
                setAuthPassword("");
            } else {
                const userObj = {
                    username: data.user.username,
                    nickname: data.user.nickname,
                    token: data.token,
                    friends: data.user.friends || [],
                    settings: data.user.settings || { songTitleLang: "jp" },
                    rating_history: data.user.rating_history || {},
                };
                setCurrentUser(userObj);
                localStorage.setItem("pjsk_auth", JSON.stringify(userObj));

                const localRec = localStorage.getItem("pjsk_user_scores");
                if (localRec) {
                    const parsed = JSON.parse(localRec);
                    if (parsed && parsed.length > 0) {
                        await syncScoresToServer(userObj, parsed);
                    }
                }

                setShowAuthModal(false);
                resetAuthForm();
            }
        } catch (err) {
            setAuthError("서버와의 통신에 실패했습니다.");
        }
    };

    const handleLogout = () => {
        if (window.confirm("로그아웃 하시겠습니까?")) {
            setCurrentUser(null);
            localStorage.removeItem("pjsk_auth");
            localStorage.removeItem("pjsk_user_scores");
            setScores([]);
        }
    };

    const resetAuthForm = () => {
        setAuthUsername("");
        setAuthNickname("");
        setAuthPassword("");
        setAuthError("");
    };

    // --- Compare Action ---
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

    // --- Score mapping helper ---
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

    // --- Jacket Image Component ---
    const JacketImage = ({ songId, size = 50, className = "", style = {} }) => {
        const [imgSrc, setImgSrc] = useState(`/api/jackets/${songId}`);
        const [failed, setFailed] = useState(false);

        useEffect(() => {
            setImgSrc(`/api/jackets/${songId}`);
            setFailed(false);
        }, [songId]);

        if (failed) {
            return (
                <div
                    className={className}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: "8px",
                        background: "linear-gradient(135deg, rgba(255,0,127,0.15), rgba(0,242,254,0.15))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--border-color)",
                        ...style,
                    }}
                >
                    <Music size={size * 0.4} style={{ color: "var(--color-cyan)" }} />
                </div>
            );
        }

        return (
            <img
                src={imgSrc}
                alt="Jacket"
                onError={() => setFailed(true)}
                className={className}
                style={{
                    width: size,
                    height: size,
                    borderRadius: "8px",
                    objectFit: "cover",
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                    ...style,
                }}
            />
        );
    };

    // --- Rating Calculation Core Logic ---
    const calculateRating = (song, diff, status) => {
        if (!status || status === "none") return 0;

        let multiplier = 0;
        if (status === "full_perfect") multiplier = 8.0;
        else if (status === "full_combo") multiplier = 7.5;
        else if (status === "clear") multiplier = 5.0;
        else return 0;

        let levelConst = song.levels[diff] || 0;
        if (song.constants) {
            const apKey = `${diff}_ap`;
            const fcKey = `${diff}_fc`;

            if (song.constants[diff] !== undefined && song.constants[diff] !== null) {
                levelConst = song.constants[diff];
            } else if (status === "full_perfect") {
                if (song.constants[apKey] !== undefined && song.constants[apKey] !== null) {
                    levelConst = song.constants[apKey];
                } else {
                    levelConst = song.levels[diff] || 0;
                }
            } else if (status === "full_combo") {
                if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
                    levelConst = song.constants[fcKey];
                } else {
                    levelConst = song.levels[diff] || 0;
                }
            } else {
                if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
                    levelConst = song.constants[fcKey];
                } else {
                    levelConst = song.levels[diff] || 0;
                }
            }
        }

        return Math.round(multiplier * levelConst);
    };

    const hasExplicitConstant = (song, diff, status) => {
        if (!song.constants) return false;
        const apKey = `${diff}_ap`;
        const fcKey = `${diff}_fc`;

        if (song.constants[diff] !== undefined && song.constants[diff] !== null) {
            return true;
        }
        if (status === "full_perfect" || status === "ap") {
            return song.constants[apKey] !== undefined && song.constants[apKey] !== null;
        }
        if (status === "full_combo" || status === "fc") {
            return song.constants[fcKey] !== undefined && song.constants[fcKey] !== null;
        }
        return false;
    };

    const getConstant = (song, diff, status) => {
        let levelConst = song.levels[diff] || 0;
        if (song.constants) {
            const apKey = `${diff}_ap`;
            const fcKey = `${diff}_fc`;

            if (song.constants[diff] !== undefined && song.constants[diff] !== null) {
                return song.constants[diff];
            } else if (status === "full_perfect" || status === "ap") {
                if (song.constants[apKey] !== undefined && song.constants[apKey] !== null) {
                    return song.constants[apKey];
                }
                return song.levels[diff] || 0;
            } else if (status === "full_combo" || status === "fc") {
                if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
                    return song.constants[fcKey];
                }
                return song.levels[diff] || 0;
            } else {
                if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
                    return song.constants[fcKey];
                }
                return song.levels[diff] || 0;
            }
        }
        return levelConst;
    };

    // --- Compute All Play Ratings (B39 - EXCLUDING APPEND!) ---
    const allRatings = useMemo(() => {
        const list = [];
        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id));
            if (!userPlay) return;

            // EXCLUDING APPEND!
            const difficulties = ["easy", "normal", "hard", "expert", "master"];
            difficulties.forEach((diff) => {
                const status = userPlay[diff];
                if (status && status !== "none") {
                    const rating = calculateRating(song, diff, status);
                    if (rating > 0) {
                        list.push({
                            song,
                            diff,
                            status,
                            level: song.levels[diff],
                            constant: getConstant(song, diff, status),
                            hasConstant: hasExplicitConstant(song, diff, status),
                            rating,
                        });
                    }
                }
            });
        });

        return list.sort((a, b) => b.rating - a.rating);
    }, [userScoresMap, songs]);

    // --- Top 39 (B39) & Player R ---
    const b39List = useMemo(() => {
        return allRatings.slice(0, 39);
    }, [allRatings]);

    const playerRating = useMemo(() => {
        const sum = b39List.reduce((acc, curr) => acc + curr.rating, 0);
        return Math.round(sum);
    }, [b39List]);

    // --- Compute Append Ratings (B15 - ONLY APPEND!) ---
    const appendRatings = useMemo(() => {
        const list = [];
        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id));
            if (!userPlay) return;

            const status = userPlay.append;
            if (status && status !== "none") {
                const rating = calculateRating(song, "append", status);
                if (rating > 0) {
                    list.push({
                        song,
                        diff: "append",
                        status,
                        level: song.levels.append,
                        constant: getConstant(song, "append", status),
                        hasConstant: hasExplicitConstant(song, "append", status),
                        rating,
                    });
                }
            }
        });

        return list.sort((a, b) => b.rating - a.rating);
    }, [userScoresMap, songs]);

    const appendB15List = useMemo(() => {
        return appendRatings.slice(0, 15);
    }, [appendRatings]);

    // Append R = sum(B15) * 2.6
    const playerAppendRating = useMemo(() => {
        const sum = appendB15List.reduce((acc, curr) => acc + curr.rating, 0);
        return Math.round(sum * 2.6);
    }, [appendB15List]);

    // --- Overall stats ---
    const overallStats = useMemo(() => {
        let totalPlayed = 0;
        let apCount = 0;
        let fcCount = 0;
        let clearCount = 0;

        scores.forEach((s) => {
            const diffs = ["easy", "normal", "hard", "expert", "master", "append"];
            diffs.forEach((d) => {
                if (s[d]) {
                    totalPlayed++;
                    if (s[d] === "full_perfect") apCount++;
                    else if (s[d] === "full_combo") fcCount++;
                    else if (s[d] === "clear") clearCount++;
                }
            });
        });

        return { totalPlayed, apCount, fcCount, clearCount };
    }, [scores]);

    // --- Compare Page Computations ---
    const compareResults = useMemo(() => {
        if (!compareData) return null;

        const computeUserB39 = (userScores) => {
            const uScoresMap = new Map();
            userScores.forEach((s) => {
                if (s && s.id) uScoresMap.set(String(s.id), s);
            });

            const list = [];
            const appendList = [];
            songs.forEach((song) => {
                const play = uScoresMap.get(String(song.id));
                if (!play) return;

                // B39 excludes append
                ["easy", "normal", "hard", "expert", "master"].forEach((diff) => {
                    const status = play[diff];
                    if (status && status !== "none") {
                        const rating = calculateRating(song, diff, status);
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

                // Append rating calculation
                const appendStatus = play["append"];
                if (appendStatus && appendStatus !== "none") {
                    const rating = calculateRating(song, "append", appendStatus);
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
            const sum = Math.round(b39.reduce((acc, curr) => acc + curr.rating, 0));

            const appendSorted = appendList.sort((a, b) => b.rating - a.rating);
            const b15 = appendSorted.slice(0, 15);
            const appendSum = Math.round(b15.reduce((acc, curr) => acc + curr.rating, 0) * 2.6);
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

            return { b39, sum, b15, appendSum, totalSum, ap, fc, clr };
        };

        const resA = computeUserB39(compareData.userA.scores);
        const resB = computeUserB39(compareData.userB.scores);

        const mapA = new Map(
            compareData.userA.scores.filter((s) => s && s.id).map((s) => [String(s.id), s])
        );
        const mapB = new Map(
            compareData.userB.scores.filter((s) => s && s.id).map((s) => [String(s.id), s])
        );

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
                        ratingA: statA ? calculateRating(song, diff, statA) : 0,
                        ratingB: statB ? calculateRating(song, diff, statB) : 0,
                    });
                }
            });
        });

        commonList.sort((a, b) => b.level - a.level);

        return { resA, resB, commonList };
    }, [compareData, songs]);

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
                const gap = parseFloat((item.ratingA - item.ratingB).toFixed(1));
                if (compareResultFilter === "win") return gap > 0;
                if (compareResultFilter === "lose") return gap < 0;
                if (compareResultFilter === "draw") return gap === 0;
                return true;
            });
        }

        // 5. Sorting
        list.sort((a, b) => {
            let valA, valB;
            if (compareSortBy === "level") {
                valA = a.level;
                valB = b.level;
            } else if (compareSortBy === "gap") {
                const tierMap = { full_perfect: 3, full_combo: 2, clear: 1, none: 0 };
                const tierDiffA = (tierMap[a.statA] || 0) - (tierMap[a.statB] || 0);
                const tierDiffB = (tierMap[b.statA] || 0) - (tierMap[b.statB] || 0);

                if (tierDiffA !== tierDiffB) {
                    valA = tierDiffA;
                    valB = tierDiffB;
                } else {
                    valA = a.ratingA - a.ratingB;
                    valB = b.ratingA - b.ratingB;
                }
            } else if (compareSortBy === "title") {
                valA = getSongTitle(a.song);
                valB = getSongTitle(b.song);
            } else if (compareSortBy === "ratingA") {
                valA = a.ratingA;
                valB = b.ratingA;
            } else if (compareSortBy === "ratingB") {
                valA = a.ratingB;
                valB = b.ratingB;
            }

            if (typeof valA === "string") {
                return compareSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return compareSortOrder === "asc" ? valA - valB : valB - valA;
            }
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
    ]);

    // --- Helper to calculate Ratings on the fly for imports ---
    const calculateTempRatings = (newScoresList) => {
        const tempMap = new Map();
        newScoresList.forEach((s) => {
            if (s && s.id) {
                tempMap.set(s.id, {
                    easy: s.easy,
                    normal: s.normal,
                    hard: s.hard,
                    expert: s.expert,
                    master: s.master,
                    append: s.append,
                });
            }
        });

        const tempAllRatings = [];
        songs.forEach((song) => {
            const userPlay = tempMap.get(song.id);
            if (!userPlay) return;

            const difficulties = ["easy", "normal", "hard", "expert", "master"];
            difficulties.forEach((diff) => {
                const status = userPlay[diff];
                if (status && status !== "none") {
                    const rating = calculateRating(song, diff, status);
                    if (rating > 0) {
                        tempAllRatings.push({
                            rating,
                        });
                    }
                }
            });
        });
        tempAllRatings.sort((a, b) => b.rating - a.rating);
        const tempB39List = tempAllRatings.slice(0, 39);
        const tempPlayerRating = Math.round(tempB39List.reduce((acc, curr) => acc + curr.rating, 0));

        const tempAppendRatings = [];
        songs.forEach((song) => {
            const userPlay = tempMap.get(song.id);
            if (!userPlay) return;

            const status = userPlay.append;
            if (status && status !== "none") {
                const rating = calculateRating(song, "append", status);
                if (rating > 0) {
                    tempAppendRatings.push({
                        rating,
                    });
                }
            }
        });
        tempAppendRatings.sort((a, b) => b.rating - a.rating);
        const tempB15List = tempAppendRatings.slice(0, 15);
        const tempPlayerAppendRating = Math.round(tempB15List.reduce((acc, curr) => acc + curr.rating, 0) * 2.6);

        let tempTotalPlayed = 0;
        let tempApCount = 0;
        let tempFcCount = 0;
        let tempClearCount = 0;

        newScoresList.forEach((s) => {
            const diffs = ["easy", "normal", "hard", "expert", "master", "append"];
            diffs.forEach((d) => {
                if (s[d]) {
                    tempTotalPlayed++;
                    if (s[d] === "full_perfect") tempApCount++;
                    else if (s[d] === "full_combo") tempFcCount++;
                    else if (s[d] === "clear") tempClearCount++;
                }
            });
        });

        return {
            playerRating: tempPlayerRating,
            playerAppendRating: tempPlayerAppendRating,
            stats: {
                totalPlayed: tempTotalPlayed,
                apCount: tempApCount,
                fcCount: tempFcCount,
                clearCount: tempClearCount,
            },
        };
    };

    // --- Delta rendering helper inside component ---
    const renderDelta = (delta, small = false) => {
        if (delta > 0) {
            return (
                <span
                    style={{ fontSize: small ? "0.75rem" : "0.85rem", color: "var(--color-success)", fontWeight: 700 }}
                >
                    ▲ +{delta}
                </span>
            );
        } else if (delta < 0) {
            return (
                <span
                    style={{ fontSize: small ? "0.75rem" : "0.85rem", color: "var(--color-danger)", fontWeight: 700 }}
                >
                    ▼ {delta}
                </span>
            );
        }
        return (
            <span style={{ fontSize: small ? "0.75rem" : "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                0
            </span>
        );
    };

    // --- Handle Custom File Upload ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const newScores = data.scores || (Array.isArray(data) ? data : null);

                if (newScores && Array.isArray(newScores)) {
                    const calculated = calculateTempRatings(newScores);
                    setPendingImportScores(newScores);
                    setPreviewCalculatedData(calculated);
                    setShowImportPreview(true);

                    // Reset input
                    e.target.value = "";
                } else {
                    alert("올바르지 않은 JSON 파일입니다.");
                }
            } catch (err) {
                alert("JSON 파싱 에러.");
            }
        };
        reader.readAsText(file);
    };

    const confirmImport = () => {
        if (pendingImportScores) {
            updateScores(pendingImportScores);
            setShowImportPreview(false);
            setPendingImportScores(null);
            setPreviewCalculatedData(null);
        }
    };

    const cancelImport = () => {
        setShowImportPreview(false);
        setPendingImportScores(null);
        setPreviewCalculatedData(null);
    };

    // --- Handle Custom File Download ---
    const handleFileDownload = () => {
        if (!songs || songs.length === 0) {
            alert("곡 데이터가 로드되지 않았습니다.");
            return;
        }

        // Fast lookup map for user's play records
        const scoreMap = new Map();
        if (scores && Array.isArray(scores)) {
            scores.forEach((s) => {
                if (s && s.id) {
                    scoreMap.set(String(s.id), s);
                }
            });
        }

        // Helper to convert internal 'none' string to pure null for clean JSON export
        const sanitizeValue = (val) => {
            if (val === undefined || val === null || val === "none" || val === "") return null;
            return val;
        };

        // Construct a structured list containing ALL loaded songs mapped with records
        const completeScores = songs.map((song) => {
            const playRecord = scoreMap.get(String(song.id));
            return {
                id: String(song.id),
                title_jp: song.title_jp || song.title_ko || "",
                easy: playRecord ? sanitizeValue(playRecord.easy) : null,
                normal: playRecord ? sanitizeValue(playRecord.normal) : null,
                hard: playRecord ? sanitizeValue(playRecord.hard) : null,
                expert: playRecord ? sanitizeValue(playRecord.expert) : null,
                master: playRecord ? sanitizeValue(playRecord.master) : null,
                append: playRecord ? sanitizeValue(playRecord.append) : null,
            };
        });

        const exportData = {
            version: 2,
            exportedAt: new Date().toISOString(),
            scores: completeScores,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "sekai_scores.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    // --- Constant Table Filter Checkbox Handler Helpers ---
    const handleDiffFilterToggle = (diff) => {
        if (constDiffFilters.includes(diff)) {
            if (constDiffFilters.length > 1) {
                setConstDiffFilters(constDiffFilters.filter((d) => d !== diff));
            }
        } else {
            setConstDiffFilters([...constDiffFilters, diff]);
        }
    };

    const handlePlayFilterToggle = (playStatus) => {
        if (constPlayFilters.includes(playStatus)) {
            if (constPlayFilters.length > 1) {
                setConstPlayFilters(constPlayFilters.filter((p) => p !== playStatus));
            }
        } else {
            setConstPlayFilters([...constPlayFilters, playStatus]);
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

                const rating = calculateRating(song, diff, status || "none");
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
    ]);

    // --- Grouping By Constants Logic for Constants Tab (リニュー얼) ---
    const groupedConstants = useMemo(() => {
        const minConstVal = constMinLevelInput === "" ? 0.0 : parseFloat(constMinLevelInput);
        const maxConstVal = constMaxLevelInput === "" ? 100.0 : parseFloat(constMaxLevelInput);
        const minLvlVal = constMinLevel === "" ? 0 : parseInt(constMinLevel);
        const maxLvlVal = constMaxLevel === "" ? 100 : parseInt(constMaxLevel);

        const allChartsList = [];

        songs.forEach((song) => {
            const userPlay = userScoresMap.get(String(song.id));

            constDiffFilters.forEach((diff) => {
                const lvl = song.levels[diff];
                if (lvl === null || lvl === undefined) return;

                const queryStatus = constType === "ap" ? "full_perfect" : constType === "fc" ? "full_combo" : "clear";
                const constant = getConstant(song, diff, queryStatus);
                const hasConstant = hasExplicitConstant(song, diff, queryStatus);

                if (constant < minConstVal || constant > maxConstVal) return;
                if (lvl < minLvlVal || lvl > maxLvlVal) return;

                const status = userPlay ? userPlay[diff] : null;
                let mappedStatus = "unplayed";
                if (status === "full_perfect") mappedStatus = "ap";
                else if (status === "full_combo") mappedStatus = "fc";
                else if (status === "clear") mappedStatus = "played";

                if (!constPlayFilters.includes(mappedStatus)) return;

                if (constSearch.trim() !== "") {
                    const query = constSearch.toLowerCase();
                    const matchesText =
                        (song.title_ko || "").toLowerCase().includes(query) ||
                        (song.title_jp || "").toLowerCase().includes(query) ||
                        (song.title_hangul || "").toLowerCase().includes(query) ||
                        (song.composer || "").toLowerCase().includes(query);

                    if (!matchesText) return;
                }

                allChartsList.push({
                    song,
                    diff,
                    level: lvl,
                    constant,
                    hasConstant,
                    status: status || "none",
                    statusClass:
                        status === "full_perfect"
                            ? "ap"
                            : status === "full_combo"
                              ? "fc"
                              : status === "clear"
                                ? "clear"
                                : "unplayed",
                });
            });
        });

        const groups = {};
        allChartsList.forEach((chart) => {
            const key = chart.constant.toFixed(1);
            if (!groups[key]) groups[key] = [];
            groups[key].push(chart);
        });

        const sortedKeys = Object.keys(groups).sort((a, b) => parseFloat(b) - parseFloat(a));

        const sortedGroups = sortedKeys.map((key) => {
            const charts = groups[key].sort((a, b) => getSongTitle(a.song).localeCompare(getSongTitle(b.song)));
            return {
                constantValue: parseFloat(key),
                charts,
                count: charts.length,
            };
        });

        return sortedGroups;
    }, [
        songs,
        userScoresMap,
        constSearch,
        constDiffFilters,
        constPlayFilters,
        constMinLevelInput,
        constMaxLevelInput,
        constMinLevel,
        constMaxLevel,
        constType,
    ]);

    // --- Tour Guide Calculations ---
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

    const tourCharts = useMemo(() => {
        const charts = [];
        songs.forEach((song) => {
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
    }, [tourDiffs, tourMinLevel, tourMaxLevel, songs]);

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

    // --- Calculator Calculations ---
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

    const clearCalcSelection = () => {
        setCalcSelectedSong(null);
        setCalcSongSearch("");
    };

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

    // --- Distribution Tab Calculations ---
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
        <div className="app-wrapper">
            {/* HEADER SECTION */}
            <header className="app-header">
                <div className="header-container">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".json"
                        style={{ display: "none" }}
                    />
                    <div className="logo-section">
                        <span className="logo-icon">🎵</span>
                        <div>
                            <h1 className="logo-text">SEKAI ANALYZER</h1>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="desktop-nav">
                        <button
                            className={`btn btn-outline ${activeTab === "dashboard" ? "active" : ""}`}
                            onClick={() => setActiveTab("dashboard")}
                        >
                            <Award size={16} /> 대시보드
                        </button>

                        {/* Dropdown 1: 기록 */}
                        <div className={`nav-dropdown ${["records", "constants"].includes(activeTab) ? "active" : ""}`}>
                            <button className={`btn btn-outline dropdown-trigger`}>
                                <ClipboardList size={16} /> 기록 <ChevronDown size={14} />
                            </button>
                            <div className="nav-dropdown-menu">
                                <button
                                    className={`nav-dropdown-item ${activeTab === "records" ? "active" : ""}`}
                                    onClick={() => setActiveTab("records")}
                                >
                                    <ClipboardList size={14} /> 개인 기록
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "constants" ? "active" : ""}`}
                                    onClick={() => setActiveTab("constants")}
                                >
                                    <Layers size={14} /> 상수표
                                </button>
                            </div>
                        </div>

                        {/* Dropdown 2: 도구 */}
                        <div
                            className={`nav-dropdown ${["distributions", "tour", "calculator", "compare"].includes(activeTab) ? "active" : ""}`}
                        >
                            <button className={`btn btn-outline dropdown-trigger`}>
                                <Calculator size={16} /> 도구 <ChevronDown size={14} />
                            </button>
                            <div className="nav-dropdown-menu">
                                <button
                                    className={`nav-dropdown-item ${activeTab === "distributions" ? "active" : ""}`}
                                    onClick={() => setActiveTab("distributions")}
                                >
                                    <BarChart3 size={14} /> 분포
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "tour" ? "active" : ""}`}
                                    onClick={() => setActiveTab("tour")}
                                >
                                    <Target size={14} /> 곡 순회
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "calculator" ? "active" : ""}`}
                                    onClick={() => setActiveTab("calculator")}
                                >
                                    <Calculator size={14} /> 레이팅 계산기
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "compare" ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveTab("compare");
                                        setCompareError("");
                                    }}
                                >
                                    <Users size={14} /> 기록 비교
                                </button>
                            </div>
                        </div>

                        <button
                            className="btn btn-outline"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                borderColor: "var(--color-cyan)",
                                color: "var(--color-cyan)",
                            }}
                            onClick={triggerFileInput}
                        >
                            <FileUp size={16} /> 불러오기
                        </button>

                        <button
                            className="btn btn-outline"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                borderColor: "var(--color-purple)",
                                color: "var(--color-purple)",
                            }}
                            onClick={handleFileDownload}
                        >
                            <Download size={16} /> 내보내기
                        </button>

                        {/* Auth section */}
                        <div className="auth-nav-section">
                            {currentUser ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span
                                        className="user-settings-link"
                                        onClick={() => {
                                            setActiveTab("settings");
                                            setSettingsMessage("");
                                        }}
                                        title="설정 페이지로 이동"
                                    >
                                        <UserCheck size={16} /> {currentUser.nickname}님
                                    </span>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-primary animate-glow"
                                    style={{ padding: "0.5rem 1rem" }}
                                    onClick={() => setShowAuthModal(true)}
                                >
                                    <User size={16} /> 로그인 / 가입
                                </button>
                            )}
                        </div>
                    </nav>

                    {/* Mobile Navigation Toggle */}
                    <button
                        className="mobile-menu-toggle btn btn-outline"
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="메뉴 열기"
                    >
                        <Menu size={20} />
                    </button>
                </div>
            </header>

            {/* MOBILE SIDEBAR DRAWER */}
            {isMobileMenuOpen && (
                <div className="mobile-drawer-backdrop" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="mobile-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div className="logo-section">
                                <span className="logo-icon">🎵</span>
                                <span className="logo-text" style={{ fontSize: "1.3rem" }}>
                                    SEKAI ANALYZER
                                </span>
                            </div>
                            <button
                                className="btn-close"
                                onClick={() => setIsMobileMenuOpen(false)}
                                aria-label="메뉴 닫기"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* User Profile Info */}
                        <div className="drawer-user-section">
                            {currentUser ? (
                                <div className="drawer-user-info">
                                    <div className="user-name">
                                        <UserCheck size={18} style={{ color: "var(--color-cyan)" }} />
                                        <span>{currentUser.nickname}님</span>
                                    </div>
                                    <div className="user-ratings">
                                        <div className="rating-badge rating-normal">B39: {playerRating}</div>
                                        <div className="rating-badge rating-append">B15: {playerAppendRating}</div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-primary animate-glow w-full"
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        setShowAuthModal(true);
                                    }}
                                >
                                    <User size={16} /> 로그인 / 회원가입
                                </button>
                            )}
                        </div>

                        {/* Drawer Menu Items */}
                        <div className="drawer-menu-list">
                            <button
                                className={`drawer-menu-item ${activeTab === "dashboard" ? "active" : ""}`}
                                onClick={() => {
                                    setActiveTab("dashboard");
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <Award size={18} /> 대시보드
                            </button>

                            {/* Accordion 1: 기록 */}
                            <div className="drawer-accordion">
                                <button
                                    className={`drawer-accordion-trigger ${
                                        ["records", "constants"].includes(activeTab) ? "active-parent" : ""
                                    }`}
                                    onClick={() =>
                                        setOpenMobileAccordions({
                                            ...openMobileAccordions,
                                            records: !openMobileAccordions.records,
                                        })
                                    }
                                >
                                    <span className="trigger-label">
                                        <ClipboardList size={18} /> 기록
                                    </span>
                                    {openMobileAccordions.records ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <div
                                    className={`drawer-accordion-content ${openMobileAccordions.records ? "open" : ""}`}
                                >
                                    <button
                                        className={`drawer-sub-item ${activeTab === "records" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("records");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        개인 기록
                                    </button>
                                    <button
                                        className={`drawer-sub-item ${activeTab === "constants" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("constants");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        상수표
                                    </button>
                                </div>
                            </div>

                            {/* Accordion 2: 도구 */}
                            <div className="drawer-accordion">
                                <button
                                    className={`drawer-accordion-trigger ${
                                        ["distributions", "tour", "calculator", "compare"].includes(activeTab)
                                            ? "active-parent"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setOpenMobileAccordions({
                                            ...openMobileAccordions,
                                            tools: !openMobileAccordions.tools,
                                        })
                                    }
                                >
                                    <span className="trigger-label">
                                        <Calculator size={18} /> 도구
                                    </span>
                                    {openMobileAccordions.tools ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <div className={`drawer-accordion-content ${openMobileAccordions.tools ? "open" : ""}`}>
                                    <button
                                        className={`drawer-sub-item ${activeTab === "distributions" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("distributions");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        분포
                                    </button>
                                    <button
                                        className={`drawer-sub-item ${activeTab === "tour" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("tour");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        곡 순회
                                    </button>
                                    <button
                                        className={`drawer-sub-item ${activeTab === "calculator" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("calculator");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        레이팅 계산기
                                    </button>
                                    <button
                                        className={`drawer-sub-item ${activeTab === "compare" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("compare");
                                            setCompareError("");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        기록 비교
                                    </button>
                                </div>
                            </div>

                            {currentUser && (
                                <button
                                    className={`drawer-menu-item ${activeTab === "settings" ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveTab("settings");
                                        setSettingsMessage("");
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <Settings size={18} /> 환경 설정
                                </button>
                            )}
                        </div>

                        {/* Drawer Actions */}
                        <div className="drawer-footer-actions">
                            <button
                                className="btn btn-outline w-full"
                                style={{ color: "var(--color-cyan)", borderColor: "rgba(0, 242, 254, 0.3)" }}
                                onClick={() => {
                                    triggerFileInput();
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <FileUp size={16} /> 데이터 불러오기
                            </button>
                            <button
                                className="btn btn-outline w-full"
                                style={{ color: "var(--color-purple)", borderColor: "rgba(139, 92, 246, 0.3)" }}
                                onClick={() => {
                                    handleFileDownload();
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <Download size={16} /> 데이터 내보내기
                            </button>
                            {currentUser && (
                                <button
                                    className="btn btn-outline w-full"
                                    style={{ color: "var(--color-danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                                    onClick={() => {
                                        handleLogout();
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <LogOut size={16} /> 로그아웃
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT PREVIEW MODAL */}
            {showImportPreview && previewCalculatedData && (
                <div className="modal-backdrop" onClick={cancelImport}>
                    <div
                        className="glass-panel modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "550px", width: "100%", padding: "2rem" }}
                    >
                        <h3
                            style={{
                                fontSize: "1.5rem",
                                marginBottom: "1.5rem",
                                background: "linear-gradient(135deg, var(--color-cyan) 0%, var(--color-purple) 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                textAlign: "center",
                                fontWeight: 800,
                            }}
                        >
                            📊 불러오기 적용 미리보기
                        </h3>

                        <div
                            className="preview-comparison-grid"
                            style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}
                        >
                            {/* 일반 셐포스 레이팅 */}
                            <div
                                className="preview-row"
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "0.75rem 1rem",
                                    background: "rgba(255,255,255,0.02)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border-color)",
                                }}
                            >
                                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>일반 셐포스 레이팅 (B39)</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span
                                        style={{
                                            color: "var(--text-muted)",
                                            textDecoration: "line-through",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        {playerRating}
                                    </span>
                                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                                    <span style={{ fontWeight: 800, color: "var(--color-cyan)", fontSize: "1.1rem" }}>
                                        {previewCalculatedData.playerRating}
                                    </span>
                                    {renderDelta(previewCalculatedData.playerRating - playerRating)}
                                </div>
                            </div>

                            {/* 어펜드 레이팅 */}
                            <div
                                className="preview-row"
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "0.75rem 1rem",
                                    background: "rgba(255,255,255,0.02)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border-color)",
                                }}
                            >
                                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>어펜드 레이팅 (B15)</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span
                                        style={{
                                            color: "var(--text-muted)",
                                            textDecoration: "line-through",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        {playerAppendRating}
                                    </span>
                                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                                    <span style={{ fontWeight: 800, color: "var(--color-append)", fontSize: "1.1rem" }}>
                                        {previewCalculatedData.playerAppendRating}
                                    </span>
                                    {renderDelta(previewCalculatedData.playerAppendRating - playerAppendRating)}
                                </div>
                            </div>

                            {/* 플레이 통계 비교 */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr 1fr",
                                    gap: "0.75rem",
                                    marginTop: "0.5rem",
                                }}
                            >
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "0.75rem",
                                        background: "rgba(255,255,255,0.01)",
                                        borderRadius: "8px",
                                        border: "1px solid var(--border-color)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-secondary)",
                                            marginBottom: "0.25rem",
                                            fontWeight: 700,
                                        }}
                                    >
                                        ALL PERFECT
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "1.2rem",
                                            fontWeight: 800,
                                            color: "var(--color-ap)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.1rem",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>{previewCalculatedData.stats.apCount}개</span>
                                        {renderDelta(previewCalculatedData.stats.apCount - overallStats.apCount, true)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "0.75rem",
                                        background: "rgba(255,255,255,0.01)",
                                        borderRadius: "8px",
                                        border: "1px solid var(--border-color)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-secondary)",
                                            marginBottom: "0.25rem",
                                            fontWeight: 700,
                                        }}
                                    >
                                        FULL COMBO
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "1.2rem",
                                            fontWeight: 800,
                                            color: "var(--color-fc)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.1rem",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>{previewCalculatedData.stats.fcCount}개</span>
                                        {renderDelta(previewCalculatedData.stats.fcCount - overallStats.fcCount, true)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "0.75rem",
                                        background: "rgba(255,255,255,0.01)",
                                        borderRadius: "8px",
                                        border: "1px solid var(--border-color)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-secondary)",
                                            marginBottom: "0.25rem",
                                            fontWeight: 700,
                                        }}
                                    >
                                        CLEAR
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "1.2rem",
                                            fontWeight: 800,
                                            color: "var(--color-clear)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.1rem",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>{previewCalculatedData.stats.clearCount}개</span>
                                        {renderDelta(
                                            previewCalculatedData.stats.clearCount - overallStats.clearCount,
                                            true,
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "1rem" }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={cancelImport}>
                                취소
                            </button>
                            <button
                                className="btn btn-primary animate-glow"
                                style={{ flex: 1 }}
                                onClick={confirmImport}
                            >
                                적용하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AUTH MODAL */}
            {showAuthModal && (
                <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
                    <div
                        className="glass-panel modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "400px", width: "100%", padding: "2rem" }}
                    >
                        <h3
                            style={{
                                fontSize: "1.5rem",
                                marginBottom: "1rem",
                                background: "linear-gradient(135deg, var(--color-cyan) 0%, var(--color-pink) 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                textAlign: "center",
                            }}
                        >
                            {isRegisterMode ? "SEKAI 회원가입" : "SEKAI 로그인"}
                        </h3>

                        <form
                            onSubmit={handleAuthSubmit}
                            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
                        >
                            <div
                                className="filter-group"
                                style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                            >
                                <label className="filter-label">유저 ID</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={authUsername}
                                    onChange={(e) => setAuthUsername(e.target.value)}
                                    placeholder="아이디를 입력하세요 (영어/숫자)"
                                />
                            </div>

                            {isRegisterMode && (
                                <div
                                    className="filter-group"
                                    style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                                >
                                    <label className="filter-label">프로필 닉네임</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={authNickname}
                                        onChange={(e) => setAuthNickname(e.target.value)}
                                        placeholder="대시보드에 보일 닉네임"
                                    />
                                </div>
                            )}

                            <div
                                className="filter-group"
                                style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                            >
                                <label className="filter-label">비밀번호</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder="비밀번호를 입력하세요"
                                />
                            </div>

                            {authError && (
                                <div
                                    style={{
                                        color: "var(--color-danger)",
                                        fontSize: "0.85rem",
                                        fontWeight: "700",
                                        textAlign: "center",
                                    }}
                                >
                                    ⚠ {authError}
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                                {isRegisterMode ? "회원가입 완료" : "로그인"}
                            </button>

                            <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                {isRegisterMode ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}
                                <span
                                    style={{
                                        color: "var(--color-cyan)",
                                        cursor: "pointer",
                                        marginLeft: "0.5rem",
                                        textDecoration: "underline",
                                    }}
                                    onClick={() => {
                                        setIsRegisterMode(!isRegisterMode);
                                        setAuthError("");
                                    }}
                                >
                                    {isRegisterMode ? "로그인하기" : "회원가입하기"}
                                </span>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <main className="container" style={{ flex: 1 }}>
                {/* ======================================================== */}
                {/* 1. DASHBOARD TAB */}
                {/* ======================================================== */}
                {activeTab === "dashboard" && (
                    <div className="dashboard-grid">
                        {/* Left Stats Sidebar */}
                        <aside className="stats-sidebar">
                            {/* 일반 셐포스 B39 */}
                            <div className="glass-panel profile-card" style={{ marginBottom: "0.25rem" }}>
                                <div className="rating-title">
                                    {currentUser ? `${currentUser.nickname}의 ` : ""}Player R
                                </div>
                                <div className="rating-value">{playerRating}</div>
                            </div>

                            {/* 어펜드 셐포스 B15 */}
                            <div className="glass-panel profile-card" style={{ position: "relative" }}>
                                <div className="rating-title" style={{ color: "var(--color-append)" }}>
                                    Append R
                                </div>
                                <div
                                    className="rating-value"
                                    style={{
                                        background: "linear-gradient(135deg, #ffffff 30%, #ff9ebe 100%)",
                                        WebkitTextFillColor: "transparent",
                                        WebkitBackgroundClip: "text",
                                    }}
                                >
                                    {playerAppendRating}
                                </div>
                            </div>

                            <div className="glass-panel stat-box">
                                <span className="stat-label">B39 평균 / 커트라인</span>
                                <span className="stat-val" style={{ fontSize: "1.2rem", color: "var(--color-cyan)" }}>
                                    {b39List.length > 0 ? (playerRating / b39List.length).toFixed(1) : "0.0"} /{" "}
                                    {b39List.length === 39 ? Math.round(b39List[38].rating) : "0"}
                                </span>
                            </div>

                            <div className="glass-panel stat-box">
                                <span className="stat-label">어펜드 B15 평균 / 커트라인</span>
                                <span className="stat-val" style={{ fontSize: "1.2rem", color: "var(--color-append)" }}>
                                    {appendB15List.length > 0
                                        ? (
                                              appendB15List.reduce((acc, c) => acc + c.rating, 0) / appendB15List.length
                                          ).toFixed(1)
                                        : "0.0"}{" "}
                                    / {appendB15List.length === 15 ? Math.round(appendB15List[14].rating) : "0"}
                                </span>
                            </div>

                            <div className="stat-grid-half">
                                <div className="glass-panel stat-box">
                                    <span
                                        className="stat-label"
                                        style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                                    >
                                        <span style={{ color: "var(--color-ap)" }}>●</span> AP 수
                                    </span>
                                    <span className="stat-val">{overallStats.apCount}</span>
                                </div>
                                <div className="glass-panel stat-box">
                                    <span
                                        className="stat-label"
                                        style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                                    >
                                        <span style={{ color: "var(--color-fc)" }}>●</span> FC 수
                                    </span>
                                    <span className="stat-val">{overallStats.fcCount}</span>
                                </div>
                            </div>
                        </aside>

                        {/* Right B39 / B15 List Panel */}
                        <section className="glass-panel main-content" style={{ padding: "2rem" }}>
                            {/* 레이팅 상승 추세 그래프 */}
                            <div
                                className="glass-panel"
                                style={{
                                    padding: "1.5rem",
                                    marginBottom: "1.5rem",
                                    background: "rgba(10, 15, 30, 0.4)",
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: "1.1rem",
                                        marginBottom: "1rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        fontWeight: "700",
                                    }}
                                >
                                    <TrendingUp size={18} style={{ color: "var(--color-cyan)" }} /> 레이팅 상승 추세
                                </h3>
                                {renderRatingGraph()}
                            </div>
                            <div
                                className="section-title-bar"
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: "1rem",
                                }}
                            >
                                <div>
                                    <h2 className="section-title">
                                        <TrendingUp size={22} style={{ color: "var(--color-cyan)" }} /> B39
                                    </h2>
                                </div>

                                {/* Dashboard Inner Sub Tab Selector */}
                                <div
                                    className="tabs-header"
                                    style={{ width: "100%", marginBottom: 0, paddingBottom: 0 }}
                                >
                                    <button
                                        className={`tab-btn ${dashboardSubTab === "b39" ? "active" : ""}`}
                                        onClick={() => setDashboardSubTab("b39")}
                                    >
                                        B39
                                    </button>
                                    <button
                                        className={`tab-btn ${dashboardSubTab === "b15" ? "active" : ""}`}
                                        onClick={() => setDashboardSubTab("b15")}
                                        style={{
                                            borderBottomColor: dashboardSubTab === "b15" ? "var(--color-append)" : "",
                                            color: dashboardSubTab === "b15" ? "var(--color-append)" : "",
                                        }}
                                    >
                                        APD B15
                                    </button>
                                </div>
                            </div>

                            <div className="b39-list">
                                {dashboardSubTab === "b39" ? (
                                    b39List.length === 0 ? (
                                        <div
                                            style={{
                                                gridColumn: "1 / -1",
                                                textAlign: "center",
                                                padding: "4rem 0",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            등록된 일반 셐포스 B39 성과 기록이 없습니다.
                                        </div>
                                    ) : (
                                        b39List.map((item, index) => {
                                            const diffColors = {
                                                easy: "diff-easy",
                                                normal: "diff-normal",
                                                hard: "diff-hard",
                                                expert: "diff-expert",
                                                master: "diff-master",
                                            };
                                            return (
                                                <div
                                                    key={`${item.song.id}-${item.diff}`}
                                                    className={`glass-panel b39-item status-${item.status || "clear"} hover-lift`}
                                                >
                                                    <div className="b39-rank">#{index + 1}</div>
                                                    <div className="b39-jacket-wrapper">
                                                        <JacketImage
                                                            songId={item.song.id}
                                                            size={200}
                                                            className="b39-jacket"
                                                        />
                                                    </div>
                                                    <div className="b39-card-body">
                                                        <div className="b39-title" title={getSongTitle(item.song)}>
                                                            {getSongTitle(item.song)}
                                                        </div>
                                                        <div className="b39-meta-row">
                                                            <span className={`diff-badge ${diffColors[item.diff]}`}>
                                                                {item.diff.toUpperCase().substring(0, 3)} {item.level}
                                                            </span>
                                                            <span
                                                                className={`status-badge ${item.status === "full_perfect" ? "status-ap" : item.status === "full_combo" ? "status-fc" : "status-clear"}`}
                                                            >
                                                                {item.status === "full_perfect"
                                                                    ? "AP"
                                                                    : item.status === "full_combo"
                                                                      ? "FC"
                                                                      : "C"}
                                                            </span>
                                                        </div>
                                                        <div className="b39-rating-row">
                                                            <span className="b39-constant">
                                                                {item.constant.toFixed(1)}
                                                                {!item.hasConstant && "?"}
                                                            </span>
                                                            <span className="b39-rating-value">
                                                                {Math.round(item.rating)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )
                                ) : appendB15List.length === 0 ? (
                                    <div
                                        style={{
                                            gridColumn: "1 / -1",
                                            textAlign: "center",
                                            padding: "4rem 0",
                                            color: "var(--text-muted)",
                                        }}
                                    >
                                        등록된 어펜드 B15 성과 기록이 없습니다.
                                    </div>
                                ) : (
                                    appendB15List.map((item, index) => (
                                        <div
                                            key={`${item.song.id}-append`}
                                            className={`glass-panel b39-item status-${item.status || "clear"} append-item hover-lift`}
                                        >
                                            <div className="b39-rank">#{index + 1}</div>
                                            <div className="b39-jacket-wrapper">
                                                <JacketImage songId={item.song.id} size={200} className="b39-jacket" />
                                            </div>
                                            <div className="b39-card-body">
                                                <div className="b39-title" title={getSongTitle(item.song)}>
                                                    {getSongTitle(item.song)}
                                                </div>
                                                <div className="b39-meta-row">
                                                    <span className="diff-badge diff-append">APD {item.level}</span>
                                                    <span
                                                        className={`status-badge ${item.status === "full_perfect" ? "status-ap" : item.status === "full_combo" ? "status-fc" : "status-clear"}`}
                                                    >
                                                        {item.status === "full_perfect"
                                                            ? "AP"
                                                            : item.status === "full_combo"
                                                              ? "FC"
                                                              : "C"}
                                                    </span>
                                                </div>
                                                <div className="b39-rating-row">
                                                    <span className="b39-constant">
                                                        {item.constant.toFixed(1)}
                                                        {!item.hasConstant && "?"}
                                                    </span>
                                                    <span className="b39-rating-value">{Math.round(item.rating)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* ======================================================== */}
                {/* RECORDS TAB */}
                {/* ======================================================== */}
                {activeTab === "records" && (
                    <section className="glass-panel" style={{ padding: "2rem" }}>
                        <div className="section-title-bar">
                            <div>
                                <h2 className="section-title">
                                    <ClipboardList size={22} style={{ color: "var(--color-cyan)" }} /> 기록
                                </h2>
                            </div>
                        </div>

                        {/* EXPANDED FILTER & SORT SECTION */}
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
                                            value={recordSearch}
                                            onChange={(e) => setRecordSearch(e.target.value)}
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
                                            <option value="rating">Music R</option>
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
                                            <label
                                                key={diff}
                                                className={`checkbox-label ${isActive ? `active-${diff}` : ""}`}
                                            >
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
                                    <span>Music R</span>
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
                                    filteredAndSortedRecords.map((item, index) => {
                                        const diffNames = {
                                            easy: "EASY",
                                            normal: "NORMAL",
                                            hard: "HARD",
                                            expert: "EXPERT",
                                            master: "MASTER",
                                            append: "APPEND",
                                        };

                                        return (
                                            <div
                                                key={`${item.song.id}-${item.diff}`}
                                                className="record-row-item record-grid-row"
                                            >
                                                {/* Rank */}
                                                <div className="record-rank-col">#{index + 1}</div>

                                                {/* Jacket */}
                                                <div className="record-jacket-col">
                                                    <JacketImage songId={item.song.id} size={42} />
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
                                                            {diffNames[item.diff].substring(0, 3)} {item.level}
                                                        </span>
                                                        <span className="meta-constant">
                                                            C: {item.fcConstant.toFixed(1)}
                                                            {!item.hasFcConstant && "?"}
                                                        </span>
                                                        <span
                                                            className="meta-rating"
                                                            style={{
                                                                color:
                                                                    item.rating > 0
                                                                        ? "var(--color-pink)"
                                                                        : "var(--text-muted)",
                                                            }}
                                                        >
                                                            R: {item.rating > 0 ? Math.round(item.rating) : "-"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Difficulty Badge */}
                                                <div className="record-diff-col">
                                                    <span className={`diff-badge diff-${item.diff}`}>
                                                        {diffNames[item.diff]}
                                                    </span>
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
                                                            item.rating > 0 ? "var(--color-pink)" : "var(--text-muted)",
                                                    }}
                                                >
                                                    {item.rating > 0 ? Math.round(item.rating) : "-"}
                                                </div>

                                                {/* Action / Selector */}
                                                <div className="record-action-col">
                                                    <select
                                                        className={`record-status-select status-${item.status}`}
                                                        value={item.status}
                                                        onChange={(e) =>
                                                            handleScoreChange(item.song.id, item.diff, e.target.value)
                                                        }
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
                            </div>
                        </div>
                    </section>
                )}

                {/* ======================================================== */}
                {/* 2. CONSTANT TABLE TAB (리뉴얼 완료!) */}
                {/* ======================================================== */}
                {activeTab === "constants" && (
                    <section className="glass-panel" style={{ padding: "2rem" }}>
                        <div className="section-title-bar">
                            <div>
                                <h2 className="section-title">
                                    <Layers size={22} style={{ color: "var(--color-cyan)" }} /> 상수표
                                </h2>
                            </div>
                        </div>

                        {/* EXPANDED FILTER SECTION (체크박스 및 입력창 개편) */}
                        <div className="table-filters-expanded">
                            {/* Row 1: Search, Constants & Levels inputs */}
                            <div className="filters-row constants-filters-grid">
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
                                            value={constSearch}
                                            onChange={(e) => setConstSearch(e.target.value)}
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
                                            value={constMinLevelInput}
                                            onChange={(e) => setConstMinLevelInput(e.target.value)}
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
                                            value={constMaxLevelInput}
                                            onChange={(e) => setConstMaxLevelInput(e.target.value)}
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
                                            value={constMinLevel}
                                            onChange={(e) => setConstMinLevel(e.target.value)}
                                        />
                                        <span>~</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="form-control"
                                            placeholder="최대"
                                            style={{ width: "100%" }}
                                            value={constMaxLevel}
                                            onChange={(e) => setConstMaxLevel(e.target.value)}
                                        />
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
                                        const isActive = constDiffFilters.includes(diff);
                                        return (
                                            <label
                                                key={diff}
                                                className={`checkbox-label ${isActive ? `active-${diff}` : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isActive}
                                                    onChange={() => handleDiffFilterToggle(diff)}
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
                                        const isActive = constPlayFilters.includes(playStatus.id);
                                        return (
                                            <label
                                                key={playStatus.id}
                                                className={`checkbox-label ${isActive ? `active-${playStatus.id}` : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isActive}
                                                    onChange={() => handlePlayFilterToggle(playStatus.id)}
                                                />
                                                {playStatus.label}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Row 4: Constant Type Toggle */}
                            <div className="filter-group" style={{ marginTop: "0.5rem" }}>
                                <label className="filter-label">상수 타입</label>
                                <div style={{ display: "flex", gap: "0.5rem", maxWidth: "280px" }}>
                                    <button
                                        className={`btn btn-outline ${constType === "fc" ? "active" : ""}`}
                                        style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}
                                        onClick={() => setConstType("fc")}
                                    >
                                        FC 상수
                                    </button>
                                    <button
                                        className={`btn btn-outline ${constType === "ap" ? "active" : ""}`}
                                        style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}
                                        onClick={() => setConstType("ap")}
                                    >
                                        AP 상수
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CONSTANT SECTION GROUP GRID (상수별 바둑판 격자 렌더링) */}
                        <div className="constant-group-container">
                            {groupedConstants.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
                                    검색 및 필터 조건에 합치하는 곡 상수 조합이 없습니다.
                                </div>
                            ) : (
                                groupedConstants.map((group) => (
                                    <div key={group.constantValue} className="constant-group-section">
                                        {/* Constant group title */}
                                        <div className="constant-group-header">{group.constantValue.toFixed(1)}</div>

                                        {/* Visual jacket grid for charts */}
                                        <div className="constant-charts-grid">
                                            {group.charts.map((chart) => (
                                                <div
                                                    key={`${chart.song.id}-${chart.diff}`}
                                                    className="jacket-chart-card"
                                                    onClick={() =>
                                                        handleJacketClick(chart.song.id, chart.diff, chart.status)
                                                    }
                                                >
                                                    {/* Jacket wrapper with difficulty border */}
                                                    <div
                                                        className={`jacket-wrapper border-${chart.diff}`}
                                                        style={{ position: "relative" }}
                                                    >
                                                        <JacketImage songId={chart.song.id} size={85} />
                                                        {!chart.hasConstant && (
                                                            <span
                                                                className="no-constant-badge"
                                                                title="상수 데이터 없음 (기본 레벨 표시)"
                                                            >
                                                                ?
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Neon Status tag directly under jacket */}
                                                    <div className={`jacket-status-overlay ${chart.statusClass}`}>
                                                        {chart.statusClass === "unplayed"
                                                            ? "unplay"
                                                            : chart.statusClass}
                                                    </div>

                                                    {/* Hover detail tooltip */}
                                                    <div className="jacket-chart-tooltip">
                                                        <div
                                                            style={{
                                                                fontWeight: "700",
                                                                wordBreak: "keep-all",
                                                                overflowWrap: "break-word",
                                                                display: "-webkit-box",
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: "vertical",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                lineHeight: "1.2",
                                                            }}
                                                        >
                                                            {getSongTitle(chart.song)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}

                {/* ======================================================== */}
                {/* 3. TOUR GUIDE TAB */}
                {/* ======================================================== */}
                {activeTab === "tour" && (
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
                                    style={{
                                        fontSize: "1rem",
                                        borderBottom: "1px solid var(--border-color)",
                                        paddingBottom: "0.5rem",
                                    }}
                                >
                                    순회 타겟
                                </h3>

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
                                        {["easy", "normal", "hard", "expert", "master", "append"].map((diff) => {
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
                                                                    setTourDiffs(tourDiffs.filter((d) => d !== diff));
                                                                }
                                                            } else {
                                                                setTourDiffs([...tourDiffs, diff]);
                                                            }
                                                        }}
                                                    />
                                                    {diffNames[diff]}
                                                </label>
                                            );
                                        })}
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

                                <div className="tour-stat-circle" style={{ margin: "1rem auto" }}>
                                    <svg className="tour-gauge-svg" viewBox="0 0 100 100">
                                        <defs>
                                            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
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
                                                strokeDashoffset: 2 * Math.PI * 44 * (1 - tourStats.percentage / 100),
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
                                            : tourStats.remainingList.map(({ song, diff, level, status }) => {
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
                                                          }}
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
                                        {tourStats.completedList.map(({ song, diff, level, status }) => {
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
                                                    className="glass-panel tour-song-card"
                                                    style={{
                                                        opacity: 0.6,
                                                        display: "flex",
                                                        flexDirection: "row",
                                                        gap: "0.75rem",
                                                        alignItems: "center",
                                                    }}
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
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ======================================================== */}
                {/* 4. CALCULATOR TAB */}
                {/* ======================================================== */}
                {activeTab === "calculator" && (
                    <section className="glass-panel calculator-panel">
                        <h2 className="section-title" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
                            <Calculator size={22} style={{ color: "var(--color-cyan)" }} /> Music R 계산기
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
                )}

                {/* ======================================================== */}
                {/* 5. COMPARE TAB */}
                {/* ======================================================== */}
                {/* ======================================================== */}
                {/* 5. COMPARE & FRIENDS TAB */}
                {/* ======================================================== */}
                {activeTab === "compare" && (
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
                                                        }}
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
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{
                                                        padding: "0.25rem",
                                                        borderColor: "rgba(220,53,69,0.3)",
                                                        color: "var(--color-danger)",
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
                                        ))}
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* Right: Compare details panel */}
                        <section className="glass-panel" style={{ padding: "2rem", flex: 1, minWidth: 0 }}>
                            <h2 className="section-title" style={{ marginBottom: "1.5rem" }}>
                                <Users size={22} style={{ color: "var(--color-cyan)", marginRight: "0.5rem" }} /> 기록
                                비교
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
                                        비교할 친구 목록의 카드를 선택하거나 상단 검색창에 ID를 입력하여 성과 기록을
                                        1대1 비교해 보세요!
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
                                                        fontSize: "0.9rem",
                                                        fontWeight: "700",
                                                    }}
                                                >
                                                    {compareRatingType === "player"
                                                        ? "Player R"
                                                        : compareRatingType === "append"
                                                          ? "Append R"
                                                          : "Total R"}
                                                </h4>
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
                                            </div>

                                            {(() => {
                                                const valA =
                                                    compareRatingType === "player"
                                                        ? compareResults.resA.sum
                                                        : compareRatingType === "append"
                                                          ? compareResults.resA.appendSum
                                                          : compareResults.resA.totalSum;
                                                const valB =
                                                    compareRatingType === "player"
                                                        ? compareResults.resB.sum
                                                        : compareRatingType === "append"
                                                          ? compareResults.resB.appendSum
                                                          : compareResults.resB.totalSum;

                                                const { pctA, pctB } = getRelativePercentages(valA, valB);

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
                                                            {/* Center Indicator */}
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
                                                                {valA}
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
                                                                    ? `+${Math.round(valA - valB)}`
                                                                    : valA < valB
                                                                      ? `-${Math.round(valB - valA)}`
                                                                      : "0"}
                                                            </span>
                                                            <span
                                                                style={{
                                                                    color: "var(--color-pink)",
                                                                    textAlign: "right",
                                                                }}
                                                            >
                                                                {valB}
                                                            </span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Achievements counts comparison */}
                                        <div className="glass-panel" style={{ padding: "1.5rem" }}>
                                            <h4
                                                style={{
                                                    color: "var(--text-secondary)",
                                                    marginBottom: "1rem",
                                                    fontSize: "0.9rem",
                                                    textAlign: "center",
                                                }}
                                            >
                                                성과
                                            </h4>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 60px 60px 60px",
                                                        gap: "0.5rem",
                                                        fontSize: "0.85rem",
                                                        fontWeight: "700",
                                                        borderBottom: "1px solid var(--border-color)",
                                                        paddingBottom: "0.5rem",
                                                    }}
                                                >
                                                    <span>성과 종류</span>
                                                    <span style={{ color: "var(--color-cyan)", textAlign: "right" }}>
                                                        나
                                                    </span>
                                                    <span style={{ color: "var(--color-pink)", textAlign: "right" }}>
                                                        상대방
                                                    </span>
                                                    <span
                                                        style={{ color: "var(--text-secondary)", textAlign: "right" }}
                                                    >
                                                        차이
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 60px 60px 60px",
                                                        gap: "0.5rem",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    <span>● ALL PERFECT (AP)</span>
                                                    <span
                                                        style={{
                                                            color: "var(--color-ap)",
                                                            textAlign: "right",
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {compareResults.resA.ap}
                                                    </span>
                                                    <span
                                                        style={{
                                                            color: "var(--color-ap)",
                                                            textAlign: "right",
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {compareResults.resB.ap}
                                                    </span>
                                                    {(() => {
                                                        const diff = compareResults.resA.ap - compareResults.resB.ap;
                                                        return (
                                                            <span
                                                                style={{
                                                                    color:
                                                                        diff > 0
                                                                            ? "var(--color-cyan)"
                                                                            : diff < 0
                                                                              ? "var(--color-pink)"
                                                                              : "var(--text-muted)",
                                                                    textAlign: "right",
                                                                    fontWeight: "700",
                                                                }}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 60px 60px 60px",
                                                        gap: "0.5rem",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    <span>● FULL COMBO (FC)</span>
                                                    <span
                                                        style={{
                                                            color: "var(--color-fc)",
                                                            textAlign: "right",
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {compareResults.resA.fc}
                                                    </span>
                                                    <span
                                                        style={{
                                                            color: "var(--color-fc)",
                                                            textAlign: "right",
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {compareResults.resB.fc}
                                                    </span>
                                                    {(() => {
                                                        const diff = compareResults.resA.fc - compareResults.resB.fc;
                                                        return (
                                                            <span
                                                                style={{
                                                                    color:
                                                                        diff > 0
                                                                            ? "var(--color-cyan)"
                                                                            : diff < 0
                                                                              ? "var(--color-pink)"
                                                                              : "var(--text-muted)",
                                                                    textAlign: "right",
                                                                    fontWeight: "700",
                                                                }}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 60px 60px 60px",
                                                        gap: "0.5rem",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    <span>● CLEAR (C)</span>
                                                    <span
                                                        style={{
                                                            color: "var(--color-clear)",
                                                            textAlign: "right",
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {compareResults.resA.clr}
                                                    </span>
                                                    <span
                                                        style={{
                                                            color: "var(--color-clear)",
                                                            textAlign: "right",
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {compareResults.resB.clr}
                                                    </span>
                                                    {(() => {
                                                        const diff = compareResults.resA.clr - compareResults.resB.clr;
                                                        return (
                                                            <span
                                                                style={{
                                                                    color:
                                                                        diff > 0
                                                                            ? "var(--color-cyan)"
                                                                            : diff < 0
                                                                              ? "var(--color-pink)"
                                                                              : "var(--text-muted)",
                                                                    textAlign: "right",
                                                                    fontWeight: "700",
                                                                }}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
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
                                                gap: "0.5rem",
                                            }}
                                        >
                                            <Sparkles size={18} style={{ color: "var(--color-cyan)" }} /> 상세 비교
                                        </h3>

                                        {/* FILTER PANEL FOR DETAILED COMPARISON */}
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
                                                        value={compareSearch}
                                                        onChange={(e) => setCompareSearch(e.target.value)}
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
                                                                            ? "var(--color-cyan)"
                                                                            : "var(--border-color)",
                                                                        color: isActive
                                                                            ? "var(--color-cyan)"
                                                                            : "var(--text-secondary)",
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
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                                                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
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
                                                        <option value="ratingA">내 레이팅</option>
                                                        <option value="ratingB">상대 레이팅</option>
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
                                            filteredCompareList.map(
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

                                                    const tierMap = {
                                                        full_perfect: 3,
                                                        full_combo: 2,
                                                        clear: 1,
                                                        none: 0,
                                                    };
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
                                                                    {ratingA.toFixed(1)}
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
                                                                    {ratingB.toFixed(1)}
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
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* ======================================================== */}
                {/* 6. SETTINGS TAB */}
                {/* ======================================================== */}
                {activeTab === "settings" && (
                    <section className="glass-panel" style={{ padding: "2.5rem", maxWidth: "600px", margin: "0 auto" }}>
                        <h2 className="section-title" style={{ marginBottom: "2rem" }}>
                            <User size={22} style={{ color: "var(--color-cyan)", marginRight: "0.5rem" }} /> 환경 설정
                        </h2>

                        {!currentUser ? (
                            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                                <p style={{ marginBottom: "1.5rem" }}>
                                    로그인 시 프로필 설정 및 곡명 다국어 변경 옵션을 이용할 수 있습니다.
                                </p>
                                <button className="btn btn-primary animate-glow" onClick={() => setShowAuthModal(true)}>
                                    로그인 / 회원가입
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                                {/* Nickname modification */}
                                <div
                                    className="filter-group"
                                    style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                                >
                                    <label className="filter-label" style={{ fontWeight: 700 }}>
                                        대시보드 닉네임 변경
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={settingsNickname}
                                        onChange={(e) => setSettingsNickname(e.target.value)}
                                        onBlur={() => handleSaveSettings(settingsNickname, settingsTitleLang)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.target.blur();
                                            }
                                        }}
                                        placeholder="변경할 닉네임을 입력하세요..."
                                    />
                                </div>

                                {/* Language option for song titles */}
                                <div
                                    className="filter-group"
                                    style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                                >
                                    <label className="filter-label" style={{ fontWeight: 700 }}>
                                        곡 명 표시 설정
                                    </label>
                                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                                        <label
                                            className={`checkbox-label ${settingsTitleLang === "jp" ? "active-played" : ""}`}
                                            style={{
                                                flex: 1,
                                                justifyContent: "center",
                                                padding: "0.75rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="songTitleLang"
                                                value="jp"
                                                checked={settingsTitleLang === "jp"}
                                                onChange={() => {
                                                    setSettingsTitleLang("jp");
                                                    handleSaveSettings(settingsNickname, "jp");
                                                }}
                                                style={{ marginRight: "0.5rem" }}
                                            />
                                            일본어 원제목 우선
                                        </label>
                                        <label
                                            className={`checkbox-label ${settingsTitleLang === "ko" ? "active-ap" : ""}`}
                                            style={{
                                                flex: 1,
                                                justifyContent: "center",
                                                padding: "0.75rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="songTitleLang"
                                                value="ko"
                                                checked={settingsTitleLang === "ko"}
                                                onChange={() => {
                                                    setSettingsTitleLang("ko");
                                                    handleSaveSettings(settingsNickname, "ko");
                                                }}
                                                style={{ marginRight: "0.5rem" }}
                                            />
                                            한국어 번역제목 우선
                                        </label>
                                    </div>
                                </div>

                                {/* Song sync section */}
                                <div
                                    className="filter-group"
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem",
                                        marginTop: "0.5rem",
                                    }}
                                >
                                    <label className="filter-label" style={{ fontWeight: 700 }}>
                                        곡 데이터 동기화
                                    </label>
                                    <button
                                        className="btn btn-secondary animate-glow"
                                        disabled={isLoadingSongs}
                                        onClick={async () => {
                                            setSettingsMessage("곡 정보 동기화 진행 중...");
                                            try {
                                                const res = await fetch("/api/songs/sync");
                                                const data = await res.json();
                                                if (data.success) {
                                                    setSettingsMessage(data.message || "곡 정보 동기화 성공!");
                                                    // Refresh songs list
                                                    fetchSongsFromServer();
                                                } else {
                                                    setSettingsMessage(`⚠ ${data.message || "동기화 실패"}`);
                                                }
                                            } catch (err) {
                                                setSettingsMessage("⚠ 서버 동기화 실패");
                                            }
                                        }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "0.5rem",
                                            padding: "0.75rem",
                                        }}
                                    >
                                        곡 정보 강제 동기화 (Constants 갱신)
                                    </button>
                                </div>

                                {/* Status message feedback */}
                                {settingsMessage && (
                                    <div
                                        className="glass-panel"
                                        style={{
                                            padding: "0.75rem 1rem",
                                            borderRadius: "8px",
                                            fontSize: "0.85rem",
                                            fontWeight: "700",
                                            color: settingsMessage.startsWith("⚠")
                                                ? "var(--color-danger)"
                                                : "var(--color-success)",
                                            borderLeft: `4px solid ${settingsMessage.startsWith("⚠") ? "var(--color-danger)" : "var(--color-success)"}`,
                                        }}
                                    >
                                        {settingsMessage}
                                    </div>
                                )}

                                {/* Logout Area */}
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "1rem",
                                        marginTop: "1rem",
                                        borderTop: "1px solid var(--border-color)",
                                        paddingTop: "1.5rem",
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{
                                            flex: 1,
                                            borderColor: "var(--color-danger)",
                                            color: "var(--color-danger)",
                                        }}
                                        onClick={handleLogout}
                                    >
                                        <LogOut size={16} /> 로그아웃
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* ======================================================== */}
                {/* 6. DISTRIBUTIONS TAB */}
                {/* ======================================================== */}
                {activeTab === "distributions" && (
                    <section className="glass-panel" style={{ padding: "2rem" }}>
                        <div className="section-title-bar">
                            <div>
                                <h2 className="section-title">
                                    <BarChart3 size={22} style={{ color: "var(--color-cyan)" }} /> 분포
                                </h2>
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
                                    <span style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--color-ap)" }}>
                                        {statsOverview.ap}개{" "}
                                        <span
                                            style={{
                                                fontSize: "0.9rem",
                                                fontWeight: "500",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            ({Math.round((statsOverview.ap / statsOverview.total) * 100)}%)
                                        </span>
                                    </span>
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
                                    <span style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--color-fc)" }}>
                                        {statsOverview.fc}개{" "}
                                        <span
                                            style={{
                                                fontSize: "0.9rem",
                                                fontWeight: "500",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            ({Math.round((statsOverview.fc / statsOverview.total) * 100)}%)
                                        </span>
                                    </span>
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
                                    <span
                                        style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--color-clear)" }}
                                    >
                                        {statsOverview.clr}개{" "}
                                        <span
                                            style={{
                                                fontSize: "0.9rem",
                                                fontWeight: "500",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            ({Math.round((statsOverview.clr / statsOverview.total) * 100)}%)
                                        </span>
                                    </span>
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
                                    ALL PERFECT (AP)
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
                                    FULL COMBO (FC)
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
                                    CLEAR (C)
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
                                    NC / 미클리어
                                </span>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            <footer className="app-footer">
                <div className="container">
                    <p>© 2026 PJSK Sekai Score Analyzer. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

export default App;

const DistributionChart = ({ data, displayType, distTab }) => {
    const svgRef = useRef(null);
    const [hovered, setHovered] = useState(null); // { x, y, item, index }

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
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();

        // Calculate absolute position on screen
        const clientX = e.clientX;
        const clientY = e.clientY;

        // Calculate position relative to container
        const parentRect = svgRef.current.parentElement.getBoundingClientRect();
        const tooltipX = clientX - parentRect.left + 15;
        const tooltipY = clientY - parentRect.top - 10;

        setHovered({
            x: tooltipX,
            y: tooltipY,
            item,
            index,
        });
    };

    return (
        <div style={{ position: "relative", width: "100%" }}>
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
                        transform: "translateY(-100%)",
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
                            fontSize: "0.85rem",
                            color: "var(--color-ap)",
                            marginBottom: "0.25rem",
                        }}
                    >
                        <span>● AP (ALL PERFECT)</span>
                        <span>
                            {hovered.item.ap}개 (
                            {hovered.item.total > 0 ? Math.round((hovered.item.ap / hovered.item.total) * 100) : 0}%)
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                            color: "var(--color-fc)",
                            marginBottom: "0.25rem",
                        }}
                    >
                        <span>● FC (FULL COMBO)</span>
                        <span>
                            {hovered.item.fc}개 (
                            {hovered.item.total > 0 ? Math.round((hovered.item.fc / hovered.item.total) * 100) : 0}%)
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                            color: "var(--color-clear)",
                            marginBottom: "0.25rem",
                        }}
                    >
                        <span>● CLEAR (C)</span>
                        <span>
                            {hovered.item.clear}개 (
                            {hovered.item.total > 0 ? Math.round((hovered.item.clear / hovered.item.total) * 100) : 0}%)
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                            color: "var(--text-muted)",
                        }}
                    >
                        <span>● NC / 미클리어</span>
                        <span>
                            {hovered.item.unplayed}개 (
                            {hovered.item.total > 0
                                ? Math.round((hovered.item.unplayed / hovered.item.total) * 100)
                                : 0}
                            %)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
