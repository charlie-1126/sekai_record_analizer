import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Seoul");

export { dayjs };

/**
 * Returns today's date formatted as YYYY-MM-DD in KST (Asia/Seoul, UTC+9).
 */
export const getTodayString = () => {
    return dayjs().tz("Asia/Seoul").format("YYYY-MM-DD");
};

/**
 * Returns current timestamp formatted as ISO string in KST (Asia/Seoul, UTC+9).
 */
export const getKstISOString = (date = undefined) => {
    return dayjs(date).tz("Asia/Seoul").format("YYYY-MM-DDTHH:mm:ssZ");
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
 */
export const computeUpdatedDatesOnStatusChange = (existingScore, diff, newStatus) => {
    const currentDates = getFcApDates(existingScore, diff);
    let updatedFc = currentDates.fc || null;
    let updatedAp = currentDates.ap || null;

    if (newStatus === "full_combo") {
        updatedAp = null;
    } else if (newStatus === "full_perfect") {
        // Keeps existing dates
    } else {
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
