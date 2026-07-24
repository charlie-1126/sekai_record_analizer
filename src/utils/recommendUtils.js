/**
 * recommendUtils.js
 *
 * 레이팅 상승 효율 기반 곡 추천 알고리즘
 *
 * 핵심 공식:
 *   Final Score = (Δ × P(x)) × (1 + α × sim(U, Sw))
 *
 * 모드:
 *   - b39: 일반 B39 + APD B15 분리 추천
 *   - potential: 포텐셜 (구곡 B30 + 신곡 B10) 평균 방식
 */

import { getConstant } from "./ratingUtils";
import { isNewSong } from "./potentialUtils";

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 취향 가중치 상수 */
const ALPHA = 0.3;
/** 어펜드 가중치 상수 */
const GAMMA = 0.5;
/** 로지스틱 상수 */
const K = 2.3;
/** 베이지안 신뢰도 임계값 */
const BAYESIAN_C = 2.0;
/** AP 변환 상수 보너스 */
const AP_BONUS = 2.0;
/** B39 레이팅 계산 배율 */
const B39_MULTIPLIERS = { clear: 5.0, full_combo: 7.5, full_perfect: 8.0 };
/** 포텐셜 레이팅 분모 (40곡 평균) */
const POTENTIAL_DIVISOR = 40;

// ─────────────────────────────────────────
// A. 변환상수 (Converted Constant)
// ─────────────────────────────────────────

/**
 * 유저 기록에서 변환상수를 계산한다.
 * - C  → 0
 * - FC → 곡 상수
 * - AP → 곡 상수 + 2.0
 *
 * @param {object} song  - 곡 객체
 * @param {string} diff  - 난이도
 * @param {string} status - 'clear' | 'full_combo' | 'full_perfect'
 * @returns {number} 변환상수
 */
export function getConvertedConstant(song, diff, status) {
    if (!status || status === "none") return 0;
    const raw = getConstant(song, diff, status);
    if (!raw || raw <= 0) return 0;
    if (status === "full_perfect") return raw + AP_BONUS;
    if (status === "full_combo") return raw;
    return 0; // clear
}

// ─────────────────────────────────────────
// B. 유저 기준 체급(μ) 계산
// ─────────────────────────────────────────

/**
 * 유저의 상위 39개 기록의 변환상수를 계산하고 체급을 반환한다.
 *
 * @param {Array}  songs        - 전체 곡 목록
 * @param {Map}    userScoresMap - 유저 점수 맵
 * @returns {{
 *   mu: number,            // 전체 변환상수 평균
 *   muFC: number,          // 상위 39개 중 FC만의 변환상수 평균 (FC 기준체급)
 *   muAP: number,          // 상위 39개 중 AP만의 변환상수 평균 (AP 기준체급)
 *   top39Entries: Array,   // 상위 39개 엔트리
 *   allConverted: Array    // 전체 변환상수 목록 (FC+AP)
 * }}
 */
export function computeUserMu(songs, userScoresMap) {
    const allEntries = [];

    songs.forEach((song) => {
        const userPlay = userScoresMap.get(String(song.id));
        if (!userPlay) return;

        const diffs = ["easy", "normal", "hard", "expert", "master", "append"];
        diffs.forEach((diff) => {
            const status = userPlay[diff];
            if (!status || status === "none") return;
            const converted = getConvertedConstant(song, diff, status);
            if (converted > 0) {
                allEntries.push({ song, diff, status, converted });
            }
        });
    });

    // 내림차순 정렬
    allEntries.sort((a, b) => b.converted - a.converted);

    const top39 = allEntries.slice(0, 39);

    // 전체 평균
    const mu = top39.length > 0 ? top39.reduce((acc, e) => acc + e.converted, 0) / top39.length : 0;

    // 일반 상위 40개 곡 평균 계산 (패딩용 유저평균)
    const top40 = allEntries.slice(0, 40);
    const mu_top40 = top40.length > 0 ? top40.reduce((acc, e) => acc + e.converted, 0) / top40.length : mu;

    // FC인 곡 (FC + AP) 전체 추출 후, AP인 곡은 변환상수에서 2.0을 감산하여 순수 FC 수준으로 평가
    const fcAllEntries = allEntries
        .filter((e) => e.status === "full_combo" || e.status === "full_perfect")
        .map((e) => {
            const fcEvaluated = e.status === "full_perfect" ? e.converted - 2.0 : e.converted;
            return { ...e, fcEvaluated };
        });
    fcAllEntries.sort((a, b) => b.fcEvaluated - a.fcEvaluated);
    const fcCount = fcAllEntries.length;
    let muFC = mu_top40;
    if (fcCount > 0) {
        // 유저 최대 상수
        const maxFcConstant = Math.max(...fcAllEntries.map(e => e.fcEvaluated));
        // 가용 고레벨 Pool 크기 계산: (maxFcConstant - 1) <= 상수 <= maxFcConstant
        const fcPoolSize = fcAllEntries.filter(e => e.fcEvaluated >= (maxFcConstant - 1.0) && e.fcEvaluated <= maxFcConstant).length;
        const K_FC = Math.min(20, Math.max(1, fcPoolSize));

        const fcTopK = fcAllEntries.slice(0, K_FC);
        const fcSum = fcTopK.reduce((acc, e) => acc + e.fcEvaluated, 0);
        if (fcCount < K_FC) {
            muFC = (fcSum + (K_FC - fcCount) * mu_top40) / K_FC;
        } else {
            muFC = fcSum / K_FC;
        }
    }

    // AP인 곡 전체 추출 후 상위 K개 평균 (K 미만 시 유저평균 mu_top40 로 패딩)
    const apAllEntries = allEntries.filter((e) => e.status === "full_perfect");
    const apCount = apAllEntries.length;
    let muAP = mu_top40;
    if (apCount > 0) {
        // AP 순수 곡 상수의 최댓값
        const apConstants = apAllEntries.map(e => e.converted - 2.0);
        const maxApConstant = Math.max(...apConstants);
        // 가용 고레벨 Pool 크기 계산: (maxApConstant - 1) <= 상수 <= maxApConstant
        const apPoolSize = apAllEntries.filter(e => {
            const raw = e.converted - 2.0;
            return raw >= (maxApConstant - 1.0) && raw <= maxApConstant;
        }).length;
        const K_AP = Math.min(20, Math.max(1, apPoolSize));

        const apTopK = apAllEntries.slice(0, K_AP);
        const apSum = apTopK.reduce((acc, e) => acc + e.converted, 0);
        if (apCount < K_AP) {
            muAP = (apSum + (K_AP - apCount) * mu_top40) / K_AP;
        } else {
            muAP = apSum / K_AP;
        }
    }

    return { mu, muFC, muAP, top39Entries: top39, allConverted: allEntries };
}

// ─────────────────────────────────────────
// B. 달성 확률 함수 (Logistic Sigmoid)
// ─────────────────────────────────────────

/**
 * 로지스틱 시그모이드 달성 확률
 * P(x) = 1 / (1 + exp(K * (x - mu)))
 *
 * @param {number} x  - 목표 난이도 (FC면 상수, AP면 상수+2.0)
 * @param {number} mu - 유저 기준체급
 * @returns {number} 0~1 확률
 */
export function achieveProbability(x, mu) {
    return 1 / (1 + Math.exp(K * (x - mu)));
}

// ─────────────────────────────────────────
// C. 곡 태그 벡터 생성 (TF-IDF)
// ─────────────────────────────────────────

/**
 * 전체 태그 목록을 추출한다.
 * @param {Array} songs
 * @returns {string[]} 중복 없는 태그 목록
 */
export function extractAllTags(songs) {
    const tagSet = new Set();
    songs.forEach((song) => {
        if (!song.tags) return;
        Object.values(song.tags).forEach((tagList) => {
            if (Array.isArray(tagList)) {
                tagList.forEach((t) => tagSet.add(t));
            }
        });
    });
    return Array.from(tagSet).sort();
}

/**
 * 특정 채보(song+diff)의 태그 목록을 반환한다.
 * @param {object} song
 * @param {string} diff
 * @returns {string[]}
 */
export function getSongDiffTags(song, diff) {
    if (!song.tags || !song.tags[diff]) return [];
    return song.tags[diff];
}

/**
 * TF-IDF를 사용해 분석 대상 채보들에 대한 태그 IDF 맵을 계산한다.
 *
 * @param {Array}    candidateCharts - 분석 대상 채보 목록 [{song, diff}]
 * @param {string[]} allTags         - 전체 태그 목록
 * @returns {Map<string, number>}    태그 → IDF 값
 */
export function computeIDF(candidateCharts, allTags) {
    const N = candidateCharts.length;
    const dfMap = new Map();

    allTags.forEach((t) => dfMap.set(t, 0));

    candidateCharts.forEach(({ song, diff }) => {
        const tags = getSongDiffTags(song, diff);
        const seenInChart = new Set(tags);
        seenInChart.forEach((t) => {
            dfMap.set(t, (dfMap.get(t) || 0) + 1);
        });
    });

    const idfMap = new Map();
    allTags.forEach((t) => {
        const df = dfMap.get(t) || 0;
        // df가 0이면 IDF는 log(N/1)로 처리 (분모 0 방지)
        idfMap.set(t, Math.log10(N / Math.max(df, 1)));
    });

    return idfMap;
}

/**
 * 곡 채보의 TF-IDF 가중 태그 벡터를 계산한다.
 * Sw[t] = 1(태그 보유) × IDF(t)
 *
 * @param {object}           song
 * @param {string}           diff
 * @param {string[]}         allTags
 * @returns {number[]}
 */
export function computeSongVector(song, diff, allTags) {
    const tags = new Set(getSongDiffTags(song, diff));
    return allTags.map((t) => (tags.has(t) ? 1 : 0));
}

// ─────────────────────────────────────────
// D. 유저 성향 벡터 생성 (Bayesian Average)
// ─────────────────────────────────────────

/**
 * 베이지안 스무딩을 적용한 유저 성향 벡터를 계산한다.
 *
 * @param {Array}    top39Entries - 유저 상위 39 엔트리 [{song, diff, status, converted}]
 * @param {number}   mu           - 유저 전체 변환상수 평균
 * @param {string[]} allTags      - 전체 태그 목록
 * @returns {number[]}
 */
export function computeUserVector(top39Entries, mu, allTags) {
    // 태그별로 해당 태그를 포함하는 엔트리들의 변환상수를 모음
    const tagData = new Map();
    allTags.forEach((t) => tagData.set(t, { sum: 0, n: 0 }));

    top39Entries.forEach(({ song, diff, converted }) => {
        const tags = getSongDiffTags(song, diff);
        tags.forEach((t) => {
            if (tagData.has(t)) {
                const d = tagData.get(t);
                d.sum += converted;
                d.n += 1;
            }
        });
    });

    return allTags.map((t) => {
        const { sum, n } = tagData.get(t) || { sum: 0, n: 0 };
        if (n === 0) return 0;

        const rawAvg = sum / n;
        // 베이지안 평균: (n * rawAvg + c * mu) / (n + c)
        const smoothed = (n * rawAvg + BAYESIAN_C * mu) / (n + BAYESIAN_C);
        return smoothed - mu; // 편차
    });
}

// ─────────────────────────────────────────
// E. 코사인 유사도
// ─────────────────────────────────────────

/**
 * 벡터의 모든 원소가 0인지(영벡터) 확인한다.
 * @param {number[]} v
 * @returns {boolean}
 */
export function isZeroVector(v) {
    return v.every((x) => x === 0);
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} -1 ~ 1
 *
 * 유저 벡터 또는 곡 벡터의 크기가 0이면 0을 반환한다.
 */
export function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    // 어느 쪽이든 크기가 0이면 유사도를 정의할 수 없으므로 0으로 처리
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─────────────────────────────────────────
// 분석 대상 채보 필터링
// ─────────────────────────────────────────

/**
 * 유저 평균 ±2 범위 내 채보를 필터링한다.
 *
 * @param {Array}  songs
 * @param {number} mu         - 변환상수 상위 39개 평균
 * @param {string} targetDiff - 'normal' | 'append' (분리)
 * @returns {Array} [{song, diff}]
 */
export function filterCandidateCharts(songs, mu, targetDiff = "all") {
    const result = [];
    const diffs =
        targetDiff === "append"
            ? ["append"]
            : targetDiff === "normal"
              ? ["easy", "normal", "hard", "expert", "master"]
              : ["easy", "normal", "hard", "expert", "master", "append"];

    songs.forEach((song) => {
        diffs.forEach((diff) => {
            const levelConst = getConstant(song, diff, "full_combo");
            if (!levelConst || levelConst <= 0) return;
            if (levelConst >= mu - 2 && levelConst <= mu + 2) {
                result.push({ song, diff });
            }
        });
    });
    return result;
}

// ─────────────────────────────────────────
// F. B39 모드 추천
// ─────────────────────────────────────────

/**
 * B39 일반 모드 추천 점수 계산
 *
 * @param {object} params
 * @param {Array}  params.songs
 * @param {Map}    params.userScoresMap
 * @param {Array}  params.b39List       - 현재 일반 B39 목록
 * @param {string} params.goalStatus    - 'full_combo' | 'full_perfect'
 * @param {number} params.topN          - 상위 N개 반환
 * @returns {Array} 추천 목록
 */
export function recommendB39Normal({ songs, userScoresMap, b39List, goalStatus = "full_combo", topN = 30 }) {
    // 커트라인: 일반 상위 39번째 곡 레이팅 (없으면 0)
    const T_gen = b39List.length >= 39 ? b39List[38].rating : 0;
    const multiplier = B39_MULTIPLIERS[goalStatus] || 7.5;

    // 유저 체급 계산
    const { mu, muFC, muAP, top39Entries } = computeUserMu(songs, userScoresMap);
    const muTarget = goalStatus === "full_perfect" ? muAP : muFC;

    // 전체 태그
    const allTags = extractAllTags(songs);

    // 유저 성향 벡터
    const userVec = computeUserVector(top39Entries, mu, allTags);
    // 유저 벡터가 영벡터이면 취향 유사도 연산을 건너뜜
    const userVecIsZero = isZeroVector(userVec);

    const results = [];

    songs.forEach((song) => {
        const diffs = ["easy", "normal", "hard", "expert", "master"];
        diffs.forEach((diff) => {
            const raw = getConstant(song, diff, goalStatus === "full_perfect" ? "full_perfect" : "full_combo");
            if (!raw || raw <= 0) return;

            const userPlay = userScoresMap.get(String(song.id));
            const currentStatus = userPlay ? userPlay[diff] : null;

            // 이미 목표 이상 달성한 경우 제외
            if (goalStatus === "full_combo") {
                if (currentStatus === "full_combo" || currentStatus === "full_perfect") return;
            }
            if (goalStatus === "full_perfect") {
                if (currentStatus === "full_perfect") return;
            }

            // 목표 달성 시 새 레이팅
            const R_new = Math.round(multiplier * raw);

            // 현재 해당 곡의 기존 레이팅 (있으면)
            let R_exist = 0;
            if (currentStatus && currentStatus !== "none") {
                const existMult = B39_MULTIPLIERS[currentStatus] || 0;
                R_exist = Math.round(existMult * raw);
            }

            // Δ = max(0, R_new - max(T_gen, R_exist))
            const delta = Math.max(0, R_new - Math.max(T_gen, R_exist));
            if (delta <= 0) return;

            // 달성 확률 x
            const x = goalStatus === "full_perfect" ? raw + AP_BONUS : raw;
            const prob = achieveProbability(x, muTarget);

            // 곡 태그 벡터 (유저 벡터가 영벡터면 sim = 0 강제)
            const sim = userVecIsZero ? 0 : cosineSimilarity(userVec, computeSongVector(song, diff, allTags));

            const finalScore = delta * prob * (1 + ALPHA * sim);

            results.push({
                song,
                diff,
                goalStatus,
                constant: raw,
                delta,
                prob,
                sim,
                finalScore,
                currentStatus,
                R_new,
                R_exist,
                T_gen,
                isAppend: false,
                mode: "b39_normal",
            });
        });
    });

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.slice(0, topN);
}

/**
 * 어펜드 전용 유저 체급(μ)을 계산한다.
 *
 * 유저의 전체 어펜드 기록을 변환상수 기준 내림차순 정렬 후 상위 15개를 추려,
 *   - muFC_apd : 그 중 FC(full_combo) 곡들의 변환상수 평균
 *   - muAP_apd : 그 중 AP(full_perfect) 곡들의 변환상수 평균
 * 해당 상태의 기록이 없으면 fallbackMu 로 대체한다.
 *
 * @param {Array}  songs
 * @param {Map}    userScoresMap
 * @param {number} fallbackMu   - 전체 체급 (폴백용)
 * @returns {{ muFC_apd: number, muAP_apd: number, apdTop15Entries: Array }}
 */
export function computeApdMu(songs, userScoresMap, fallbackMu) {
    const apdEntries = [];

    songs.forEach((song) => {
        if (!song.levels?.append) return;
        const userPlay = userScoresMap.get(String(song.id));
        if (!userPlay) return;

        const status = userPlay.append;
        if (!status || status === "none") return;

        const converted = getConvertedConstant(song, "append", status);
        if (converted > 0) {
            apdEntries.push({ song, diff: "append", status, converted });
        }
    });

    // 변환상수 내림차순 정렬
    apdEntries.sort((a, b) => b.converted - a.converted);
    const apdTop15 = apdEntries.slice(0, 15);

    // 어펜드 상위 10개 곡 평균 계산 (패딩용 유저평균)
    const apdTop10 = apdEntries.slice(0, 10);
    const mu_apd_top10 = apdTop10.length > 0 ? apdTop10.reduce((acc, e) => acc + e.converted, 0) / apdTop10.length : fallbackMu;
    
    // 어펜드 FC인 곡 (FC + AP) 전체 추출 후, AP인 곡은 2.0을 감산하여 순수 FC 수준으로 평가
    const fcEntriesAll = apdEntries
        .filter((e) => e.status === "full_combo" || e.status === "full_perfect")
        .map((e) => {
            const fcEvaluated = e.status === "full_perfect" ? e.converted - 2.0 : e.converted;
            return { ...e, fcEvaluated };
        });
    fcEntriesAll.sort((a, b) => b.fcEvaluated - a.fcEvaluated);
    
    const apdFcCount = fcEntriesAll.length;
    let muFC_apd = mu_apd_top10;
    if (apdFcCount > 0) {
        const maxFcConstantApd = Math.max(...fcEntriesAll.map(e => e.fcEvaluated));
        const fcPoolSizeApd = fcEntriesAll.filter(e => e.fcEvaluated >= (maxFcConstantApd - 1.0) && e.fcEvaluated <= maxFcConstantApd).length;
        const K_FC_apd = Math.min(5, Math.max(1, fcPoolSizeApd));

        const fcEntriesTopK = fcEntriesAll.slice(0, K_FC_apd);
        const fcSum = fcEntriesTopK.reduce((acc, e) => acc + e.fcEvaluated, 0);
        if (apdFcCount < K_FC_apd) {
            muFC_apd = (fcSum + (K_FC_apd - apdFcCount) * mu_apd_top10) / K_FC_apd;
        } else {
            muFC_apd = fcSum / K_FC_apd;
        }
    }

    // 어펜드 AP인 곡 전체 추출 후 상위 K개 평균
    const apEntriesAll = apdEntries.filter((e) => e.status === "full_perfect");
    const apdApCount = apEntriesAll.length;
    let muAP_apd = mu_apd_top10;
    if (apdApCount > 0) {
        const apConstantsApd = apEntriesAll.map(e => e.converted - 2.0);
        const maxApConstantApd = Math.max(...apConstantsApd);
        const apPoolSizeApd = apEntriesAll.filter(e => {
            const raw = e.converted - 2.0;
            return raw >= (maxApConstantApd - 1.0) && raw <= maxApConstantApd;
        }).length;
        const K_AP_apd = Math.min(5, Math.max(1, apPoolSizeApd));

        const apEntriesTopK = apEntriesAll.slice(0, K_AP_apd);
        const apSum = apEntriesTopK.reduce((acc, e) => acc + e.converted, 0);
        if (apdApCount < K_AP_apd) {
            muAP_apd = (apSum + (K_AP_apd - apdApCount) * mu_apd_top10) / K_AP_apd;
        } else {
            muAP_apd = apSum / K_AP_apd;
        }
    }

    const mu_apd =
        apdTop15.length > 0 ? apdTop15.reduce((acc, e) => acc + e.converted, 0) / apdTop15.length : fallbackMu;

    return { mu_apd, muFC_apd, muAP_apd, apdTop15Entries: apdTop15 };
}

/**
 * APD B15 어펜드 모드 추천 점수 계산
 *
 * 체급(μ)은 어펜드 변환상수 상위 15개 중 FC/AP 각각의 평균으로 별도 산출한다.
 *
 * @param {object} params
 * @param {Array}  params.songs
 * @param {Map}    params.userScoresMap
 * @param {Array}  params.appendB15List  - 현재 어펜드 B15 목록
 * @param {string} params.goalStatus     - 'full_combo' | 'full_perfect'
 * @param {number} params.topN
 * @returns {Array}
 */
export function recommendB39Append({ songs, userScoresMap, appendB15List, goalStatus = "full_combo", topN = 20 }) {
    // 커트라인: 어펜드 상위 15번째 곡 레이팅 (없으면 0)
    const T_apd = appendB15List.length >= 15 ? appendB15List[14].rating : 0;
    const multiplier = B39_MULTIPLIERS[goalStatus] || 7.5;

    // 전체 체급 (태그 벡터 및 폴백용)
    const { mu, top39Entries } = computeUserMu(songs, userScoresMap);

    // ── 어펜드 전용 체급 ──────────────────────────────────────────────
    // 어펜드 변환상수 상위 15개 중 FC인 곡들의 평균 → FC 기준체급
    // 어펜드 변환상수 상위 15개 중 AP인 곡들의 평균 → AP 기준체급
    // (해당 상태 기록 없으면 전체 mu 폴백)
    const { muFC_apd, muAP_apd, apdTop15Entries } = computeApdMu(songs, userScoresMap, mu);
    const muTarget = goalStatus === "full_perfect" ? muAP_apd : muFC_apd;
    // ────────────────────────────────────────────────────────────────

    const allTags = extractAllTags(songs);
    // 성향 벡터: 어펜드 상위 15개 기준 (mu 대신 muFC_apd 기준으로 편차 계산)
    const userVec = computeUserVector(apdTop15Entries, muFC_apd, allTags);
    const userVecIsZero = isZeroVector(userVec);

    const results = [];

    songs.forEach((song) => {
        if (!song.levels?.append) return; // 어펜드 없는 곡
        const raw = getConstant(song, "append", goalStatus === "full_perfect" ? "full_perfect" : "full_combo");
        if (!raw || raw <= 0) return;

        const userPlay = userScoresMap.get(String(song.id));
        const currentStatus = userPlay ? userPlay.append : null;

        if (goalStatus === "full_combo") {
            if (currentStatus === "full_combo" || currentStatus === "full_perfect") return;
        }
        if (goalStatus === "full_perfect") {
            if (currentStatus === "full_perfect") return;
        }

        const R_new = Math.round(multiplier * raw);
        let R_exist = 0;
        if (currentStatus && currentStatus !== "none") {
            R_exist = Math.round((B39_MULTIPLIERS[currentStatus] || 0) * raw);
        }

        // Δ = max(0, R_new - max(T_apd, R_exist)) × 2.6
        const delta = Math.max(0, R_new - Math.max(T_apd, R_exist)) * 2.6;
        if (delta <= 0) return;

        const x = goalStatus === "full_perfect" ? raw + AP_BONUS : raw;
        const prob = achieveProbability(x, muTarget);

        // 유저 벡터가 영벡터면 sim = 0 강제
        const sim = userVecIsZero ? 0 : cosineSimilarity(userVec, computeSongVector(song, "append", allTags));

        const finalScore = delta * prob * (1 + ALPHA * sim);

        results.push({
            song,
            diff: "append",
            goalStatus,
            constant: raw,
            delta,
            prob,
            sim,
            finalScore,
            currentStatus,
            R_new,
            R_exist,
            T_apd,
            muFC_apd,
            muAP_apd,
            isAppend: true,
            mode: "b39_append",
        });
    });

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.slice(0, topN);
}

// ─────────────────────────────────────────
// G. 포텐셜 모드 추천
// ─────────────────────────────────────────

/**
 * 포텐셜 모드 추천 점수 계산
 *
 * @param {object} params
 * @param {Array}  params.songs
 * @param {Map}    params.userScoresMap
 * @param {Array}  params.potentialOldBest30 - 구곡 상위 30개
 * @param {Array}  params.potentialNewBest10 - 신곡 상위 10개
 * @param {string} params.goalStatus         - 'full_combo' | 'full_perfect'
 * @param {string} params.songCategory       - 'old' | 'new' | 'all'
 * @param {number} params.topN
 * @returns {Array}
 */
export function recommendPotential({
    songs,
    userScoresMap,
    potentialOldBest30,
    potentialNewBest10,
    goalStatus = "full_combo",
    songCategory = "all",
    topN = 30,
}) {
    // 커트라인
    const T_old = potentialOldBest30.length >= 30 ? potentialOldBest30[29].potential : 0;
    const T_new = potentialNewBest10.length >= 10 ? potentialNewBest10[9].potential : 0;

    // 일반 채보 체급 (전체 상위 39개 기반)
    const { mu, muFC, muAP, top39Entries } = computeUserMu(songs, userScoresMap);

    // ── 어펜드 전용 체급 ──────────────────────────────────────────────
    // 어펜드 변환상수 상위 15개 중 FC 평균 / AP 평균으로 별도 산출
    // (기록 없으면 전체 mu 폴백)
    const { muFC_apd, muAP_apd, apdTop15Entries } = computeApdMu(songs, userScoresMap, mu);
    // ────────────────────────────────────────────────────────────────

    const allTags = extractAllTags(songs);
    const userVec = computeUserVector(top39Entries, mu, allTags);
    const userVecIsZero = isZeroVector(userVec);

    // 어펜드 전용 성향 벡터 (apdTop15 기준)
    const apdUserVec = computeUserVector(apdTop15Entries, muFC_apd, allTags);
    const apdUserVecIsZero = isZeroVector(apdUserVec);

    const results = [];
    const diffs = ["easy", "normal", "hard", "expert", "master", "append"];

    songs.forEach((song) => {
        const songIsNew = isNewSong(song);

        // 카테고리 필터
        if (songCategory === "old" && songIsNew) return;
        if (songCategory === "new" && !songIsNew) return;

        diffs.forEach((diff) => {
            if (diff === "append" && !song.levels?.append) return;

            const raw = getConstant(song, diff, goalStatus === "full_perfect" ? "full_perfect" : "full_combo");
            if (!raw || raw <= 0) return;

            const userPlay = userScoresMap.get(String(song.id));
            const currentStatus = userPlay ? userPlay[diff] : null;

            if (goalStatus === "full_combo") {
                if (currentStatus === "full_combo" || currentStatus === "full_perfect") return;
            }
            if (goalStatus === "full_perfect") {
                if (currentStatus === "full_perfect") return;
            }

            // 포텐셜 target 값
            const target = goalStatus === "full_perfect" ? raw + AP_BONUS : raw;

            // 현재 해당 곡의 기존 포텐셜
            let R_exist = 0;
            if (currentStatus === "full_perfect") {
                R_exist = (getConstant(song, diff, "full_perfect") || 0) + AP_BONUS;
            } else if (currentStatus === "full_combo") {
                R_exist = getConstant(song, diff, "full_combo") || 0;
            }

            // 커트라인 선택
            const T = songIsNew ? T_new : T_old;
            const delta = Math.max(0, target - Math.max(T, R_exist)) / POTENTIAL_DIVISOR;
            if (delta <= 0) return;

            const isAppendChart = diff === "append";

            // ── 채보 종류별 체급 및 성향 벡터 선택 ──────────────────
            // 어펜드 채보 → 어펜드 전용 체급(muFC_apd / muAP_apd) 사용
            // 일반 채보  → 일반 체급(muFC / muAP) 사용
            const muTarget = isAppendChart
                ? goalStatus === "full_perfect"
                    ? muAP_apd
                    : muFC_apd
                : goalStatus === "full_perfect"
                  ? muAP
                  : muFC;

            const x = target;
            const prob = achieveProbability(x, muTarget);

            // 성향 벡터도 어펜드/일반 분리
            const vecIsZero = isAppendChart ? apdUserVecIsZero : userVecIsZero;
            const vec = isAppendChart ? apdUserVec : userVec;
            // ────────────────────────────────────────────────────────

            // 유저 벡터가 영벡터면 sim = 0 강제
            const sim = vecIsZero ? 0 : cosineSimilarity(vec, computeSongVector(song, diff, allTags));

            // 곱연산 가중치 결합 (sim만 반영)
            const combinedWeight = 1 + ALPHA * sim;

            // 포텐셜 최종 점수 스케일을 B39 수준으로 보정하기 위해 400배 곱해줍니다.
            const finalScore = delta * prob * combinedWeight * 400;

            results.push({
                song,
                diff,
                goalStatus,
                constant: raw,
                target,
                delta,
                prob,
                sim,
                finalScore,
                currentStatus,
                T,
                R_exist,
                isAppend: isAppendChart,
                isNew: songIsNew,
                W_apd: 1.0,
                muFC_apd: isAppendChart ? muFC_apd : undefined,
                muAP_apd: isAppendChart ? muAP_apd : undefined,
                mode: "potential",
            });
        });
    });

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.slice(0, topN);
}

// ─────────────────────────────────────────
// H. 통합 추천 함수
// ─────────────────────────────────────────

/**
 * FC/AP 두 목표로 계산된 결과를 병합한다.
 * 같은 (songId, diff) 조합은 finalScore가 높은 쪽 하나만 남긴다.
 *
 * @param {Array}  items - FC 결과 + AP 결과 합친 배열
 * @param {number} topN
 * @returns {Array}
 */
function mergeAndDedup(items, topN) {
    const map = new Map();
    items.forEach((item) => {
        const key = `${item.song.id}-${item.diff}`;
        const existing = map.get(key);
        if (!existing || item.finalScore > existing.finalScore) {
            map.set(key, item);
        }
    });
    const merged = Array.from(map.values());
    merged.sort((a, b) => b.finalScore - a.finalScore);
    return merged.slice(0, topN);
}

/**
 * FC/AP 목표를 통합하여 레이팅 상승 추천 결과를 반환한다.
 * 각 (곡, 난이도) 조합에서 FC/AP 중 효율이 높은 목표 하나만 남긴다.
 *
 * @param {object} params
 * @returns {{
 *   b39Normal: Array,
 *   b39Append: Array,
 *   potentialAll: Array,
 *   mu: number, muFC: number, muAP: number,
 *   top39Entries: Array,
 * }}
 */
export function computeRecommendations({
    songs,
    userScoresMap,
    b39List,
    appendB15List,
    potentialData,
    ratingMode,
    filterGoal = "all",
    topN = 30,
}) {
    const muResult = computeUserMu(songs, userScoresMap);
    const bigN = topN * 2; // 병합 전 여유 있게 뽑기
    const apdMuResult = computeApdMu(songs, userScoresMap, muResult.mu);

    if (ratingMode === "b39") {
        let rawNormal = [];
        let rawAppend = [];

        if (filterGoal === "all" || filterGoal === "fc") {
            const fcNormal = recommendB39Normal({
                songs,
                userScoresMap,
                b39List,
                goalStatus: "full_combo",
                topN: bigN,
            });
            rawNormal = rawNormal.concat(fcNormal);

            const fcAppend = recommendB39Append({
                songs,
                userScoresMap,
                appendB15List,
                goalStatus: "full_combo",
                topN: bigN,
            });
            rawAppend = rawAppend.concat(fcAppend);
        }

        if (filterGoal === "all" || filterGoal === "ap") {
            const apNormal = recommendB39Normal({
                songs,
                userScoresMap,
                b39List,
                goalStatus: "full_perfect",
                topN: bigN,
            });
            rawNormal = rawNormal.concat(apNormal);

            const apAppend = recommendB39Append({
                songs,
                userScoresMap,
                appendB15List,
                goalStatus: "full_perfect",
                topN: bigN,
            });
            rawAppend = rawAppend.concat(apAppend);
        }

        const b39Normal = mergeAndDedup(rawNormal, topN);
        const b39Append = mergeAndDedup(rawAppend, topN);

        return {
            b39Normal,
            b39Append,
            potentialAll: [],
            ...muResult,
            mu_apd: apdMuResult.mu_apd,
            muFC_apd: apdMuResult.muFC_apd,
            muAP_apd: apdMuResult.muAP_apd,
        };
    } else {
        const commonArgs = {
            songs,
            userScoresMap,
            potentialOldBest30: potentialData.oldBest30 || [],
            potentialNewBest10: potentialData.newBest10 || [],
            songCategory: "all",
            topN: bigN,
        };

        let rawPotential = [];

        if (filterGoal === "all" || filterGoal === "fc") {
            const fcPot = recommendPotential({ ...commonArgs, goalStatus: "full_combo" });
            rawPotential = rawPotential.concat(fcPot);
        }

        if (filterGoal === "all" || filterGoal === "ap") {
            const apPot = recommendPotential({ ...commonArgs, goalStatus: "full_perfect" });
            rawPotential = rawPotential.concat(apPot);
        }

        const potentialAll = mergeAndDedup(rawPotential, topN);

        return {
            b39Normal: [],
            b39Append: [],
            potentialAll,
            ...muResult,
            mu_apd: apdMuResult.mu_apd,
            muFC_apd: apdMuResult.muFC_apd,
            muAP_apd: apdMuResult.muAP_apd,
        };
    }
}
