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
