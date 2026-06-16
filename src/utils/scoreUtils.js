/**
 * scoreUtils.js
 * Client-side score utility helpers.
 *
 * mergeScores: Merges two score arrays using "best status wins" strategy.
 * This mirrors the server-side mergeScores function in server.cjs.
 * It is used on the client when syncing local (possibly-offline-edited) scores
 * back to the server to prevent data loss after offline edits.
 */

const STATUS_RANK = {
    full_perfect: 3,
    full_combo: 2,
    clear: 1,
};

const getStatusRank = (status) => STATUS_RANK[status] ?? 0;

const getBetterStatus = (s1, s2) => {
    return getStatusRank(s1) >= getStatusRank(s2) ? s1 : s2;
};

/**
 * Merges localScores and serverScores, keeping the better (higher) status for
 * each (songId, difficulty) pair. Songs present only in one source are included as-is.
 *
 * @param {Array} localScores  - Score array from localStorage (possibly offline-edited).
 * @param {Array} serverScores - Score array from the server (authoritative baseline).
 * @returns {Array} Merged score array.
 */
export function mergeScores(localScores, serverScores) {
    const mergedMap = new Map();

    // 1. Seed map with server scores (the authoritative baseline).
    if (Array.isArray(serverScores)) {
        for (const score of serverScores) {
            if (score && score.id) {
                mergedMap.set(String(score.id), { ...score });
            }
        }
    }

    // 2. Overlay local scores, taking the better status for each difficulty.
    if (Array.isArray(localScores)) {
        for (const score of localScores) {
            if (score && score.id) {
                const idStr = String(score.id);
                const existing = mergedMap.get(idStr);
                if (existing) {
                    mergedMap.set(idStr, {
                        id: idStr,
                        easy:   getBetterStatus(score.easy,   existing.easy),
                        normal: getBetterStatus(score.normal, existing.normal),
                        hard:   getBetterStatus(score.hard,   existing.hard),
                        expert: getBetterStatus(score.expert, existing.expert),
                        master: getBetterStatus(score.master, existing.master),
                        append: getBetterStatus(score.append, existing.append),
                    });
                } else {
                    mergedMap.set(idStr, { ...score });
                }
            }
        }
    }

    return Array.from(mergedMap.values());
}

/**
 * Default sorting function based on the following priorities:
 * 1. Song type: Non-originals first, Originals last.
 * 2. Unit code order: VS -> L/n -> MMJ -> VBS -> WxS -> N25 -> Oth.
 * 3. Release date (publishedAt) ascending.
 * 4. Song ID ascending as final fallback.
 */
export function defaultSort(a, b) {
    const songA = a.song || a;
    const songB = b.song || b;

    // 1. Song Type: original (value 1), non-original (value 0)
    const typeA = songA.original ? 1 : 0;
    const typeB = songB.original ? 1 : 0;
    if (typeA !== typeB) {
        return typeA - typeB;
    }

    // 2. Unit Order: VS -> L/n -> MMJ -> VBS -> WxS -> N25 -> Oth
    const unitOrder = { "VS": 0, "L/n": 1, "MMJ": 2, "VBS": 3, "WxS": 4, "N25": 5, "Oth": 6 };
    const unitA = unitOrder[songA.unit_code] !== undefined ? unitOrder[songA.unit_code] : 7;
    const unitB = unitOrder[songB.unit_code] !== undefined ? unitOrder[songB.unit_code] : 7;
    if (unitA !== unitB) {
        return unitA - unitB;
    }

    // 3. Release Date (publishedAt) ascending
    const timeA = songA.publishedAt ? Number(songA.publishedAt) : 0;
    const timeB = songB.publishedAt ? Number(songB.publishedAt) : 0;
    if (timeA !== timeB) {
        return timeA - timeB;
    }

    // 4. Fallback to Song ID ascending
    return Number(songA.id) - Number(songB.id);
}

