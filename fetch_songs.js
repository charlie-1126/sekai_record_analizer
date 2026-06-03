import fs from 'fs';
import https from 'https';

const SONGS_API_URL = process.env.SONGS_API_URL || 'https://api.rilaksekai.com/api/songs';

// Helper to fetch URL with proxy fallback to bypass Cloudflare TLS fingerprinting
async function fetchUrlWithFallback(targetUrl) {
  console.log(`[Fetch] Attempting to fetch from: ${targetUrl}`);
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (directError) {
    console.warn(`[Fetch] Direct fetch failed: ${directError.message}`);
    
    if (targetUrl.includes('rilaksekai.com')) {
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
        throw new Error(`Both direct fetch and proxy fallback failed. Direct: ${directError.message}, Proxy: ${proxyError.message}`);
      }
    }
    throw directError;
  }
}

async function fetchSongs() {
  console.log('Fetching songs from API with fallbacks...');
  try {
    const data = await fetchUrlWithFallback(SONGS_API_URL);

    console.log(`Successfully fetched ${data.length} songs.`);

    const processedSongs = data.map(song => {
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
        if (valStr === '' || valStr === '-') return null;
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

      return {
        id: song.id,
        title_ko: song.title_ko || '',
        title_jp: song.title_jp || '',
        title_hi: song.title_hi || '',
        title_hangul: song.title_hangul || '',
        unit_code: song.unit_code || '',
        bpm: song.bpm || null,
        levels: levels,
        constants: constants,
        composer: song.composer || song.composer_jp || '',
      };
    });

    fs.writeFileSync(
      'songs_data.json',
      JSON.stringify(processedSongs, null, 2),
      'utf-8'
    );
    console.log('Processed songs saved to songs_data.json');
  } catch (error) {
    console.error('Error fetching songs:', error);
  }
}

fetchSongs();
