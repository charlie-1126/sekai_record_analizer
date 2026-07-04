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
} from "lucide-react";
import "./App.css";

// Modular Subcomponents
import { Dashboard } from "./components/Dashboard/Dashboard";
import { Records } from "./components/Records/Records";
import { Constants } from "./components/Constants/Constants";
import Pattern from "./components/Pattern/Pattern";
import { Tour } from "./components/Tour/Tour";
import { Calculator as CalculatorTab } from "./components/Calculator/Calculator";
import { Compare } from "./components/Compare/Compare";
import { Ranking } from "./components/Ranking/Ranking";
import Distributions from "./components/Distributions/Distributions";
import SettingsTab from "./components/Settings/Settings";
import Admin from "./components/Admin/Admin";
import AuthModal from "./components/Auth/AuthModal";
import ImportPreviewModal from "./components/Records/ImportPreviewModal";
import JacketDetailsModal from "./components/Common/JacketDetailsModal";
import UpdateNotesModal from "./components/Common/UpdateNotesModal";

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


function App() {
    // --- Routing Hooks ---
    const navigate = useNavigate();
    const location = useLocation();

    const getActiveTab = () => {
        const path = location.pathname;
        if (path.startsWith("/dashboard")) return "dashboard";
        if (path.startsWith("/records")) return "records";
        if (path.startsWith("/constants")) return "constants";
        if (path.startsWith("/pattern")) return "pattern";
        if (path.startsWith("/tour")) return "tour";
        if (path.startsWith("/calculator")) return "calculator";
        if (path.startsWith("/compare")) return "compare";
        if (path.startsWith("/distributions")) return "distributions";
        if (path.startsWith("/ranking")) return "ranking";
        if (path.startsWith("/settings")) return "settings";
        if (path.startsWith("/admin")) return "admin";
        return "dashboard"; // fallback
    };
    const activeTab = getActiveTab();

    const setActiveTab = (tab) => {
        navigate("/" + tab);
    };

    const matchDashboard = location.pathname.match(/^\/dashboard(?:\/([^/]+))?\/?$/);
    const routeUsername = matchDashboard ? matchDashboard[1] : undefined;

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

    const effectiveScores = activeTab === "dashboard" && viewedScores ? viewedScores : scores;
    const effectiveUser = activeTab === "dashboard" && viewedUser ? viewedUser : currentUser;
    const [showAuthModal, setShowAuthModal] = useState(false);

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

    const fileInputRef = useRef(null);
    const skipNextFetch = useRef(false);
    // Tracks whether a score-save is in-flight (C-2: prevents polling from overwriting optimistic UI)
    const isSyncingScores = useRef(false);
    // Shows a brief error message when server sync fails (e.g. offline)
    const [syncError, setSyncError] = useState("");

    // --- Update Notes Modal States ---
    const [showUpdateNotesModal, setShowUpdateNotesModal] = useState(false);

    useEffect(() => {
        const latestVer = "v1.3.0";
        const lastViewed = localStorage.getItem("pjsk_last_viewed_update");
        if (lastViewed !== latestVer) {
            // Check if lastViewed exists to avoid bothering first-time visitors immediately, 
            // or we can auto-display for all users who haven't seen this specific version
            setShowUpdateNotesModal(true);
        }
    }, []);

    const handleCloseUpdateNotes = () => {
        localStorage.setItem("pjsk_last_viewed_update", "v1.3.0");
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
            const res = await fetch(`/api/scores/user/${username}`);
            if (res.ok) {
                const data = await res.json();
                if (data.scores) {
                    setScores(data.scores);
                    localStorage.setItem("pjsk_user_scores", JSON.stringify(data.scores));
                }
                if (data.rating_history) {
                    setCurrentUser(prev => {
                        if (!prev) return prev;
                        if (JSON.stringify(prev.rating_history) === JSON.stringify(data.rating_history)) {
                            return prev;
                        }
                        const updated = {
                            ...prev,
                            rating_history: data.rating_history
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
    const syncScoresToServer = async (userObj, currentScores, previousScores, ratingObj, modifications = null, replace = false) => {
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
                    "Authorization": `Bearer ${userObj.token}`,
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
                    setCurrentUser(prev => {
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

    const handleScoreChange = (songId, diff, newStatus) => {
        const previousScores = scores; // snapshot before change for revert-on-failure
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
        updateScores(newScores, previousScores, [{ id: String(songId), diff, status: sanitizeStatus(newStatus) }]);
    };

    const handleJacketClick = (song, diff, currentStatus) => {
        setSelectedJacketSong({ song, diff, status: currentStatus });
    };

    const handleNavigateToCalculator = (song, diff) => {
        setCalculatorTarget({ song, diff });
        setActiveTab("calculator");
        setSelectedJacketSong(null);
    };

    // --- Profile & Settings Saver Handler ---
    const handleSaveSettings = async (newNickname, newTitleLang, newRatingMode, newShowUnreleased, newTrainerSpeed) => {
        const nicknameToSave = newNickname !== undefined ? newNickname : settingsNickname;
        const langToSave = newTitleLang !== undefined ? newTitleLang : settingsTitleLang;
        const ratingModeToSave = newRatingMode !== undefined ? newRatingMode : ratingMode;
        const showUnreleasedToSave = newShowUnreleased !== undefined ? newShowUnreleased : showUnreleased;
        const trainerSpeedToSave = newTrainerSpeed !== undefined ? newTrainerSpeed : trainerSpeed;

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
            };
            const res = await fetch("/api/user/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // [Fix H-3] Send token for requireAuth middleware
                    "Authorization": `Bearer ${currentUser.token}`,
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
                const newScores = data.scores || (Array.isArray(data) ? data : null);

                if (newScores && Array.isArray(newScores)) {
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
                                role: data.user.role || (data.user.username.toLowerCase() === "admin" ? "admin" : "user"),
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
                    const res = await fetch(`/api/scores/user/${routeUsername}`);
                    if (res.ok) {
                        const data = await res.json();
                        setViewedUser({
                            username: data.username,
                            nickname: data.nickname,
                            rating_history: data.rating_history || {},
                        });
                        setViewedScores(data.scores || []);
                    } else if (res.status === 404) {
                        setViewedDashboardError("해당 유저를 찾을 수 없습니다.");
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
            return defaultSort(a, b);
        });
    }, [userScoresMap, songs]);

    // --- Top 39 (B39) & Player R ---
    const b39List = useMemo(() => {
        return allRatings.slice(0, 39);
    }, [allRatings]);

    const playerRating = useMemo(() => {
        const sum = b39List.reduce((acc, curr) => acc + curr.rating, 0);
        return Math.round(sum);
    }, [b39List]);

    // --- Potential Rating ---
    const potentialData = useMemo(() => {
        return computePotentialRating(songs, userScoresMap);
    }, [songs, userScoresMap]);

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
            return defaultSort(a, b);
        });
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

        return {
            totalPlayed,
            apCount,
            fcCount,
            clearCount,
        };
    }, [scores]);

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
                            <h1 className="logo-text">SEKAITOOL</h1>
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
                        <div className={`nav-dropdown ${["records", "constants", "pattern"].includes(activeTab) ? "active" : ""}`}>
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
                            className={`nav-dropdown ${["distributions", "tour", "calculator", "compare"].includes(activeTab) ? "active" : ""}`}
                        >
                            <button className={`btn btn-outline dropdown-trigger`}>
                                <Calculator size={16} /> 도구 <ChevronDown size={14} />
                            </button>
                            <div className="nav-dropdown-menu">
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
                            {currentUser ? (
                                <div className="drawer-user-info">
                                    <div className="user-name">
                                        <UserCheck size={18} style={{ color: "var(--color-cyan)" }} />
                                        <span>{currentUser.nickname}님</span>
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
                                        ["records", "constants", "pattern"].includes(activeTab) ? "active-parent" : ""
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

            <JacketDetailsModal
                selectedJacketSong={selectedJacketSong}
                setSelectedJacketSong={setSelectedJacketSong}
                settingsTitleLang={settingsTitleLang}
                handleScoreChange={handleScoreChange}
                trainerSpeed={trainerSpeed}
                isLoggedIn={!!currentUser}
                scores={scores}
                onNavigateToCalculator={handleNavigateToCalculator}
            />

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                songs={songs}
                onLoginSuccess={handleLoginSuccess}
            />

            <UpdateNotesModal
                isOpen={showUpdateNotesModal}
                onClose={handleCloseUpdateNotes}
            />

            <main className={`container ${activeTab === "pattern" ? "pattern-full-width" : ""}`} style={{ flex: 1 }}>
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
                        currentUser={currentUser}
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
                        scores={scores}
                        updateScores={updateScores}
                        settingsTitleLang={settingsTitleLang}
                        ratingMode={ratingMode}
                        isLoggedIn={!!currentUser}
                        onJacketClick={handleJacketClick}
                    />
                )}

                {activeTab === "constants" && (
                    <Constants
                        songs={visibleSongs}
                        scores={scores}
                        onJacketClick={handleJacketClick}
                        settingsTitleLang={settingsTitleLang}
                        ratingMode={ratingMode}
                        b39List={b39List}
                        potentialData={potentialData}
                    />
                )}

                {activeTab === "pattern" && (
                    <Pattern
                        songs={visibleSongs}
                        currentUser={currentUser}
                        settingsTitleLang={settingsTitleLang}
                    />
                )}

                {activeTab === "tour" && (
                    <Tour
                        songs={visibleSongs}
                        scores={scores}
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
                        currentUser={currentUser}
                        scores={scores}
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
                    />
                )}

                {activeTab === "admin" && <Admin currentUser={currentUser} />}

                {activeTab === "distributions" && (
                    <Distributions songs={visibleSongs} userScoresMap={userScoresMap} ratingMode={ratingMode} />
                )}
            </main>

            {/* Offline / sync-failure toast */}
            {syncError && (
                <div style={{
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
                }}>
                    ⚠ {syncError}
                </div>
            )}
        </div>
    );
}

export default App;
