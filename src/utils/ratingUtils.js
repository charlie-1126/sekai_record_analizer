export const getRelativePercentages = (valA, valB, isPotential = false) => {
    if (valA === 0 && valB === 0) return { pctA: 50, pctB: 50 };
    if (valA === 0) return { pctA: 0, pctB: 100 };
    if (valB === 0) return { pctA: 100, pctB: 0 };

    const diff = Math.abs(valA - valB);

    if (diff === 0) return { pctA: 50, pctB: 50 };

    // Scale differently depending on whether it's Potential (range ~40) or B39 rating (range ~4000)
    const scale = isPotential
        ? (diff <= 8 ? 10 : diff + 2)
        : (diff <= 1600 ? 2000 : diff + 400);

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

export const calculateRating = (song, diff, status) => {
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

export const hasExplicitConstant = (song, diff, status) => {
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

export const getConstant = (song, diff, status) => {
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

export const calculateTempRatings = (newScoresList, songs) => {
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

    const tempAllRatings = [];
    songs.forEach((song) => {
        const userPlay = tempMap.get(String(song.id));
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
        const userPlay = tempMap.get(String(song.id));
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

export const getSongTitle = (song, titleLang) => {
    if (!song) return "";
    if (titleLang === "ko") {
        return song.title_ko || song.title_jp || "";
    }
    return song.title_jp || song.title_ko || "";
};

