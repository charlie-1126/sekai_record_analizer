/**
 * potentialUtils.js
 * New "Potential" rating system utilities.
 * Separate from the legacy B39 system.
 */

import { getConstant } from "./ratingUtils";

// ─────────────────────────────────────────
// 1. New-song detection
// ─────────────────────────────────────────

/** 출시된 지 90일(3개월) 이하이면 신곡으로 간주 */
export const isNewSong = (song) => {
    if (!song || !song.publishedAt) return false;
    const publishedAt = Number(song.publishedAt);
    if (!publishedAt || publishedAt <= 0) return false;
    const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
    return Date.now() - publishedAt < threeMonthsMs;
};

/** publishedAt 타임스탬프를 "YYYY.MM.DD" 문자열로 변환 */
export const formatPublishedDate = (publishedAt) => {
    if (!publishedAt) return null;
    const d = new Date(Number(publishedAt));
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${dd}`;
};

// ─────────────────────────────────────────
// 2. Per-song Potential calculation
// ─────────────────────────────────────────

/**
 * 곡의 Potential을 계산합니다.
 *   AP → 상수 + 2.0
 *   FC → 상수 + 0.0
 *   C  → 0
 * 결과가 0 이하이면 0을 반환합니다.
 */
export const calculateSongPotential = (song, diff, status) => {
    if (!status || status === "none") return 0;

    if (status === "full_perfect") {
        const constant = getConstant(song, diff, "full_perfect");
        return Math.max(0, constant + 2.0);
    } else if (status === "full_combo") {
        const constant = getConstant(song, diff, "full_combo");
        return Math.max(0, constant);
    } else if (status === "clear") {
        return 0;
    }
    return 0;
};

// ─────────────────────────────────────────
// 3. Full Potential rating computation
// ─────────────────────────────────────────

/**
 * 전체 Potential 레이팅을 계산합니다.
 * - Old Best 30 (신곡이 아닌 곡들 중 상위 30개)
 * - New Best 10 (신곡 중 상위 10개)
 * - 총 40곡의 Potential 평균
 * 내부 저장용: 소수점 4자리, 표시용: 소수점 2자리 내림
 *
 * @param {Array} songs - 전체 곡 목록
 * @param {Map}   userScoresMap - 유저 점수 맵 (id → {easy, normal, ...})
 * @param {string[]} [diffList] - 집계할 난이도 (기본: easy/normal/hard/expert/master)
 * @returns {{ potential4: number, potential2: number, oldBest30: Array, newBest10: Array, allOldPotentials: Array, allNewPotentials: Array }}
 */
export const computePotentialRating = (songs, userScoresMap, diffList = null) => {
    const difficulties = diffList || ["easy", "normal", "hard", "expert", "master", "append"];

    const oldEntries = []; // 신곡 아닌 곡
    const newEntries = []; // 신곡

    songs.forEach((song) => {
        const userPlay = userScoresMap.get(String(song.id));
        if (!userPlay) return;

        const songIsNew = isNewSong(song);

        difficulties.forEach((diff) => {
            const status = userPlay[diff];
            if (!status || status === "none") return;

            const potential = calculateSongPotential(song, diff, status);
            if (potential <= 0) return;

            const entry = {
                song,
                diff,
                status,
                level: song.levels?.[diff] || 0,
                constant: getConstant(song, diff, status),
                potential,
                isNew: songIsNew,
            };

            if (songIsNew) {
                newEntries.push(entry);
            } else {
                oldEntries.push(entry);
            }
        });
    });

    // 각각 내림차순 정렬
    oldEntries.sort((a, b) => b.potential - a.potential);
    newEntries.sort((a, b) => b.potential - a.potential);

    const oldBest30 = oldEntries.slice(0, 30);
    const newBest10 = newEntries.slice(0, 10);

    const combined = [...oldBest30, ...newBest10];
    const totalCount = combined.length;

    let potential4 = 0;
    if (totalCount > 0) {
        const sum = combined.reduce((acc, e) => acc + e.potential, 0);
        // 내부: 소수점 4자리
        potential4 = Math.floor((sum / 40) * 10000) / 10000;
    }

    // 표시용: 소수점 2자리 내림
    const potential2 = Math.floor(potential4 * 100) / 100;

    return {
        potential4,
        potential2,
        oldBest30,
        newBest10,
        allOldPotentials: oldEntries,
        allNewPotentials: newEntries,
    };
};

// ─────────────────────────────────────────
// 4. Tier system
// ─────────────────────────────────────────

/**
 * 포텐셜 값으로 티어 정보를 반환합니다.
 *
 * 티어 컷:
 *   개전 34~    (0.5마다 ★ 1개, 34.0부터는 개전 기본)
 *   마스터 32~  (4범위 / 4클래스 = 1당 클래스 1)
 *   다이아몬드 30~ (2범위 / 4클래스 = 0.5당 클래스 1)
 *   플레티넘 28~ (2범위 / 4클래스 = 0.5당 클래스 1)
 *   골드 24~    (4범위 / 4클래스 = 1당 클래스 1)
 *   실버 20~    (4범위 / 4클래스 = 1당 클래스 1)
 *   브론즈 16~  (4범위 / 4클래스 = 1당 클래스 1)
 *   비기너 <16
 *
 * @param {number} potential - 내부 저장용 4자리 포텐셜
 * @returns {{ name: string, class: string|null, stars: number, color: string, gradient: string, rank: number }}
 */
export const getTierInfo = (potential) => {
    const p = potential;

    if (p >= 34) {
        // 개전: 34.0부터 시작, 0.5마다 별 1개
        const stars = Math.floor((p - 34) / 0.5);
        return {
            name: "개전",
            class: null,
            stars,
            color: "tier-kaiden",
            gradient: "linear-gradient(135deg, #ff325b 0%, #9b70ff 50%, #00dcfe 100%)",
            textGradient: true,
            rank: 8,
        };
    }

    if (p >= 32) {
        // 마스터: 32~34 (범위 2), 1당 클래스 1 → 32.0~32.99=1, 33.0~33.49=2, 등
        // 실제: 4클래스 나누면 (34-32)/4 = 0.5당 1클래스
        const classNum = Math.min(4, Math.floor((p - 32) / 0.5) + 1);
        return {
            name: "마스터",
            class: classNum,
            stars: 0,
            color: "tier-master",
            gradient: "linear-gradient(135deg, #9ad5fd 0%, #bba1fe 50%, #ff9ffa 100%)",
            textGradient: true,
            rank: 7,
        };
    }

    if (p >= 30) {
        // 다이아몬드: 30~32 (범위 2), 0.5당 클래스 1
        const classNum = Math.min(4, Math.floor((p - 30) / 0.5) + 1);
        return {
            name: "다이아몬드",
            class: classNum,
            stars: 0,
            color: "tier-diamond",
            gradient: "linear-gradient(135deg, #caf5fa 0%, #a1faff 50%, #50fcff 100%)",
            textGradient: true,
            rank: 6,
        };
    }

    if (p >= 28) {
        // 플레티넘: 28~30 (범위 2), 0.5당 클래스 1
        const classNum = Math.min(4, Math.floor((p - 28) / 0.5) + 1);
        return {
            name: "플레티넘",
            class: classNum,
            stars: 0,
            color: "tier-platinum",
            gradient: "linear-gradient(135deg, #b9b4fb 0%, #a1aaff 50%, #5c68eb 100%)",
            textGradient: true,
            rank: 5,
        };
    }

    if (p >= 24) {
        // 골드: 24~28 (범위 4), 1당 클래스 1
        const classNum = Math.min(4, Math.floor(p - 24) + 1);
        return {
            name: "골드",
            class: classNum,
            stars: 0,
            color: "tier-gold",
            gradient: "linear-gradient(135deg, #fef08a 0%, #fbbf24 50%, #f59e0b 100%)",
            textGradient: true,
            rank: 4,
        };
    }

    if (p >= 20) {
        // 실버: 20~24 (범위 4), 1당 클래스 1
        const classNum = Math.min(4, Math.floor(p - 20) + 1);
        return {
            name: "실버",
            class: classNum,
            stars: 0,
            color: "tier-silver",
            gradient: "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #94a3b8 100%)",
            textGradient: true,
            rank: 3,
        };
    }

    if (p >= 16) {
        // 브론즈: 16~20 (범위 4), 1당 클래스 1
        const classNum = Math.min(4, Math.floor(p - 16) + 1);
        return {
            name: "브론즈",
            class: classNum,
            stars: 0,
            color: "tier-bronze",
            gradient: "linear-gradient(135deg, #ffedd5 0%, #d97706 50%, #b45309 100%)",
            textGradient: true,
            rank: 2,
        };
    }

    // 비기너
    return {
        name: "비기너",
        class: null,
        stars: 0,
        color: "tier-beginner",
        gradient: "linear-gradient(135deg, #ceffce 0%, #abff9a 50%, #1ced23 100%)",
        textGradient: true,
        rank: 1,
    };
};

/**
 * 티어의 전체 표시 이름을 반환합니다.
 * 예) "마스터 3", "개전 ★★", "비기너"
 */
export const getTierDisplayName = (tierInfo) => {
    if (!tierInfo) return "";
    const { name, class: cls, stars } = tierInfo;

    if (name === "개전") {
        return stars > 0 ? `개전 ${"★".repeat(stars)}` : "개전";
    }
    if (cls !== null && cls !== undefined) {
        return `${name} ${cls}`;
    }
    return name;
};

// ─────────────────────────────────────────
// 5. Temp calculation (for import preview etc.)
// ─────────────────────────────────────────

/**
 * calculateTempRatings의 Potential 버전.
 * 임포트 미리보기나 점수 동기화 시 사용합니다.
 */
export const calculateTempPotential = (newScoresList, songs) => {
    const tempMap = new Map();
    newScoresList.forEach((s) => {
        if (s && s.id) {
            tempMap.set(String(s.id), {
                easy: s.easy,
                normal: s.normal,
                hard: s.hard,
                expert: s.expert,
                master: s.master,
                append: s.append,
            });
        }
    });

    const result = computePotentialRating(songs, tempMap);
    return result;
};
