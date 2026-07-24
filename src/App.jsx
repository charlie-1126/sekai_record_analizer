import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
    Lock,
    Trophy,
    Clock,
    Star,
} from "lucide-react";
import "./App.css";

// Modular Subcomponents
import { Dashboard } from "./components/Dashboard/Dashboard";
import { Records } from "./components/Records/Records";
import { Constants } from "./components/Constants/Constants";
import Pattern from "./components/Pattern/Pattern";
import { Tour } from "./components/Tour/Tour";
import { Calculator as CalculatorTab } from "./components/Calculator/Calculator";
import History from "./components/History/History";
import { Compare } from "./components/Compare/Compare";
import { Ranking } from "./components/Ranking/Ranking";
import Distributions from "./components/Distributions/Distributions";
import SettingsTab from "./components/Settings/Settings";
import PrivacySettingsModal from "./components/Settings/PrivacySettingsModal";
import Admin from "./components/Admin/Admin";
import { Recommend } from "./components/Recommend/Recommend";
import AuthModal from "./components/Auth/AuthModal";
import ImportPreviewModal from "./components/Records/ImportPreviewModal";
import ExportModal from "./components/Records/ExportModal";
import JacketDetailsModal from "./components/Common/JacketDetailsModal";
import UpdateNotesModal, { UPDATE_NOTES } from "./components/Common/UpdateNotesModal";

// Rating Utils
import { calculateRating, getConstant, hasExplicitConstant, calculateTempRatings } from "./utils/ratingUtils";
import {
    computePotentialRating,
    calculateTempPotential,
    getTierInfo,
    getTierDisplayName,
} from "./utils/potentialUtils";
import { PotentialDashboard } from "./components/Dashboard/PotentialDashboard";
import { defaultSort } from "./utils/scoreUtils";
import {
    computeUpdatedDatesOnStatusChange,
    updateDatesForDiff,
    getFcApDates,
    getKstISOString,
} from "./utils/dateUtils";

function App() {
    // --- Routing Hooks ---
    const navigate = useNavigate();
    const location = useLocation();

    const getActiveTab = () => {
        const path = location.pathname;
        if (path.startsWith("/dashboard")) return "dashboard";
        if (path.startsWith("/records")) return "records";
        if (path.startsWith("/history")) return "history";
        if (path.startsWith("/constants")) return "constants";
        if (path.startsWith("/pattern")) return "pattern";
        if (path.startsWith("/tour")) return "tour";
        if (path.startsWith("/calculator")) return "calculator";
        if (path.startsWith("/compare")) return "compare";
        if (path.startsWith("/distributions")) return "distributions";
        if (path.startsWith("/ranking")) return "ranking";
        if (path.startsWith("/recommend")) return "recommend";
        if (path.startsWith("/settings")) return "settings";
        if (path.startsWith("/admin")) return "admin";
        return "dashboard"; // fallback
    };
    const activeTab = getActiveTab();

    const matchRoute = location.pathname.match(
        /^\/(?:dashboard|records|history|constants|pattern|tour|calculator|compare|distributions|ranking|recommend|settings|admin)(?:\/([^/]+))?\/?$/,
    );
    const routeUsername = matchRoute ? matchRoute[1] : undefined;

    const setActiveTab = (tab) => {
        if (routeUsername && !["settings", "admin"].includes(tab)) {
            navigate("/" + tab + "/" + routeUsername);
        } else {
            navigate("/" + tab);
        }
    };

    // --- Viewed User States ---
    const [viewedUser, setViewedUser] = useState(null);
    const [viewedScores, setViewedScores] = useState(null);
    const [isViewedDashboardLoading, setIsViewedDashboardLoading] = useState(false);
    const [viewedDashboardError, setViewedDashboardError] = useState("");

    // --- Core States ---
    const [songs, setSongs] = useState([]);
    const [scores, setScores] = useState([]);
    const [isLoadingSongs, setIsLoadingSongs] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openMobileAccordions, setOpenMobileAccordions] = useState({ records: false, tools: false });

    // --- Rating Mode Toggle: "b39" | "potential" ---
    const [ratingMode, setRatingMode] = useState(() => {
        return localStorage.getItem("pjsk_rating_mode") || "b39";
    });
    const toggleRatingMode = () => {
        const next = ratingMode === "b39" ? "potential" : "b39";
        setRatingMode(next);
        localStorage.setItem("pjsk_rating_mode", next);
        if (currentUser) {
            handleSaveSettings(undefined, undefined, next, undefined);
        }
    };

    // --- Unreleased Songs Visibility State ---
    const [showUnreleased, setShowUnreleased] = useState(() => {
        const saved = localStorage.getItem("pjsk_show_unreleased");
        return saved === null ? true : saved === "true";
    });
    const toggleShowUnreleased = (value) => {
        setShowUnreleased(value);
        localStorage.setItem("pjsk_show_unreleased", String(value));
        if (currentUser) {
            handleSaveSettings(undefined, undefined, undefined, value);
        }
    };

    // --- Filtered songs to exclude unreleased songs if setting is true ---
    const visibleSongs = useMemo(() => {
        if (showUnreleased) return songs;
        return songs.filter((song) => {
            if (!song.publishedAt) return true;
            return Number(song.publishedAt) <= Date.now();
        });
    }, [songs, showUnreleased]);

    // --- Jacket Click Popup State ---
    const [selectedJacketSong, setSelectedJacketSong] = useState(null);
    const [calculatorTarget, setCalculatorTarget] = useState(null); // { song, diff }

    // --- Auth States ---
    // [Fix M-4] Wrap JSON.parse to prevent app crash if localStorage is corrupted
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const saved = localStorage.getItem("pjsk_auth") || sessionStorage.getItem("pjsk_auth");
            return saved ? JSON.parse(saved) : null;
        } catch {
            localStorage.removeItem("pjsk_auth");
            sessionStorage.removeItem("pjsk_auth");
            return null;
        }
    });

    const effectiveScores = viewedScores ? viewedScores : scores;
    const effectiveUser = viewedUser ? viewedUser : currentUser;
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    // --- Friends & Settings States ---
    const [friendsList, setFriendsList] = useState([]);
    const [settingsNickname, setSettingsNickname] = useState("");
    const [settingsTitleLang, setSettingsTitleLang] = useState("jp");
    const [trainerSpeed, setTrainerSpeed] = useState(() => {
        return localStorage.getItem("pjsk_trainer_speed") || "10.5";
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState("");

    // --- Import Preview Modal States ---
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [pendingImportScores, setPendingImportScores] = useState(null);
    const [previewCalculatedData, setPreviewCalculatedData] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);

    const fileInputRef = useRef(null);
    const skipNextFetch = useRef(false);
    // Tracks whether a score-save is in-flight (C-2: prevents polling from overwriting optimistic UI)
    const isSyncingScores = useRef(false);
    // Shows a brief error message when server sync fails (e.g. offline)
    const [syncError, setSyncError] = useState("");

    // --- Update Notes Modal States ---
    const [showUpdateNotesModal, setShowUpdateNotesModal] = useState(false);
    const latestVersionStr = UPDATE_NOTES[0]?.version || "v1.4.0";

    useEffect(() => {
        const lastViewed = localStorage.getItem("pjsk_last_viewed_update");
        if (lastViewed !== latestVersionStr) {
            // Check if lastViewed exists to avoid bothering first-time visitors immediately,
            // or we can auto-display for all users who haven't seen this specific version
            setShowUpdateNotesModal(true);
        }
    }, [latestVersionStr]);

    const handleCloseUpdateNotes = () => {
        localStorage.setItem("pjsk_last_viewed_update", latestVersionStr);
        setShowUpdateNotesModal(false);
    };

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
            const headers = {};
            if (currentUser && currentUser.token) {
                headers["Authorization"] = `Bearer ${currentUser.token}`;
            } else {
                // Fallback to localStorage if state is not updated yet
                const raw = localStorage.getItem("pjsk_auth") || sessionStorage.getItem("pjsk_auth");
                if (raw) {
                    try {
                        const saved = JSON.parse(raw);
                        if (saved && saved.token) {
                            headers["Authorization"] = `Bearer ${saved.token}`;
                        }
                    } catch (err) {
                        console.error("Failed to parse token for fetching scores:", err);
                    }
                }
            }
            const res = await fetch(`/api/scores/user/${username}`, { headers });
            if (res.ok) {
                const data = await res.json();
                if (data.scores) {
                    setScores(data.scores);
                    localStorage.setItem("pjsk_user_scores", JSON.stringify(data.scores));
                }
                if (data.rating_history) {
                    setCurrentUser((prev) => {
                        if (!prev) return prev;
                        if (JSON.stringify(prev.rating_history) === JSON.stringify(data.rating_history)) {
                            return prev;
                        }
                        const updated = {
                            ...prev,
                            rating_history: data.rating_history,
                        };
                        localStorage.setItem("pjsk_auth", JSON.stringify(updated));
                        return updated;
                    });
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
    // previousScores: the scores state before the change, used to revert on failure.
    // Pass null to skip revert (e.g. on initial login sync).
    const syncScoresToServer = async (
        userObj,
        currentScores,
        previousScores,
        ratingObj,
        modifications = null,
        replace = false,
    ) => {
        if (!userObj) return;

        let ratings = ratingObj;
        if (!ratings) {
            const tempCalc = calculateTempRatings(currentScores, songs);
            const tempPot = calculateTempPotential(currentScores, songs);
            ratings = {
                normal: tempCalc.playerRating,
                append: tempCalc.playerAppendRating,
                potential: tempPot.potential4,
            };
        }

        isSyncingScores.current = true;
        try {
            const payload = {
                username: userObj.username,
                ratings: ratings,
            };
            if (replace) {
                payload.scores = currentScores;
                payload.replace = true;
            } else if (modifications) {
                payload.modifications = modifications;
            } else {
                payload.scores = currentScores;
            }

            const res = await fetch("/api/scores", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${userObj.token}`,
                },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.scores) {
                    setScores(data.scores);
                    localStorage.setItem("pjsk_user_scores", JSON.stringify(data.scores));
                }
                if (data.rating_history) {
                    setCurrentUser((prev) => {
                        if (!prev) return prev;
                        if (JSON.stringify(prev.rating_history) === JSON.stringify(data.rating_history)) {
                            return prev;
                        }
                        const updated = { ...prev, rating_history: data.rating_history };
                        localStorage.setItem("pjsk_auth", JSON.stringify(updated));
                        return updated;
                    });
                }
            } else {
                // Server returned an error — revert the optimistic UI update
                if (previousScores !== null) {
                    setScores(previousScores);
                    localStorage.setItem("pjsk_user_scores", JSON.stringify(previousScores));
                }
                setSyncError("저장 실패: 서버 오류가 발생했습니다. 변경사항이 취소되었습니다.");
                setTimeout(() => setSyncError(""), 4000);
            }
        } catch (e) {
            // Network error (offline) — revert the optimistic UI update
            console.error("Failed to sync scores to server:", e);
            if (previousScores !== null) {
                setScores(previousScores);
                localStorage.setItem("pjsk_user_scores", JSON.stringify(previousScores));
            }
            setSyncError("오프라인 상태입니다. 인터넷 연결을 확인해 주세요.");
            setTimeout(() => setSyncError(""), 4000);
        } finally {
            isSyncingScores.current = false;
        }
    };

    const updateScores = (newScores, previousScores, modifications = null, replace = false) => {
        // Optimistic update: apply immediately in UI and localStorage
        setScores(newScores);
        localStorage.setItem("pjsk_user_scores", JSON.stringify(newScores));
        if (currentUser) {
            const tempCalc = calculateTempRatings(newScores, songs);
            const tempPot = calculateTempPotential(newScores, songs);
            const ratingObj = {
                normal: tempCalc.playerRating,
                append: tempCalc.playerAppendRating,
                potential: tempPot.potential4,
            };
            // Pass previousScores so the sync can revert on failure
            syncScoresToServer(currentUser, newScores, previousScores, ratingObj, modifications, replace);
        }
        // Guest users: localStorage is the only store, no revert needed
    };

    // --- Song Title Localization Helper ---
    const getSongTitle = (song) => {
        if (!song) return "";
        if (settingsTitleLang === "ko") {
            return song.title_ko || song.title_jp || "";
        }
        return song.title_jp || song.title_ko || "";
    };

    const handleScoreChange = (songId, diff, newStatus, customDates = null) => {
        const previousScores = scores; // snapshot before change for revert-on-failure
        const existIdx = scores.findIndex((s) => String(s.id) === String(songId));
        let newScores = [...scores];

        const sanitizeStatus = (status) => {
            return status === "none" ? null : status;
        };

        const existingScore = existIdx !== -1 ? scores[existIdx] : null;

        let finalDates;
        if (customDates !== null) {
            finalDates = customDates;
        } else {
            finalDates = computeUpdatedDatesOnStatusChange(existingScore, diff, sanitizeStatus(newStatus));
        }

        if (existIdx !== -1) {
            newScores[existIdx] = {
                ...newScores[existIdx],
                [diff]: sanitizeStatus(newStatus),
                dates: finalDates,
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
                dates: finalDates,
            });
        }
        updateScores(newScores, previousScores, [
            { id: String(songId), diff, status: sanitizeStatus(newStatus), dates: finalDates },
        ]);
    };

    const handleDateChange = (songId, diff, dateType, dateValue) => {
        const previousScores = scores;
        const existIdx = scores.findIndex((s) => String(s.id) === String(songId));
        let newScores = [...scores];
        const existingScore = existIdx !== -1 ? scores[existIdx] : null;

        const finalDates = updateDatesForDiff(existingScore, diff, dateType, dateValue);
        const currentStatus = existingScore && existingScore[diff] ? existingScore[diff] : null;

        if (existIdx !== -1) {
            newScores[existIdx] = {
                ...newScores[existIdx],
                dates: finalDates,
            };
        } else {
            newScores.push({
                id: String(songId),
                easy: null,
                normal: null,
                hard: null,
                expert: null,
                master: null,
                append: null,
                dates: finalDates,
            });
        }
        updateScores(newScores, previousScores, [
            { id: String(songId), diff, status: currentStatus, dates: finalDates },
        ]);
    };

    const handleJacketClick = (song, diff, currentStatus) => {
        if (viewedUser) return;
        setSelectedJacketSong({ song, diff, status: currentStatus });
    };

    const handleNavigateToCalculator = (song, diff) => {
        setCalculatorTarget({ song, diff });
        setActiveTab("calculator");
        setSelectedJacketSong(null);
    };

    // --- Profile & Settings Saver Handler ---
    const handleSaveSettings = async (
        newNickname,
        newTitleLang,
        newRatingMode,
        newShowUnreleased,
        newTrainerSpeed,
        newPrivacyTarget,
        newPrivacyScope
    ) => {
        // [Fix Race Condition] Read directly from storage to ensure we use the absolute latest settings object
        let currentStoredSettings = {};
        try {
            const raw = localStorage.getItem("pjsk_auth") || sessionStorage.getItem("pjsk_auth");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.settings) {
                    currentStoredSettings = parsed.settings;
                }
            }
        } catch (e) {
            console.error("Failed to parse stored settings for saving:", e);
        }

        const nicknameToSave = newNickname !== undefined ? newNickname : settingsNickname;
        const langToSave = newTitleLang !== undefined ? newTitleLang : settingsTitleLang;
        const ratingModeToSave = newRatingMode !== undefined ? newRatingMode : ratingMode;
        const showUnreleasedToSave = newShowUnreleased !== undefined ? newShowUnreleased : showUnreleased;
        const trainerSpeedToSave = newTrainerSpeed !== undefined ? newTrainerSpeed : trainerSpeed;

        const privacyTargetToSave = newPrivacyTarget !== undefined ? newPrivacyTarget : (currentStoredSettings.privacyTarget || currentUser?.settings?.privacyTarget || "public");
        const privacyScopeToSave = newPrivacyScope !== undefined ? newPrivacyScope : (currentStoredSettings.privacyScope || currentUser?.settings?.privacyScope || {
            publicScope: { showDashboardSongs: true, showDetailedScores: false, showTimeline: false },
            friendsScope: { showDashboardSongs: true, showDetailedScores: true, showTimeline: true }
        });

        if (newTrainerSpeed !== undefined) {
            setTrainerSpeed(newTrainerSpeed);
            localStorage.setItem("pjsk_trainer_speed", newTrainerSpeed);
        }

        if (!currentUser) {
            // Local state updates are already done above
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
                ratingMode: ratingModeToSave,
                showUnreleased: showUnreleasedToSave,
                trainerSpeed: trainerSpeedToSave,
                privacyTarget: privacyTargetToSave,
                privacyScope: privacyScopeToSave,
            };
            const res = await fetch("/api/user/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // [Fix H-3] Send token for requireAuth middleware
                    Authorization: `Bearer ${currentUser.token}`,
                },
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

    const handleLogout = () => {
        if (window.confirm("로그아웃 하시겠습니까?")) {
            setCurrentUser(null);
            localStorage.removeItem("pjsk_auth");
            sessionStorage.removeItem("pjsk_auth");
            localStorage.removeItem("pjsk_user_scores");
            setScores([]);
        }
    };

    const handleLoginSuccess = async (userObj, finalScores, autoLogin, shouldSync = false) => {
        setScores(finalScores);
        localStorage.setItem("pjsk_user_scores", JSON.stringify(finalScores));

        skipNextFetch.current = true;

        setCurrentUser(userObj);
        if (autoLogin) {
            localStorage.setItem("pjsk_auth", JSON.stringify(userObj));
        } else {
            sessionStorage.setItem("pjsk_auth", JSON.stringify(userObj));
        }

        if (shouldSync) {
            await syncScoresToServer(userObj, finalScores);
        }
    };

    // --- Handle Custom File Upload ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                let newScores = data.scores || (Array.isArray(data) ? data : null);

                if (newScores && Array.isArray(newScores)) {
                    // Check if the uploaded JSON is proprietary format or standard format
                    const isSekaitoolFormat = data.format === "sekaitool" || newScores.some(s => s.dates && Object.keys(s.dates).length > 0);

                    if (!isSekaitoolFormat) {
                        // Sekaforce compatible format: merge existing dates so they aren't wiped out!
                        const currentScoresMap = new Map();
                        scores.forEach(s => {
                            if (s && s.id) {
                                currentScoresMap.set(String(s.id), s);
                            }
                        });

                        newScores = newScores.map(importedItem => {
                            const existingItem = currentScoresMap.get(String(importedItem.id));
                            const mergedItem = { ...importedItem };
                            let mergedDates = existingItem && existingItem.dates ? JSON.parse(JSON.stringify(existingItem.dates)) : {};

                            // Clean up and merge dates based on imported status (no automatic today's date generation)
                            const difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
                            difficulties.forEach(diff => {
                                const newStatus = importedItem[diff];

                                if (!newStatus || newStatus === 'none') {
                                    if (mergedDates[diff]) {
                                        mergedDates[diff] = {
                                            fc: null,
                                            ap: null
                                        };
                                    }
                                } else if (newStatus === 'full_combo') {
                                    const currentFc = mergedDates[diff]?.fc || null;
                                    mergedDates[diff] = {
                                        fc: currentFc,
                                        ap: null
                                    };
                                } else if (newStatus === 'full_perfect') {
                                    const currentFc = mergedDates[diff]?.fc || null;
                                    const currentAp = mergedDates[diff]?.ap || null;
                                    mergedDates[diff] = {
                                        fc: currentFc,
                                        ap: currentAp
                                    };
                                }
                            });

                            mergedItem.dates = mergedDates;
                            return mergedItem;
                        });
                    } else {
                        // sekaitool proprietary format: load dates from file, fall back to existing dates for missing ones
                        const currentScoresMap = new Map();
                        scores.forEach(s => {
                            if (s && s.id) {
                                currentScoresMap.set(String(s.id), s);
                            }
                        });

                        newScores = newScores.map(importedItem => {
                            const existingItem = currentScoresMap.get(String(importedItem.id));
                            const mergedItem = { ...importedItem };

                            if (!mergedItem.dates && existingItem && existingItem.dates) {
                                mergedItem.dates = JSON.parse(JSON.stringify(existingItem.dates));
                            }
                            return mergedItem;
                        });
                    }

                    const calculated = calculateTempRatings(newScores, songs);
                    setPendingImportScores(newScores);
                    setPreviewCalculatedData(calculated);
                    setShowImportPreview(true);

                    // Reset input
                    e.target.value = "";
                } else {
                    alert("올바르지 않은 JSON 파일입니다.");
                }
            } catch (err) {
                console.error(err);
                alert("JSON 파싱 에러.");
            }
        };
        reader.readAsText(file);
    };

    const confirmImport = () => {
        if (pendingImportScores) {
            const previousScores = scores; // snapshot to revert to if server save fails
            updateScores(pendingImportScores, previousScores, null, true);
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

    // --- Open Export Format Selection Dialog ---
    const handleFileDownload = () => {
        setShowExportModal(true);
    };

    // --- Export in Sekaforce Compatible Format (excludes dates) ---
    const exportSekaforceFormat = () => {
        if (!songs || songs.length === 0) {
            alert("곡 데이터가 로드되지 않았습니다.");
            return;
        }

        const scoreMap = new Map();
        const scoresToExport = effectiveScores;
        if (scoresToExport && Array.isArray(scoresToExport)) {
            scoresToExport.forEach((s) => {
                if (s && s.id) {
                    scoreMap.set(String(s.id), s);
                }
            });
        }

        const sanitizeValue = (val) => {
            if (val === undefined || val === null || val === "none" || val === "") return null;
            return val;
        };

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
            exportedAt: getKstISOString(),
            scores: completeScores,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const exportUser = effectiveUser;
        const filename = exportUser
            ? `${exportUser.nickname || exportUser.username}_sekaforce_scores.json`
            : "sekaforce_scores.json";
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- Export in sekaitool Proprietary Format (includes dates) ---
    const exportProprietaryFormat = () => {
        if (!songs || songs.length === 0) {
            alert("곡 데이터가 로드되지 않았습니다.");
            return;
        }

        const scoreMap = new Map();
        const scoresToExport = effectiveScores;
        if (scoresToExport && Array.isArray(scoresToExport)) {
            scoresToExport.forEach((s) => {
                if (s && s.id) {
                    scoreMap.set(String(s.id), s);
                }
            });
        }

        const sanitizeValue = (val) => {
            if (val === undefined || val === null || val === "none" || val === "") return null;
            return val;
        };

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
                dates: playRecord && playRecord.dates ? playRecord.dates : null,
            };
        });

        const exportData = {
            format: "sekaitool",
            version: 2,
            exportedAt: getKstISOString(),
            scores: completeScores,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const exportUser = effectiveUser;
        const filename = exportUser
            ? `${exportUser.nickname || exportUser.username}_sekaitool_scores.json`
            : "sekaitool_scores.json";
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    // --- Auto Login Session Recovery & Initialization ---
    useEffect(() => {
        const initAuth = async () => {
            let saved;
            try {
                // [Fix M-4] Safe parse of stored auth
                const raw = localStorage.getItem("pjsk_auth") || sessionStorage.getItem("pjsk_auth");
                saved = raw ? JSON.parse(raw) : null;
            } catch {
                localStorage.removeItem("pjsk_auth");
                sessionStorage.removeItem("pjsk_auth");
                saved = null;
            }
            if (saved) {
                try {
                    if (saved && saved.token) {
                        const res = await fetch(`/api/auth/me?token=${saved.token}`);
                        if (res.ok) {
                            const data = await res.json();
                            const userObj = {
                                username: data.user.username,
                                nickname: data.user.nickname,
                                token: saved.token,
                                role:
                                    data.user.role || (data.user.username.toLowerCase() === "admin" ? "admin" : "user"),
                                friends: data.user.friends || [],
                                settings: data.user.settings || { songTitleLang: "jp" },
                                rating_history: data.user.rating_history || {},
                            };
                            setCurrentUser(userObj);

                            // Server is the single source of truth for logged-in users.
                            // Offline edits are not supported: scores are only saved when the
                            // server request succeeds (see syncScoresToServer revert logic).
                            const finalScores = data.user.scores || [];
                            setScores(finalScores);
                            localStorage.setItem("pjsk_user_scores", JSON.stringify(finalScores));
                            setSettingsNickname(data.user.nickname);
                            setSettingsTitleLang(data.user.settings?.songTitleLang || "jp");
                            setRatingMode(data.user.settings?.ratingMode || "b39");
                            setShowUnreleased(data.user.settings?.showUnreleased !== false);
                            const speed = data.user.settings?.trainerSpeed || "10.5";
                            setTrainerSpeed(speed);
                            localStorage.setItem("pjsk_trainer_speed", speed);
                            fetchFriendsList(data.user.username);
                        } else {
                            // Invalid token
                            setCurrentUser(null);
                            localStorage.removeItem("pjsk_auth");
                            sessionStorage.removeItem("pjsk_auth");
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
            if (skipNextFetch.current) {
                skipNextFetch.current = false;
            } else {
                fetchScoresFromServer(currentUser.username);
            }
            fetchFriendsList(currentUser.username);
            setSettingsNickname(currentUser.nickname);
            setSettingsTitleLang(currentUser.settings?.songTitleLang || "jp");
            setRatingMode(currentUser.settings?.ratingMode || "b39");
            setShowUnreleased(currentUser.settings?.showUnreleased !== false);
            const speed = currentUser.settings?.trainerSpeed || "10.5";
            setTrainerSpeed(speed);
            localStorage.setItem("pjsk_trainer_speed", speed);
        } else {
            setRatingMode(localStorage.getItem("pjsk_rating_mode") || "b39");
            const savedUnreleased = localStorage.getItem("pjsk_show_unreleased");
            setShowUnreleased(savedUnreleased === null ? true : savedUnreleased === "true");
            setSettingsTitleLang("jp");
            setTrainerSpeed(localStorage.getItem("pjsk_trainer_speed") || "10.5");

            setScores([]);
            setFriendsList([]);
        }
    }, [currentUser]);

    // --- Active Tab Syncing for Concurrent Device Sync ---
    useEffect(() => {
        if (!currentUser) return;

        const syncData = () => {
            // [Fix C-2] Skip polling if a save is currently in-flight to prevent
            // stale server data from overwriting a freshly-changed local score.
            if (isSyncingScores.current) return;
            if (document.visibilityState === "visible") {
                fetchScoresFromServer(currentUser.username);
                fetchFriendsList(currentUser.username);
            }
        };

        const interval = setInterval(syncData, 15000);
        document.addEventListener("visibilitychange", syncData);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", syncData);
        };
    }, [currentUser]);
    // Redirect / to /dashboard
    useEffect(() => {
        if (location.pathname === "/" || location.pathname === "") {
            navigate("/dashboard", { replace: true });
        }
    }, [location.pathname, navigate]);

    // Fetch viewed user details for other people's dashboard
    useEffect(() => {
        if (routeUsername) {
            if (currentUser && currentUser.username.toLowerCase() === routeUsername.toLowerCase()) {
                setViewedUser(null);
                setViewedScores(null);
                setViewedDashboardError("");
                return;
            }

            const fetchViewedUserData = async () => {
                setIsViewedDashboardLoading(true);
                setViewedDashboardError("");
                try {
                    const headers = {};
                    if (currentUser && currentUser.token) {
                        headers["Authorization"] = `Bearer ${currentUser.token}`;
                    }
                    const res = await fetch(`/api/scores/user/${routeUsername}`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        setViewedUser({
                            username: data.username,
                            nickname: data.nickname,
                            rating_history: data.rating_history || {},
                            privacyScope: data.privacyScope || 'all',
                            ratings: data.ratings,
                            overallStats: data.overallStats,
                        });
                        setViewedScores(data.scores || []);
                    } else if (res.status === 404) {
                        setViewedDashboardError("해당 유저를 찾을 수 없습니다.");
                    } else if (res.status === 403) {
                        const data = await res.json();
                        setViewedDashboardError(data.error || "비공개 프로필입니다.");
                    } else {
                        setViewedDashboardError("유저 정보를 불러오는 중 에러가 발생했습니다.");
                    }
                } catch (err) {
                    console.error("Error fetching viewed user data:", err);
                    setViewedDashboardError("서버와의 통신에 실패했습니다.");
                } finally {
                    setIsViewedDashboardLoading(false);
                }
            };
            fetchViewedUserData();
        } else {
            setViewedUser(null);
            setViewedScores(null);
            setViewedDashboardError("");
        }
    }, [routeUsername, currentUser]);

    // --- Score mapping helper ---
    const userScoresMap = useMemo(() => {
        const map = new Map();
        effectiveScores.forEach((s) => {
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
    }, [effectiveScores]);

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

        return list.sort((a, b) => {
            if (b.rating !== a.rating) {
                return b.rating - a.rating;
            }
            // 레이팅이 같을 때(반올림으로 인한 동점): 상수 내림차순
            const constDiff = b.constant - a.constant;
            if (constDiff !== 0) {
                return constDiff;
            }
            return defaultSort(a, b);
        });
    }, [userScoresMap, songs]);

    // --- Top 39 (B39) & Player R ---
    const b39List = useMemo(() => {
        return allRatings.slice(0, 39);
    }, [allRatings]);

    const playerRating = useMemo(() => {
        if (viewedUser && viewedUser.privacyScope?.showDashboardSongs === false) {
            return viewedUser.ratings?.normal || 0;
        }
        const sum = b39List.reduce((acc, curr) => acc + curr.rating, 0);
        return Math.round(sum);
    }, [b39List, viewedUser]);

    // --- Potential Rating ---
    const potentialData = useMemo(() => {
        if (viewedUser && viewedUser.privacyScope?.showDashboardSongs === false) {
            return {
                potential4: viewedUser.ratings?.potential || 0.0,
                potential2: viewedUser.ratings?.potential || 0.0,
                oldBest30: [],
                newBest10: [],
            };
        }
        return computePotentialRating(songs, userScoresMap);
    }, [songs, userScoresMap, viewedUser]);

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

        return list.sort((a, b) => {
            if (b.rating !== a.rating) {
                return b.rating - a.rating;
            }
            // 레이팅이 같을 때(반올림으로 인한 동점): 상수 내림차순
            const constDiff = b.constant - a.constant;
            if (constDiff !== 0) {
                return constDiff;
            }
            return defaultSort(a, b);
        });
    }, [userScoresMap, songs]);

    const appendB15List = useMemo(() => {
        return appendRatings.slice(0, 15);
    }, [appendRatings]);

    // Append R = sum(B15) * 2.6
    const playerAppendRating = useMemo(() => {
        if (viewedUser && viewedUser.privacyScope?.showDashboardSongs === false) {
            return viewedUser.ratings?.append || 0;
        }
        const sum = appendB15List.reduce((acc, curr) => acc + curr.rating, 0);
        return Math.round(sum * 2.6);
    }, [appendB15List, viewedUser]);

    // --- Overall stats ---
    const overallStats = useMemo(() => {
        if (viewedUser && viewedUser.overallStats) {
            return viewedUser.overallStats;
        }

        let totalPlayed = 0;
        let apCount = 0;
        let fcCount = 0;
        let clearCount = 0;

        effectiveScores.forEach((s) => {
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

        return {
            totalPlayed,
            apCount,
            fcCount,
            clearCount,
        };
    }, [effectiveScores, viewedUser]);

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
                    <div className="logo-section" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                            style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}
                            onClick={() => {
                                if (routeUsername) {
                                    navigate("/dashboard/" + routeUsername);
                                } else {
                                    navigate("/dashboard");
                                }
                            }}
                        >
                            <span className="logo-icon">🎵</span>
                            <h1 className="logo-text">SEKAITOOL</h1>
                        </div>
                        {viewedUser && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    background: "rgba(0, 242, 254, 0.1)",
                                    border: "1px solid rgba(0, 242, 254, 0.25)",
                                    color: "#00f2fe",
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    userSelect: "none",
                                    transition: "all 0.2s",
                                    maxWidth: "150px",
                                    minWidth: 0,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/" + activeTab);
                                }}
                                title="내 정보로 돌아가기"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(0, 242, 254, 0.2)";
                                    e.currentTarget.style.borderColor = "rgba(0, 242, 254, 0.4)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(0, 242, 254, 0.1)";
                                    e.currentTarget.style.borderColor = "rgba(0, 242, 254, 0.25)";
                                }}
                            >
                                <span
                                    style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                    }}
                                >
                                    {viewedUser.nickname || viewedUser.username}
                                </span>
                                <span
                                    style={{
                                        marginLeft: "0.25rem",
                                        opacity: 0.7,
                                        fontSize: "0.7rem",
                                        background: "rgba(255,255,255,0.15)",
                                        borderRadius: "50%",
                                        width: "12px",
                                        height: "12px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: "normal",
                                        flexShrink: 0,
                                    }}
                                >
                                    ✕
                                </span>
                            </div>
                        )}
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
                        <div
                            className={`nav-dropdown ${["records", "constants", "pattern"].includes(activeTab) ? "active" : ""}`}
                        >
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
                                    className={`nav-dropdown-item ${activeTab === "history" ? "active" : ""}`}
                                    onClick={() => setActiveTab("history")}
                                >
                                    <Clock size={14} /> 타임라인
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "constants" ? "active" : ""}`}
                                    onClick={() => setActiveTab("constants")}
                                >
                                    <Layers size={14} /> 상수표
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "pattern" ? "active" : ""}`}
                                    onClick={() => setActiveTab("pattern")}
                                >
                                    <Settings size={14} /> 패턴상수
                                </button>
                            </div>
                        </div>

                        {/* Dropdown 2: 도구 */}
                        <div
                            className={`nav-dropdown ${["distributions", "tour", "calculator", "compare", "recommend"].includes(activeTab) ? "active" : ""}`}
                        >
                            <button className={`btn btn-outline dropdown-trigger`}>
                                <Calculator size={16} /> 도구 <ChevronDown size={14} />
                            </button>
                            <div className="nav-dropdown-menu">
                                <button
                                    className={`nav-dropdown-item ${activeTab === "recommend" ? "active" : ""}`}
                                    onClick={() => setActiveTab("recommend")}
                                    style={{ color: activeTab === "recommend" ? "#a78bfa" : undefined }}
                                >
                                    <Star size={14} /> 곡 추천
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
                                    onClick={() => setActiveTab("compare")}
                                >
                                    <Users size={14} /> 기록 비교
                                </button>
                                <button
                                    className={`nav-dropdown-item ${activeTab === "distributions" ? "active" : ""}`}
                                    onClick={() => setActiveTab("distributions")}
                                >
                                    <BarChart3 size={14} /> 분포
                                </button>
                            </div>
                        </div>

                        <button
                            className={`btn btn-outline ${activeTab === "ranking" ? "active" : ""}`}
                            onClick={() => setActiveTab("ranking")}
                        >
                            <Trophy size={16} /> 랭킹
                        </button>

                        {currentUser && currentUser.username.toLowerCase() === "admin" && (
                            <button
                                className={`btn btn-outline ${activeTab === "admin" ? "active" : ""}`}
                                onClick={() => setActiveTab("admin")}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    borderColor: "var(--color-pink)",
                                    color: "var(--color-pink)",
                                }}
                            >
                                <Users size={16} /> 회원 관리
                            </button>
                        )}

                        {currentUser && (
                            <>
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
                            </>
                        )}

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
                                    SEKAITOOL
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
                            {effectiveUser ? (
                                <div className="drawer-user-info">
                                    <div className="user-name">
                                        <UserCheck
                                            size={18}
                                            style={{ color: viewedUser ? "var(--color-purple)" : "var(--color-cyan)" }}
                                        />
                                        <span>
                                            {effectiveUser.nickname}
                                            {viewedUser ? " (조회 중)" : "님"}
                                        </span>
                                    </div>
                                    <div className="user-ratings">
                                        {ratingMode === "b39" ? (
                                            <>
                                                <div className="rating-badge rating-normal">B39: {playerRating}</div>
                                                <div className="rating-badge rating-append">
                                                    B15: {playerAppendRating}
                                                </div>
                                            </>
                                        ) : (
                                            <div
                                                className="rating-badge"
                                                style={{
                                                    background: "rgba(199,125,255,0.15)",
                                                    color: "#c77dff",
                                                    border: "1px solid rgba(199,125,255,0.3)",
                                                }}
                                            >
                                                Potential: {potentialData.potential2.toFixed(2)}
                                            </div>
                                        )}
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
                                        ["records", "history", "constants", "pattern"].includes(activeTab)
                                            ? "active-parent"
                                            : ""
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
                                        className={`drawer-sub-item ${activeTab === "history" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("history");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        타임라인
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
                                    <button
                                        className={`drawer-sub-item ${activeTab === "pattern" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("pattern");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        패턴상수
                                    </button>
                                </div>
                            </div>

                            {/* Accordion 2: 도구 */}
                            <div className="drawer-accordion">
                                <button
                                    className={`drawer-accordion-trigger ${
                                        ["distributions", "tour", "calculator", "compare", "recommend"].includes(
                                            activeTab,
                                        )
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
                                        className={`drawer-sub-item ${activeTab === "recommend" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("recommend");
                                            setIsMobileMenuOpen(false);
                                        }}
                                        style={{ color: activeTab === "recommend" ? "#a78bfa" : undefined }}
                                    >
                                        곡 추천
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
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        기록 비교
                                    </button>
                                    <button
                                        className={`drawer-sub-item ${activeTab === "distributions" ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveTab("distributions");
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        분포
                                    </button>
                                </div>
                            </div>

                            <button
                                className={`drawer-menu-item ${activeTab === "ranking" ? "active" : ""}`}
                                onClick={() => {
                                    setActiveTab("ranking");
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <Trophy size={18} /> 랭킹
                            </button>

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

                            {currentUser && currentUser.username.toLowerCase() === "admin" && (
                                <button
                                    className={`drawer-menu-item ${activeTab === "admin" ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveTab("admin");
                                        setIsMobileMenuOpen(false);
                                    }}
                                    style={{ color: "var(--color-pink)" }}
                                >
                                    <Users size={18} /> 회원 관리
                                </button>
                            )}

                            <button
                                className="drawer-menu-item"
                                onClick={() => {
                                    setShowUpdateNotesModal(true);
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <Sparkles size={18} /> 업데이트 노트
                            </button>
                        </div>

                        {/* Drawer Actions */}
                        {currentUser && (
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
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODALS */}
            <ImportPreviewModal
                isOpen={showImportPreview}
                onCancel={cancelImport}
                onConfirm={confirmImport}
                previewCalculatedData={previewCalculatedData}
                playerRating={playerRating}
                playerAppendRating={playerAppendRating}
                overallStats={overallStats}
            />

            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onExportSekaforce={exportSekaforceFormat}
                onExportProprietary={exportProprietaryFormat}
            />

            <JacketDetailsModal
                selectedJacketSong={selectedJacketSong}
                setSelectedJacketSong={setSelectedJacketSong}
                settingsTitleLang={settingsTitleLang}
                handleScoreChange={handleScoreChange}
                handleDateChange={handleDateChange}
                trainerSpeed={trainerSpeed}
                isLoggedIn={!viewedUser && !!currentUser}
                scores={effectiveScores}
                onNavigateToCalculator={handleNavigateToCalculator}
                viewedUser={viewedUser}
            />

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                songs={songs}
                onLoginSuccess={handleLoginSuccess}
            />

            <UpdateNotesModal isOpen={showUpdateNotesModal} onClose={handleCloseUpdateNotes} />

            <PrivacySettingsModal
                isOpen={showPrivacyModal}
                onClose={() => setShowPrivacyModal(false)}
                currentUser={currentUser}
                handleSaveSettings={handleSaveSettings}
                settingsNickname={settingsNickname}
                settingsTitleLang={settingsTitleLang}
                ratingMode={ratingMode}
                showUnreleased={showUnreleased}
                trainerSpeed={trainerSpeed}
            />

            <main className={`container ${activeTab === "pattern" ? "pattern-full-width" : ""}`} style={{ flex: 1 }}>
                {isViewedDashboardLoading && ["dashboard", "records", "history"].includes(activeTab) ? (
                    <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-muted)" }}>
                        <div
                            className="loading-spinner"
                            style={{
                                display: "inline-block",
                                width: "40px",
                                height: "40px",
                                border: "4px solid rgba(255,255,255,0.1)",
                                borderRadius: "50%",
                                borderTopColor: "var(--color-cyan)",
                                animation: "spin 1s linear infinite",
                                marginBottom: "1rem",
                            }}
                        ></div>
                        <style>{`
                            @keyframes spin {
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                        <div style={{ fontWeight: "700" }}>유저 정보를 불러오는 중입니다...</div>
                    </div>
                ) : !isViewedDashboardLoading && viewedDashboardError && ["dashboard", "records", "history"].includes(activeTab) ? (
                    <div
                        className="glass-panel"
                        style={{
                            textAlign: "center",
                            padding: "4rem 2rem",
                            margin: "2rem auto",
                            maxWidth: "500px",
                            border: "1px solid rgba(220,53,69,0.2)",
                        }}
                    >
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                        <h3
                            style={{
                                fontSize: "1.2rem",
                                marginBottom: "1.5rem",
                                fontWeight: "700",
                                color: "var(--color-danger)",
                            }}
                        >
                            {viewedDashboardError}
                        </h3>
                        <button className="btn btn-primary animate-glow" onClick={() => {
                            setViewedUser(null);
                            setViewedScores(null);
                            setViewedDashboardError("");
                            navigate("/dashboard");
                        }}>
                            내 대시보드로 돌아가기
                        </button>
                    </div>
                ) : (
                    <>
                        {activeTab === "dashboard" &&
                            (ratingMode === "potential" ? (
                                <PotentialDashboard
                                    effectiveUser={effectiveUser}
                                    potentialRating={potentialData.potential4}
                                    oldBest30={potentialData.oldBest30}
                                    newBest10={potentialData.newBest10}
                                    isViewedDashboardLoading={isViewedDashboardLoading}
                                    viewedDashboardError={viewedDashboardError}
                                    viewedUser={viewedUser}
                                    settingsTitleLang={settingsTitleLang}
                                />
                            ) : (
                                <Dashboard
                                    effectiveUser={effectiveUser}
                                    playerRating={playerRating}
                                    playerAppendRating={playerAppendRating}
                                    b39List={b39List}
                                    appendB15List={appendB15List}
                                    overallStats={overallStats}
                                    isViewedDashboardLoading={isViewedDashboardLoading}
                                    viewedDashboardError={viewedDashboardError}
                                    viewedUser={viewedUser}
                                    settingsTitleLang={settingsTitleLang}
                                />
                            ))}

                        {activeTab === "ranking" && (
                            <Ranking
                                currentUser={effectiveUser}
                                ratingMode={ratingMode}
                                myNormalRating={playerRating}
                                myAppendRating={playerAppendRating}
                                myPotentialRating={potentialData.potential4}
                                myApCount={overallStats.apCount}
                                myFcCount={overallStats.fcCount}
                                myClearCount={overallStats.clearCount}
                            />
                        )}

                        {activeTab === "records" && (
                            <Records
                                songs={visibleSongs}
                                scores={effectiveScores}
                                updateScores={updateScores}
                                settingsTitleLang={settingsTitleLang}
                                ratingMode={ratingMode}
                                isLoggedIn={!viewedUser && !!currentUser}
                                onJacketClick={handleJacketClick}
                                viewedUser={viewedUser}
                            />
                        )}

                        {activeTab === "history" && (
                            <History
                                songs={visibleSongs}
                                scores={effectiveScores}
                                settingsTitleLang={settingsTitleLang}
                                setSelectedJacketSong={setSelectedJacketSong}
                                setActiveTab={setActiveTab}
                                viewedUser={viewedUser}
                            />
                        )}
                    </>
                )}

                {activeTab === "constants" && (
                    <Constants
                        songs={visibleSongs}
                        scores={effectiveScores}
                        onJacketClick={handleJacketClick}
                        settingsTitleLang={settingsTitleLang}
                        ratingMode={ratingMode}
                        b39List={b39List}
                        potentialData={potentialData}
                    />
                )}

                {activeTab === "pattern" && (
                    <Pattern songs={visibleSongs} currentUser={currentUser} settingsTitleLang={settingsTitleLang} />
                )}

                {activeTab === "tour" && (
                    <Tour
                        songs={visibleSongs}
                        scores={effectiveScores}
                        onJacketClick={handleJacketClick}
                        settingsTitleLang={settingsTitleLang}
                        ratingMode={ratingMode}
                    />
                )}

                {activeTab === "calculator" && (
                    <CalculatorTab
                        songs={visibleSongs}
                        playerRating={playerRating}
                        playerAppendRating={playerAppendRating}
                        b39List={b39List}
                        appendB15List={appendB15List}
                        allRatings={allRatings}
                        appendRatings={appendRatings}
                        settingsTitleLang={settingsTitleLang}
                        ratingMode={ratingMode}
                        potentialData={potentialData}
                        userScoresMap={userScoresMap}
                        initialTarget={calculatorTarget}
                        clearInitialTarget={() => setCalculatorTarget(null)}
                    />
                )}

                {activeTab === "compare" && (
                    <Compare
                        currentUser={effectiveUser}
                        scores={effectiveScores}
                        songs={visibleSongs}
                        friendsList={friendsList}
                        fetchFriendsList={fetchFriendsList}
                        settingsTitleLang={settingsTitleLang}
                        ratingMode={ratingMode}
                    />
                )}

                {activeTab === "settings" && (
                    <SettingsTab
                        currentUser={currentUser}
                        setShowAuthModal={setShowAuthModal}
                        settingsNickname={settingsNickname}
                        setSettingsNickname={setSettingsNickname}
                        settingsTitleLang={settingsTitleLang}
                        setSettingsTitleLang={setSettingsTitleLang}
                        handleSaveSettings={handleSaveSettings}
                        isLoadingSongs={isLoadingSongs}
                        fetchSongsFromServer={fetchSongsFromServer}
                        settingsMessage={settingsMessage}
                        setSettingsMessage={setSettingsMessage}
                        handleLogout={handleLogout}
                        ratingMode={ratingMode}
                        toggleRatingMode={toggleRatingMode}
                        showUnreleased={showUnreleased}
                        toggleShowUnreleased={toggleShowUnreleased}
                        trainerSpeed={trainerSpeed}
                        setTrainerSpeed={setTrainerSpeed}
                        showPrivacyModal={showPrivacyModal}
                        setShowPrivacyModal={setShowPrivacyModal}
                    />
                )}

                {activeTab === "admin" && <Admin currentUser={currentUser} />}

                {activeTab === "distributions" && (
                    <Distributions songs={visibleSongs} userScoresMap={userScoresMap} ratingMode={ratingMode} />
                )}

                {activeTab === "recommend" && (
                    <Recommend
                        songs={visibleSongs}
                        userScoresMap={userScoresMap}
                        b39List={b39List}
                        appendB15List={appendB15List}
                        potentialData={potentialData}
                        ratingMode={ratingMode}
                        settingsTitleLang={settingsTitleLang}
                        onJacketClick={handleJacketClick}
                    />
                )}
            </main>

            {/* Offline / sync-failure toast */}
            {syncError && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "1.5rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(255,80,80,0.92)",
                        color: "#fff",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "0.75rem",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                        zIndex: 9999,
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                    }}
                >
                    ⚠ {syncError}
                </div>
            )}
        </div>
    );
}

export default App;
