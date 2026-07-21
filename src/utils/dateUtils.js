/**
 * dateUtils.js
 * Utilities for recording and managing FC (Full Combo) and AP (All Perfect) achievement dates.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in KST (Asia/Seoul, UTC+9).
 * Guaranteed to produce Korea Standard Time regardless of device or server timezone.
 */
export const getTodayString = () => {
    try {
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        return formatter.format(new Date());
    } catch (e) {
        const now = new Date();
        const kstTime = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
        const year = kstTime.getFullYear();
        const month = String(kstTime.getMonth() + 1).padStart(2, "0");
        const day = String(kstTime.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
};

/**
 * Returns current timestamp formatted as ISO string in KST (Asia/Seoul, UTC+9).
 */
export const getKstISOString = (date = new Date()) => {
    try {
        const d = new Date(date);
        const formatter = new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const parts = formatter.formatToParts(d);
        const map = {};
        parts.forEach((p) => {
            map[p.type] = p.value;
        });
        return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+09:00`;
    } catch (e) {
        const d = new Date(date);
        const kstTime = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000);
        return kstTime.toISOString().replace("Z", "+09:00");
    }
};

/**
 * Safely extracts FC and AP dates for a specific difficulty from a song score object.
 * Returns { fc: string, ap: string }
 */
export const getFcApDates = (songScore, diff) => {
    if (!songScore || !songScore.dates) return { fc: "", ap: "" };
    const diffDates = songScore.dates[diff] || {};
    const fc = diffDates.fc || songScore.dates[`${diff}_fc`] || "";
    const ap = diffDates.ap || songScore.dates[`${diff}_ap`] || "";
    return { fc: fc || "", ap: ap || "" };
};

/**
 * Computes the updated dates object for a song score when its status is changed.
 * If an FC or AP date is already recorded and differs from today, prompts the user whether to overwrite.
 */
export const computeUpdatedDatesOnStatusChange = (existingScore, diff, newStatus) => {
    const currentDates = getFcApDates(existingScore, diff);
    let updatedFc = currentDates.fc || null;
    let updatedAp = currentDates.ap || null;

    if (newStatus === "full_combo") {
        // FC 설정 시 기존 FC 날짜 유지 (없으면 null), AP 날짜 지우기
        updatedAp = null;
    } else if (newStatus === "full_perfect") {
        // AP 설정 시 기존 FC/AP 날짜 유지 (없으면 null)
    } else {
        // NC 또는 Clear 설정 시 FC 및 AP 날짜 모두 지우기
        updatedFc = null;
        updatedAp = null;
    }

    const existingAllDates = existingScore && existingScore.dates ? existingScore.dates : {};
    return {
        ...existingAllDates,
        [diff]: {
            fc: updatedFc,
            ap: updatedAp,
        },
    };
};

/**
 * Updates a single date (fc or ap) manually for a given song score and difficulty.
 */
export const updateDatesForDiff = (existingScore, diff, dateType, dateValue) => {
    const currentDates = getFcApDates(existingScore, diff);
    const existingAllDates = existingScore && existingScore.dates ? existingScore.dates : {};

    return {
        ...existingAllDates,
        [diff]: {
            ...currentDates,
            [dateType]: dateValue || null,
        },
    };
};
