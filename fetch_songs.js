import fs from "fs";
import https from "https";

const SONGS_API_URL = process.env.SONGS_API_URL || "https://api.rilaksekai.com/api/songs";

// Helper to fetch URL with proxy fallback to bypass Cloudflare TLS fingerprinting
async function fetchUrlWithFallback(targetUrl) {
    console.log(`[Fetch] Attempting to fetch from: ${targetUrl}`);
    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });
        if (response.ok) {
            return await response.json();
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    } catch (directError) {
        console.warn(`[Fetch] Direct fetch failed: ${directError.message}`);

        if (targetUrl.includes("rilaksekai.com")) {
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
            console.log(`[Fetch] Attempting fallback via proxy: ${proxyUrl}`);
            try {
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    return await response.json();
                }
                throw new Error(`Proxy HTTP error! status: ${response.status}`);
            } catch (proxyError) {
                console.error(`[Fetch] Proxy fetch failed: ${proxyError.message}`);
                throw new Error(
                    `Both direct fetch and proxy fallback failed. Direct: ${directError.message}, Proxy: ${proxyError.message}`,
                );
            }
        }
        throw directError;
    }
}

async function fetchSongs() {
    console.log("Fetching songs from API with fallbacks...");
    try {
        const data = await fetchUrlWithFallback(SONGS_API_URL);
        console.log(`Successfully fetched ${data.length} songs.`);

        let releaseDates = {};
        try {
            const datesData = await fetchUrlWithFallback(
                "https://sekai-world.github.io/sekai-master-db-diff/musics.json",
            );
            datesData.forEach((m) => {
                if (m.id && m.publishedAt) {
                    releaseDates[String(m.id)] = m.publishedAt;
                }
            });
            console.log(`Successfully fetched ${Object.keys(releaseDates).length} release dates.`);
        } catch (e) {
            console.error("Failed to fetch release dates, fallback to none:", e);
        }

        let songTypes = {};
        try {
            console.log("Fetching song classifications from pjsekai.com...");
            let wikiHtml;
            try {
                const res = await fetch("https://pjsekai.com/?aad6ee23b0", {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });
                if (res.ok) {
                    wikiHtml = await res.text();
                } else {
                    throw new Error(`Status ${res.status}`);
                }
            } catch (err) {
                console.warn("Direct wiki fetch failed, trying proxy fallback:", err.message);
                const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent("https://pjsekai.com/?aad6ee23b0")}`;
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    wikiHtml = await res.text();
                } else {
                    throw new Error(`Proxy fallback failed: ${res.status}`);
                }
            }

            if (wikiHtml) {
                const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
                let m;
                const cleanText = (text) => (text ? text.replace(/<[^>]*>/g, "").trim() : "");
                const normalizeNameForType = (name) =>
                    name
                        ? name
                              .toLowerCase()
                              .replace(/[\s\-\_\,\.\!\?\'\"\`\’\“\”\：\:\；\;\~\(\)\[\]\※]/g, "")
                              .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
                        : "";

                while ((m = trRegex.exec(wikiHtml)) !== null) {
                    const trContent = m[1];
                    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                    const tds = [];
                    let tdMatch;
                    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
                        tds.push(tdMatch[1]);
                    }
                    if (tds.length >= 4) {
                        const typeText = cleanText(tds[2]);
                        const titleTd = tds[3];
                        if (
                            (typeText === "既" || typeText === "公" || typeText === "書") &&
                            titleTd.includes("<a href=")
                        ) {
                            const titleText = cleanText(titleTd);
                            const normTitle = normalizeNameForType(titleText);
                            if (normTitle) {
                                songTypes[normTitle] = typeText;
                            }
                            songTypes[titleText] = typeText;
                        }
                    }
                }
                console.log(`Successfully fetched song types map of size ${Object.keys(songTypes).length}.`);
            }
        } catch (e) {
            console.error("Failed to fetch song classifications from pjsekai.com:", e);
        }

        let wikiDifficultyData = {
            hard: {},
            expert: {},
            master: {},
            append: {},
        };
        try {
            console.log("Fetching song evaluations and tags from pjsekai.com...");
            const wikiUrls = {
                hard: "https://pjsekai.com/?%E6%A5%BD%E6%9B%B2%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8HARD",
                expert: "https://pjsekai.com/?%E6%A5%BD%E6%9B%B2%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8EXPERT",
                master: "https://pjsekai.com/?%E6%A5%BD%E6%9B%B2%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8MASTER",
                append: "https://pjsekai.com/?%E6%A5%BD%E6%9B%B2%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8APPEND",
            };

            const EVAL_MAP = {
                "最下位－": "-3",
                最下位: "-2",
                下位: "-1",
                適正: "0",
                上位: "+1",
                最上位: "+2",
                "最上位＋": "+3",
                判定困難: "판정곤란",
            };

            const TAG_MAP = {
                物量: "물량",
                長時間: "장시간",
                乱打: "난타",
                トリル: "트릴",
                縦連: "종련",
                微縦連: "미세 종련",
                極小ノーツ: "극소 노트",
                トレース難: "트레이스 난",
                スライド難: "슬라이드 난",
                左右振り: "좌우 흔들기",
                移動2連打: "이동 2연타",
                フリック難: "플릭 난",
                "持ち替え・交差": "손 교체,교차",
                盆踊り: "본오도리",
                くの字: "く자 배치",
                階段: "계단",
                多点押し: "다점 누르기",
                終点判定: "종점 판정",
                "5k": "5k",
                "6k": "6k",
                ハネリズム: "하네리듬",
                リズム難: "리듬난",
                変拍子: "변박",
                ポリリズム: "폴리리듬",
                認識難: "인식난",
                視認難: "시인난",
                局所難: "국소난",
                速度変化: "속도변화",
                譜面停止: "보면정지",
            };

            const fetchWikiHtml = async (url) => {
                try {
                    const res = await fetch(url, {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        },
                    });
                    if (res.ok) return await res.text();
                    throw new Error(`Direct fetch status ${res.status}`);
                } catch (e) {
                    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
                    const res = await fetch(proxyUrl);
                    if (res.ok) return await res.text();
                    throw new Error(`Proxy fallback status ${res.status}`);
                }
            };

            for (const [diff, url] of Object.entries(wikiUrls)) {
                try {
                    const html = await fetchWikiHtml(url);
                    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
                    let m;
                    while ((m = trRegex.exec(html)) !== null) {
                        const trContent = m[1];
                        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                        const tds = [];
                        let tdMatch;
                        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
                            tds.push(tdMatch[1]);
                        }

                        if (tds.length >= 3 && !tds[0].includes("曲名")) {
                            const titleLinkMatch = tds[0].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
                            let rawTitle = titleLinkMatch ? titleLinkMatch[1] : tds[0];
                            rawTitle = rawTitle.replace(/<[^>]*>/g, "").trim();

                            if (!rawTitle) continue;

                            let rawEval = tds[1]
                                .replace(/<span[^>]*>[\s\S]*?<\/span>/gi, "")
                                .replace(/<[^>]*>/g, "")
                                .trim();
                            let mappedEval = EVAL_MAP[rawEval] || null;

                            const mappedTags = [];
                            const liRegex = /<li>([\s\S]*?)<\/li>/gi;
                            let liMatch;
                            while ((liMatch = liRegex.exec(tds[2])) !== null) {
                                let tagText = liMatch[1].replace(/<[^>]*>/g, "").trim();
                                let mappedTag = TAG_MAP[tagText];
                                if (!mappedTag) {
                                    const lowerTagText = tagText.toLowerCase();
                                    const foundKey = Object.keys(TAG_MAP).find((k) => k.toLowerCase() === lowerTagText);
                                    if (foundKey) {
                                        mappedTag = TAG_MAP[foundKey];
                                    }
                                }
                                if (mappedTag) {
                                    mappedTags.push(mappedTag);
                                }
                            }

                            if (mappedEval || mappedTags.length > 0) {
                                const normTitle = normalizeNameForType(rawTitle);
                                const songInfo = {
                                    evaluation: mappedEval,
                                    tags: mappedTags,
                                };
                                wikiDifficultyData[diff][normTitle] = songInfo;
                                wikiDifficultyData[diff][rawTitle] = songInfo;
                            }
                        }
                    }
                    console.log(
                        `Successfully fetched and parsed ${Object.keys(wikiDifficultyData[diff]).length} songs for ${diff}.`,
                    );
                } catch (err) {
                    console.error(`Failed to fetch/parse ${diff} from pjsekai.com:`, err);
                }
            }
        } catch (e) {
            console.error("Failed to fetch evaluations and tags from pjsekai.com:", e);
        }

        const isAfterRemoveDate = new Date() >= new Date("2026-04-22");
        const processedSongs = data
            .filter((song) => {
                if (isAfterRemoveDate) {
                    const idStr = String(Number(song.id));
                    if (["707", "708", "709"].includes(idStr)) {
                        return false;
                    }
                }
                return true;
            })
            .map((song) => {
                const levels = {
                    easy: song.levels?.easy ? Number(song.levels.easy) : null,
                    normal: song.levels?.normal ? Number(song.levels.normal) : null,
                    hard: song.levels?.hard ? Number(song.levels.hard) : null,
                    expert: song.levels?.expert ? Number(song.levels.expert) : null,
                    master: song.levels?.master ? Number(song.levels.master) : null,
                    append: song.levels?.append ? Number(song.levels.append) : null,
                };

                const parseConstant = (val) => {
                    if (!val) return null;
                    const valStr = String(val).trim();
                    if (valStr === "" || valStr === "-") return null;
                    const parsed = parseFloat(valStr);
                    return isNaN(parsed) ? null : parsed;
                };

                const constants = {
                    easy: null,
                    normal: null,
                    hard: null,
                    expert_fc: parseConstant(song.ex_fc),
                    expert_ap: parseConstant(song.ex_ap),
                    master_fc: parseConstant(song.mas_fc),
                    master_ap: parseConstant(song.mas_ap),
                    append_fc: parseConstant(song.apd_fc),
                    append_ap: parseConstant(song.apd_ap),
                };

                const normalizeNameForType = (name) =>
                    name
                        ? name
                              .toLowerCase()
                              .replace(/[\s\-\_\,\.\!\?\'\"\`\’\“\”\：\:\；\;\~\(\)\[\]\※]/g, "")
                              .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
                        : "";

                let songType = "既"; // default is existing
                if (song.title_jp && songTypes[song.title_jp]) {
                    songType = songTypes[song.title_jp];
                } else {
                    const normJp = normalizeNameForType(song.title_jp);
                    const normKo = normalizeNameForType(song.title_ko);
                    const normHangul = normalizeNameForType(song.title_hangul);
                    if (normJp && songTypes[normJp]) {
                        songType = songTypes[normJp];
                    } else if (normKo && songTypes[normKo]) {
                        songType = songTypes[normKo];
                    } else if (normHangul && songTypes[normHangul]) {
                        songType = songTypes[normHangul];
                    }
                }

                const songIdStr = String(Number(song.id));
                const forceFalseIds = ["230", "231", "232", "233", "234"]; // 하코곡 제외 예외
                const forceTrueIds = ["162", "163", "164", "447", "448", "449", "503", "536", "622"]; // 하코곡 포함 예외
                let isOriginal = songType === "書";
                if (forceFalseIds.includes(songIdStr)) {
                    isOriginal = false;
                } else if (forceTrueIds.includes(songIdStr)) {
                    isOriginal = true;
                }

                const evaluations = {};
                const tags = {};
                const difficulties = ["hard", "expert", "master", "append"];
                for (const d of difficulties) {
                    let matchData = null;
                    const normJp = normalizeNameForType(song.title_jp);
                    const normKo = normalizeNameForType(song.title_ko);
                    const normHangul = normalizeNameForType(song.title_hangul);

                    if (normJp && wikiDifficultyData[d][normJp]) {
                        matchData = wikiDifficultyData[d][normJp];
                    } else if (song.title_jp && wikiDifficultyData[d][song.title_jp]) {
                        matchData = wikiDifficultyData[d][song.title_jp];
                    } else if (normKo && wikiDifficultyData[d][normKo]) {
                        matchData = wikiDifficultyData[d][normKo];
                    } else if (normHangul && wikiDifficultyData[d][normHangul]) {
                        matchData = wikiDifficultyData[d][normHangul];
                    }

                    if (matchData) {
                        if (matchData.evaluation !== null) {
                            evaluations[d] = matchData.evaluation;
                        }
                        if (matchData.tags && matchData.tags.length > 0) {
                            tags[d] = matchData.tags;
                        }
                    }
                }

                return {
                    id: song.id,
                    title_ko: song.title_ko || "",
                    title_jp: song.title_jp || "",
                    title_hi: song.title_hi || "",
                    title_hangul: song.title_hangul || "",
                    unit_code: song.unit_code || "",
                    bpm: song.bpm || null,
                    levels: levels,
                    constants: constants,
                    composer: song.composer || song.composer_jp || "",
                    publishedAt: releaseDates[String(Number(song.id))] || song.publishedAt || null,
                    original: isOriginal,
                    evaluations: evaluations,
                    tags: tags,
                };
            });

        fs.writeFileSync("songs_data.json", JSON.stringify(processedSongs, null, 2), "utf-8");
        console.log("Processed songs saved to songs_data.json");
    } catch (error) {
        console.error("Error fetching songs:", error);
    }
}

fetchSongs();
