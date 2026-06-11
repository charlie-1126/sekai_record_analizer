const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Folders Initialization ---
const DB_DIR = path.join(__dirname, 'db');
const JACKET_DIR = path.join(__dirname, 'public', 'jackets');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(JACKET_DIR)) fs.mkdirSync(JACKET_DIR, { recursive: true });

// --- SQLite Database Setup ---
const dbPath = path.join(DB_DIR, 'pjsk.db');
const db = new sqlite3.Database(dbPath);

const dbQuery = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Initialize tables
async function initDatabase() {
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      token TEXT DEFAULT NULL,
      scores TEXT DEFAULT '[]',
      friends TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{"songTitleLang": "jp"}',
      rating_history TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    )
  `);

  // Migrate JSON data to SQLite if DB is empty
  const usersJsonPath = path.join(DB_DIR, 'users.json');
  const scoresJsonPath = path.join(DB_DIR, 'scores.json');
  if (fs.existsSync(usersJsonPath) && fs.existsSync(scoresJsonPath)) {
    try {
      const dbUsersCount = await dbQuery.get('SELECT COUNT(*) as count FROM users');
      if (dbUsersCount.count === 0) {
        const jsonUsers = JSON.parse(fs.readFileSync(usersJsonPath, 'utf-8'));
        const jsonScores = JSON.parse(fs.readFileSync(scoresJsonPath, 'utf-8'));
        for (const u of jsonUsers) {
          const userScores = jsonScores.find(s => s.username.toLowerCase() === u.username.toLowerCase())?.scores || [];
          await dbQuery.run(
            `INSERT INTO users (username, nickname, password_salt, password_hash, scores, friends, settings, rating_history, created_at)
             VALUES (?, ?, ?, ?, ?, '[]', '{"songTitleLang":"jp"}', '{}', ?)`,
            [u.username, u.nickname, u.salt, u.hash, JSON.stringify(userScores), u.createdAt || new Date().toISOString()]
          );
        }
        console.log(`Successfully migrated ${jsonUsers.length} users from JSON to SQLite.`);
      }
    } catch (e) {
      console.error('Error during migration:', e);
    }
  }
}

initDatabase().catch(err => {
  console.error("Database initialization failed:", err);
});

// --- Simple JSON Database Engine (Still used for songs) ---
class JSONDatabase {
  constructor(filename, defaultData = []) {
    this.filepath = path.join(DB_DIR, filename);
    if (!fs.existsSync(this.filepath)) {
      fs.writeFileSync(this.filepath, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  }

  read() {
    try {
      const content = fs.readFileSync(this.filepath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Error reading database ${this.filepath}:`, e);
      return [];
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Error writing database ${this.filepath}:`, e);
    }
  }
}

const dbSongs = new JSONDatabase('songs.json', []);

// Copy initial songs data if exists
const initialSongsPath = path.join(__dirname, 'songs_data.json');
if (fs.existsSync(initialSongsPath) && dbSongs.read().length === 0) {
  const songs = JSON.parse(fs.readFileSync(initialSongsPath, 'utf-8'));
  dbSongs.write(songs);
  console.log(`Initialized database with ${songs.length} songs.`);
}

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/jackets', express.static(JACKET_DIR));

// --- Password Utility using Crypto ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

// --- Dynamic Jacket Downloader Engine ---
async function downloadJacket(songId) {
  const paddedId = String(songId).padStart(3, '0');
  const jacketPath = path.join(JACKET_DIR, `jacket_s_${paddedId}.webp`);

  if (fs.existsSync(jacketPath)) {
    return `/jackets/jacket_s_${paddedId}.webp`;
  }

  const url = `https://storage.sekai.best/sekai-jp-assets/music/jacket/jacket_s_${paddedId}/jacket_s_${paddedId}.webp`;
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(jacketPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Successfully downloaded jacket for song ${songId}`);
          resolve(`/jackets/jacket_s_${paddedId}.webp`);
        });
      } else {
        resolve(null);
      }
    }).on('error', (err) => {
      console.error(`Error downloading jacket for song ${songId}:`, err.message);
      resolve(null);
    });
  });
}

// Helper to get KST date string offset by a number of days
function getKstDateStrOffset(offsetDays) {
  const targetDate = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(targetDate);
}

// --- API Router ---

// 1. Auth APIs
app.post('/api/auth/register', async (req, res) => {
  const { username, nickname, password } = req.body;
  if (!username || !nickname || !password) {
    return res.status(400).json({ error: '모든 필드를 입력해 주세요.' });
  }

  try {
    const exists = await dbQuery.get('SELECT username FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (exists) {
      return res.status(400).json({ error: '이미 존재하는 유저 ID입니다.' });
    }

    const { salt, hash } = hashPassword(password);
    const createdAt = new Date().toISOString();

    let ratingHistory = '{}';
    if (username.toLowerCase().includes('test')) {
      ratingHistory = JSON.stringify({
        [getKstDateStrOffset(153)]: { normal: 8000, append: 1500 },
        [getKstDateStrOffset(149)]: { normal: 8200, append: 1600 },
        [getKstDateStrOffset(144)]: { normal: 8300, append: 1650 },
        [getKstDateStrOffset(49)]: { normal: 8800, append: 2000 },
        [getKstDateStrOffset(44)]: { normal: 9000, append: 2200 },
        [getKstDateStrOffset(33)]: { normal: 9200, append: 2350 },
        [getKstDateStrOffset(0)]: { normal: 9500, append: 2500 }
      });
    }

    await dbQuery.run(
      `INSERT INTO users (username, nickname, password_salt, password_hash, rating_history, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, nickname, salt, hash, ratingHistory, createdAt]
    );

    res.json({ message: '회원가입이 완료되었습니다!', username, nickname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ID와 비밀번호를 입력해 주세요.' });
  }

  try {
    const user = await dbQuery.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(400).json({ error: 'ID 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await dbQuery.run('UPDATE users SET token = ? WHERE LOWER(username) = LOWER(?)', [token, username]);

    res.json({
      message: '로그인 성공!',
      token,
      user: {
        username: user.username,
        nickname: user.nickname,
        friends: JSON.parse(user.friends || '[]'),
        settings: JSON.parse(user.settings || '{"songTitleLang": "jp"}'),
        rating_history: JSON.parse(user.rating_history || '{}'),
        scores: JSON.parse(user.scores || '[]')
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// Automatic Login (Token verification) API
app.get('/api/auth/me', async (req, res) => {
  let token = req.headers.authorization;
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) {
      return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }

    res.json({
      user: {
        username: user.username,
        nickname: user.nickname,
        friends: JSON.parse(user.friends || '[]'),
        settings: JSON.parse(user.settings || '{"songTitleLang": "jp"}'),
        rating_history: JSON.parse(user.rating_history || '{}'),
        scores: JSON.parse(user.scores || '[]')
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// --- Admin APIs ---
const adminAuth = async (req, res, next) => {
  let token = req.headers.authorization;
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    if (user.username.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 없습니다.' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
};

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await dbQuery.all('SELECT username, nickname, created_at FROM users');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 목록을 가져오지 못했습니다.' });
  }
});

app.delete('/api/admin/users/:username', adminAuth, async (req, res) => {
  const targetUsername = req.params.username;

  if (targetUsername.toLowerCase() === 'admin') {
    return res.status(400).json({ error: '관리자 자신은 삭제할 수 없습니다.' });
  }

  try {
    const result = await dbQuery.run('DELETE FROM users WHERE LOWER(username) = LOWER(?)', [targetUsername]);
    if (result.changes === 0) {
      return res.status(404).json({ error: '존재하지 않는 회원입니다.' });
    }
    res.json({ success: true, message: '회원이 정상적으로 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 삭제 중 에러가 발생했습니다.' });
  }
});

// Admin reset password API
app.post('/api/admin/users/:username/reset-password', adminAuth, async (req, res) => {
  const targetUsername = req.params.username;

  if (targetUsername.toLowerCase() === 'admin') {
    return res.status(400).json({ error: '최고 관리자의 비밀번호는 초기화할 수 없습니다.' });
  }

  try {
    const { salt, hash } = hashPassword('password');
    const result = await dbQuery.run(
      'UPDATE users SET password_salt = ?, password_hash = ? WHERE LOWER(username) = LOWER(?)',
      [salt, hash, targetUsername]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '존재하지 않는 회원입니다.' });
    }

    res.json({ success: true, message: '비밀번호가 "password"로 초기화되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '비밀번호 초기화 중 에러가 발생했습니다.' });
  }
});

// User change password API
app.post('/api/auth/change-password', async (req, res) => {
  let token = req.headers.authorization;
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
  }

  try {
    const user = await dbQuery.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
      return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    await dbQuery.run('UPDATE users SET password_salt = ?, password_hash = ? WHERE token = ?', [salt, hash, token]);

    res.json({ success: true, message: '비밀번호가 정상적으로 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '비밀번호 변경 중 에러가 발생했습니다.' });
  }
});

// --- Dynamic Config Parsing ---
let CONFIG = {
  songsApiUrl: 'https://api.rilaksekai.com/api/songs',
  syncIntervalMs: 3 * 60 * 60 * 1000
};

const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    CONFIG = { ...CONFIG, ...fileConfig };
    console.log('[Config] Loaded local config.json');
  } catch (e) {
    console.error('[Config] Error reading config.json:', e);
  }
}

const SONGS_API_URL = process.env.SONGS_API_URL || CONFIG.songsApiUrl;
const SYNC_INTERVAL = process.env.SYNC_INTERVAL ? Number(process.env.SYNC_INTERVAL) : CONFIG.syncIntervalMs;

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
    
    // If it is the default rilaksekai.com API, try a CORS/HTTP proxy fallback
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

// 2. Song & Jacket APIs
let isSyncing = false;
let isPrefetching = false;
let lastSyncTime = 0;

async function prefetchJacketsBackground(songs) {
  if (isPrefetching) return;
  isPrefetching = true;
  try {
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const paddedId = String(song.id).padStart(3, '0');
      const jacketPath = path.join(JACKET_DIR, `jacket_s_${paddedId}.webp`);
      if (fs.existsSync(jacketPath)) continue;
      await downloadJacket(song.id);
    }
  } catch (err) {
    console.error('[Jacket Prefetch] Error:', err);
  } finally {
    isPrefetching = false;
  }
}

function processAndSaveSongs(songsArray) {
  const currentSongs = dbSongs.read();
  const currentMap = new Map(currentSongs.map(s => [s.id, s]));
  let updatedCount = 0;
  let addedCount = 0;

  const parseConstant = (val) => {
    if (val === undefined || val === null) return null;
    const valStr = String(val).trim();
    if (valStr === '' || valStr === '-') return null;
    const parsed = parseFloat(valStr);
    return isNaN(parsed) ? null : parsed;
  };

  for (const song of songsArray) {
    const levels = {
      easy: song.levels?.easy ? Number(song.levels.easy) : null,
      normal: song.levels?.normal ? Number(song.levels.normal) : null,
      hard: song.levels?.hard ? Number(song.levels.hard) : null,
      expert: song.levels?.expert ? Number(song.levels.expert) : null,
      master: song.levels?.master ? Number(song.levels.master) : null,
      append: song.levels?.append ? Number(song.levels.append) : null,
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

    const refinedSong = {
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
      jacketUrl: `/jackets/jacket_s_${String(song.id).padStart(3, '0')}.webp`,
      publishedAt: song.publishedAt || null
    };

    if (currentMap.has(song.id)) {
      currentMap.set(song.id, refinedSong);
      updatedCount++;
    } else {
      currentMap.set(song.id, refinedSong);
      addedCount++;
    }
  }

  const updatedList = Array.from(currentMap.values());
  dbSongs.write(updatedList);
  lastSyncTime = Date.now();
  prefetchJacketsBackground(updatedList);

  return { success: true, addedCount, updatedCount, totalCount: updatedList.length };
}

async function syncSongsInternal(targetUrl = SONGS_API_URL) {
  if (isSyncing) return null;
  isSyncing = true;
  try {
    const apiResponse = await fetchUrlWithFallback(targetUrl);
    return processAndSaveSongs(apiResponse);
  } catch (error) {
    console.error('[Auto Sync] Error syncing songs:', error);
    throw error;
  } finally {
    isSyncing = false;
  }
}

app.get('/api/songs', (req, res) => {
  const songs = dbSongs.read();
  res.json(songs);
  if (Date.now() - lastSyncTime > SYNC_INTERVAL) {
    syncSongsInternal(SONGS_API_URL).catch(err => {
      console.error('[Auto Sync] Background auto-sync failed:', err);
    });
  }
});

app.post('/api/songs/sync', (req, res) => {
  try {
    const songsArray = req.body;
    if (!songsArray || !Array.isArray(songsArray)) {
      return res.status(400).json({ error: 'Body must be an array of songs.' });
    }
    const result = processAndSaveSongs(songsArray);
    res.json({
      success: true,
      message: `곡 정보 직접 동기화 완료! 신규 곡: ${result.addedCount}개, 갱신된 곡: ${result.updatedCount}개. 전체 곡 수: ${result.totalCount}개`,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      totalCount: result.totalCount
    });
  } catch (error) {
    res.status(500).json({ error: '곡 동기화 중 오류가 발생했습니다: ' + error.message });
  }
});

app.get('/api/songs/sync', async (req, res) => {
  try {
    const targetUrl = req.query.url || SONGS_API_URL;
    const result = await syncSongsInternal(targetUrl);
    if (result) {
      res.json({
        success: true,
        message: `곡 정보 동기화 완료! 신규 곡: ${result.addedCount}개, 갱신된 곡: ${result.updatedCount}개. 전체 곡 수: ${result.totalCount}개`,
        addedCount: result.addedCount,
        updatedCount: result.updatedCount,
        totalCount: result.totalCount
      });
    } else {
      res.json({ success: false, message: '곡 동기화가 이미 진행 중입니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '곡 동기화 중 오류가 발생했습니다: ' + error.message });
  }
});

app.get('/api/jackets/:songId', async (req, res) => {
  const songId = req.params.songId;
  const paddedId = String(songId).padStart(3, '0');
  const jacketPath = path.join(JACKET_DIR, `jacket_s_${paddedId}.webp`);

  if (fs.existsSync(jacketPath)) {
    return res.sendFile(jacketPath);
  }

  const jacketUrl = await downloadJacket(songId);
  if (jacketUrl) {
    res.sendFile(jacketPath);
  } else {
    res.status(404).send('Jacket not found');
  }
});

// 3. User Scores APIs
app.get('/api/scores/user/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await dbQuery.get('SELECT username, nickname, scores, rating_history FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '해당 유저를 찾을 수 없습니다.' });
    }
    res.json({
      username: user.username,
      nickname: user.nickname,
      scores: JSON.parse(user.scores || '[]'),
      rating_history: JSON.parse(user.rating_history || '{}')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

app.post('/api/scores', async (req, res) => {
  const { username, scores, rating: ratingDestructured, ratings } = req.body;
  const rating = ratingDestructured || ratings;
  if (!username) {
    return res.status(400).json({ error: '유저 계정명이 누락되었습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT rating_history, nickname FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '해당 유저를 찾을 수 없습니다.' });
    }

    const ratingHistory = JSON.parse(user.rating_history || '{}');
    const sortedDates = Object.keys(ratingHistory).sort();
    
    let lastNormal = 0;
    let lastAppend = 0;
    let lastPotential = 0;
    if (sortedDates.length > 0) {
      const lastEntry = ratingHistory[sortedDates[sortedDates.length - 1]];
      if (typeof lastEntry === 'object' && lastEntry !== null) {
        lastNormal = lastEntry.normal || 0;
        lastAppend = lastEntry.append || 0;
        lastPotential = lastEntry.potential || 0;
      } else if (typeof lastEntry === 'number') {
        lastNormal = lastEntry;
      }
    }

    let newNormal = 0;
    let newAppend = 0;
    let newPotential = 0;
    if (typeof rating === 'object' && rating !== null) {
      newNormal = Number(rating.normal) || 0;
      newAppend = Number(rating.append) || 0;
      newPotential = Number(rating.potential) || 0;
    } else if (typeof rating === 'number') {
      newNormal = rating;
    }

    // Only update history if there's no history yet OR the new normal/append/potential has changed from the last recorded value
    if (newNormal > 0 || newAppend > 0 || newPotential > 0) {
      if (sortedDates.length === 0 || newNormal !== lastNormal || newAppend !== lastAppend || newPotential !== lastPotential) {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayStr = formatter.format(today); // Returns YYYY-MM-DD
        
        ratingHistory[todayStr] = {
          normal: newNormal,
          append: newAppend,
          potential: newPotential
        };
      }
    }

    await dbQuery.run(
      'UPDATE users SET scores = ?, rating_history = ? WHERE LOWER(username) = LOWER(?)',
      [JSON.stringify(scores || []), JSON.stringify(ratingHistory), username]
    );

    res.json({
      success: true,
      message: '플레이 기록과 레이팅이 성공적으로 저장되었습니다!',
      rating_history: ratingHistory
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// 4. Comparison API
app.get('/api/scores/compare', async (req, res) => {
  const { userA, userB } = req.query;
  if (!userA || !userB) {
    return res.status(400).json({ error: '비교할 두 유저명을 입력해 주세요 (userA, userB).' });
  }

  try {
    const recordA = await dbQuery.get('SELECT username, nickname, scores FROM users WHERE LOWER(username) = LOWER(?)', [userA]);
    const recordB = await dbQuery.get('SELECT username, nickname, scores FROM users WHERE LOWER(username) = LOWER(?)', [userB]);

    if (!recordA) return res.status(404).json({ error: `${userA} 유저를 찾을 수 없습니다.` });
    if (!recordB) return res.status(404).json({ error: `${userB} 유저를 찾을 수 없습니다.` });

    res.json({
      userA: {
        username: recordA.username,
        nickname: recordA.nickname,
        scores: JSON.parse(recordA.scores || '[]')
      },
      userB: {
        username: recordB.username,
        nickname: recordB.nickname,
        scores: JSON.parse(recordB.scores || '[]')
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// 5. Friends APIs
app.post('/api/friends/add', async (req, res) => {
  const { username, friendUsername } = req.body;
  if (!username || !friendUsername) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
  }

  if (username.toLowerCase() === friendUsername.toLowerCase()) {
    return res.status(400).json({ error: '본인은 친구로 추가할 수 없습니다.' });
  }

  try {
    const friend = await dbQuery.get('SELECT username, nickname FROM users WHERE LOWER(username) = LOWER(?)', [friendUsername]);
    if (!friend) {
      return res.status(404).json({ error: '존재하지 않는 유저 ID입니다.' });
    }

    const user = await dbQuery.get('SELECT friends FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });
    }

    let friendsList = JSON.parse(user.friends || '[]');
    if (friendsList.includes(friend.username)) {
      return res.status(400).json({ error: '이미 추가된 친구입니다.' });
    }

    friendsList.push(friend.username);
    await dbQuery.run('UPDATE users SET friends = ? WHERE LOWER(username) = LOWER(?)', [JSON.stringify(friendsList), username]);

    res.json({
      success: true,
      message: `${friend.nickname}님이 친구 목록에 추가되었습니다!`,
      friends: friendsList
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

app.post('/api/friends/remove', async (req, res) => {
  const { username, friendUsername } = req.body;
  if (!username || !friendUsername) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT friends FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });
    }

    let friendsList = JSON.parse(user.friends || '[]');
    friendsList = friendsList.filter(f => f.toLowerCase() !== friendUsername.toLowerCase());
    
    await dbQuery.run('UPDATE users SET friends = ? WHERE LOWER(username) = LOWER(?)', [JSON.stringify(friendsList), username]);

    res.json({
      success: true,
      message: '친구 삭제 완료',
      friends: friendsList
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

app.get('/api/friends/list/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await dbQuery.get('SELECT friends FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });
    }

    const friendsList = JSON.parse(user.friends || '[]');
    if (friendsList.length === 0) {
      return res.json([]);
    }

    const songsList = dbSongs.read();
    const songsMap = new Map(songsList.map(s => [String(s.id), s]));

    const placeholders = friendsList.map(() => '?').join(',');
    const friendsInfo = await dbQuery.all(
      `SELECT username, nickname, rating_history, scores FROM users WHERE username IN (${placeholders})`,
      friendsList
    );

    const list = friendsInfo.map(f => {
      const history = JSON.parse(f.rating_history || '{}');
      const dates = Object.keys(history).sort();
      let normalRating = 0;
      let appendRating = 0;
      let totalRating = 0;
      let potentialRating = 0;
      if (dates.length > 0) {
        const lastEntry = history[dates[dates.length - 1]];
        if (typeof lastEntry === 'object' && lastEntry !== null) {
          normalRating = lastEntry.normal || 0;
          appendRating = lastEntry.append || 0;
          totalRating = normalRating + appendRating;
          potentialRating = lastEntry.potential || 0;
        } else if (typeof lastEntry === 'number') {
          normalRating = lastEntry;
          appendRating = 0;
          totalRating = lastEntry;
          potentialRating = 0;
        }
      }

      let scoresArray = [];
      try {
        scoresArray = JSON.parse(f.scores || '[]');
      } catch (e) {
        console.error('Error parsing scores for friend', f.username, e);
      }

      if ((normalRating === 0 || potentialRating === 0) && scoresArray.length > 0) {
        const computed = calculateRatingsOnServer(scoresArray, songsMap);
        if (normalRating === 0) normalRating = computed.normal;
        if (appendRating === 0) appendRating = computed.append;
        if (potentialRating === 0) potentialRating = computed.potential;
        totalRating = normalRating + appendRating;
      }

      if (potentialRating === 0 && normalRating > 0) {
        potentialRating = normalRating / 292.5;
      }

      return {
        username: f.username,
        nickname: f.nickname,
        normalRating,
        appendRating,
        totalRating,
        potentialRating
      };
    });

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// 6. User Settings & Profile API
app.post('/api/user/settings', async (req, res) => {
  const { username, nickname, settings } = req.body;
  if (!username) {
    return res.status(400).json({ error: '유저 계정명이 누락되었습니다.' });
  }
  if (!nickname || nickname.trim() === '') {
    return res.status(400).json({ error: '닉네임은 비워둘 수 없습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT username FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });
    }

    await dbQuery.run(
      'UPDATE users SET nickname = ?, settings = ? WHERE LOWER(username) = LOWER(?)',
      [nickname, JSON.stringify(settings || { songTitleLang: 'jp' }), username]
    );

    res.json({
      success: true,
      message: '프로필 및 환경설정이 저장되었습니다!',
      nickname,
      settings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// --- Server-side Rating Calculation Helpers for Rankings ---
function isNewSongServer(song) {
  if (!song) return false;
  const publishedAt = song.publishedAt ? Number(song.publishedAt) : null;
  if (!publishedAt) return false;
  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
  return (Date.now() - publishedAt) < threeMonthsMs && publishedAt > 0;
}

function getConstantForRatingServer(song, diff, status) {
  if (!song.constants) return song.levels?.[diff] || 0;
  const apKey = `${diff}_ap`;
  const fcKey = `${diff}_fc`;
  if (song.constants[diff] !== undefined && song.constants[diff] !== null) {
    return song.constants[diff];
  }
  if (status === 'full_perfect' || status === 'ap') {
    if (song.constants[apKey] !== undefined && song.constants[apKey] !== null) {
      return song.constants[apKey];
    }
  } else {
    if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
      return song.constants[fcKey];
    }
  }
  return song.levels?.[diff] || 0;
}

function getConstantServer(song, diff, status) {
  if (!song.constants) return song.levels?.[diff] || 0;
  const apKey = `${diff}_ap`;
  const fcKey = `${diff}_fc`;
  if (song.constants[diff] !== undefined && song.constants[diff] !== null) {
    return song.constants[diff];
  }
  if (status === 'full_perfect' || status === 'ap') {
    if (song.constants[apKey] !== undefined && song.constants[apKey] !== null) {
      return song.constants[apKey];
    }
    return song.levels?.[diff] || 0;
  } else if (status === 'full_combo' || status === 'fc') {
    if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
      return song.constants[fcKey];
    }
    return song.levels?.[diff] || 0;
  } else {
    if (song.constants[fcKey] !== undefined && song.constants[fcKey] !== null) {
      return song.constants[fcKey];
    }
    return song.levels?.[diff] || 0;
  }
}

function calculateRatingServer(song, diff, status) {
  if (!status || status === 'none') return 0;
  let multiplier = 0;
  if (status === 'full_perfect') multiplier = 8.0;
  else if (status === 'full_combo') multiplier = 7.5;
  else if (status === 'clear') multiplier = 5.0;
  else return 0;

  const levelConst = getConstantServer(song, diff, status);
  return Math.round(multiplier * levelConst);
}

function calculateNewRatingServer(song, diff, status) {
  if (!status || status === 'none') return 0;
  if (status === 'full_perfect') {
    const constant = getConstantForRatingServer(song, diff, 'full_perfect');
    return constant + 2.0;
  } else if (status === 'full_combo') {
    const constant = getConstantForRatingServer(song, diff, 'full_combo');
    return constant + 0.0;
  } else if (status === 'clear') {
    return 0;
  }
  return 0;
}

function calculateRatingsOnServer(scoresArray, songsMap) {
  const allRatings = [];
  const appendRatings = [];
  const newList = [];
  const oldList = [];

  scoresArray.forEach(score => {
    const songId = String(score.id);
    const song = songsMap.get(songId);
    if (!song) return;

    const difficulties = ['easy', 'normal', 'hard', 'expert', 'master'];
    difficulties.forEach(diff => {
      const status = score[diff];
      if (status && status !== 'none') {
        const rating = calculateRatingServer(song, diff, status);
        if (rating > 0) {
          allRatings.push(rating);
        }

        const newRating = calculateNewRatingServer(song, diff, status);
        if (newRating > 0) {
          const isNew = isNewSongServer(song);
          if (isNew) {
            newList.push(newRating);
          } else {
            oldList.push(newRating);
          }
        }
      }
    });

    const appendStatus = score.append;
    if (appendStatus && appendStatus !== 'none') {
      const rating = calculateRatingServer(song, 'append', appendStatus);
      if (rating > 0) {
        appendRatings.push(rating);
      }

      const newRating = calculateNewRatingServer(song, 'append', appendStatus);
      if (newRating > 0) {
        const isNew = isNewSongServer(song);
        if (isNew) {
          newList.push(newRating);
        } else {
          oldList.push(newRating);
        }
      }
    }
  });

  allRatings.sort((a, b) => b - a);
  const top39 = allRatings.slice(0, 39);
  const normal = Math.round(top39.reduce((acc, curr) => acc + curr, 0));

  appendRatings.sort((a, b) => b - a);
  const top15 = appendRatings.slice(0, 15);
  const append = Math.round(top15.reduce((acc, curr) => acc + curr, 0) * 2.6);

  newList.sort((a, b) => b - a);
  oldList.sort((a, b) => b - a);
  const bestNew = newList.slice(0, 10);
  const bestOld = oldList.slice(0, 30);
  const sumNew = bestNew.reduce((acc, curr) => acc + curr, 0);
  const sumOld = bestOld.reduce((acc, curr) => acc + curr, 0);
  const potential = (bestNew.length + bestOld.length) > 0 ? (sumNew + sumOld) / 40 : 0.0;

  return {
    normal,
    append,
    potential
  };
}

// 7. Global Rankings API
app.get('/api/rankings', async (req, res) => {
  try {
    const songsList = dbSongs.read();
    const songsMap = new Map(songsList.map(s => [String(s.id), s]));

    const rows = await dbQuery.all("SELECT username, nickname, rating_history, scores, created_at FROM users WHERE LOWER(username) != 'admin'");
    const rankings = rows.map(row => {
      let normalRating = 0;
      let appendRating = 0;
      let totalRating = 0;
      let potentialRating = 0;

      try {
        const history = JSON.parse(row.rating_history || '{}');
        const dates = Object.keys(history).sort();
        if (dates.length > 0) {
          const lastEntry = history[dates[dates.length - 1]];
          if (typeof lastEntry === 'object' && lastEntry !== null) {
            normalRating = lastEntry.normal || 0;
            appendRating = lastEntry.append || 0;
            potentialRating = lastEntry.potential || 0;
            totalRating = normalRating + appendRating;
          } else if (typeof lastEntry === 'number') {
            normalRating = lastEntry;
            appendRating = 0;
            totalRating = lastEntry;
          }
        }
      } catch (e) {
        console.error('Error parsing rating history for user', row.username, e);
      }

      // Dynamic recalculation fallback if potentialRating is 0 or normalRating is 0, but scores are present
      let scoresArray = [];
      try {
        scoresArray = JSON.parse(row.scores || '[]');
      } catch (e) {
        console.error('Error parsing scores for user', row.username, e);
      }

      if ((normalRating === 0 || potentialRating === 0) && scoresArray.length > 0) {
        const computed = calculateRatingsOnServer(scoresArray, songsMap);
        if (normalRating === 0) normalRating = computed.normal;
        if (appendRating === 0) appendRating = computed.append;
        if (potentialRating === 0) potentialRating = computed.potential;
        totalRating = normalRating + appendRating;
      }

      if (potentialRating === 0 && normalRating > 0) {
        potentialRating = normalRating / 292.5;
      }

      let apCount = 0;
      let fcCount = 0;
      let clearCount = 0;
      scoresArray.forEach(s => {
        ['easy', 'normal', 'hard', 'expert', 'master', 'append'].forEach(d => {
          if (s[d] === 'full_perfect') apCount++;
          else if (s[d] === 'full_combo') fcCount++;
          else if (s[d] === 'clear') clearCount++;
        });
      });

      if (apCount === 0 && fcCount === 0 && clearCount === 0) {
        normalRating = 0;
        appendRating = 0;
        totalRating = 0;
        potentialRating = 0.0;
      }

      return {
        username: row.username,
        nickname: row.nickname,
        normalRating,
        appendRating,
        totalRating,
        potentialRating,
        apCount,
        fcCount,
        clearCount,
        createdAt: row.created_at
      };
    });

    res.json({
      success: true,
      rankings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});


app.get('*', (req, res) => {
  const indexHTML = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexHTML)) {
    res.sendFile(indexHTML);
  } else {
    res.send('PJSK Analyzer Server is Running! (Front-end build not found yet)');
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 PJSK ANALYZER Full-Stack Server Running!`);
  console.log(`👉 http://127.0.0.1:${PORT}`);
  console.log(`===============================================`);

  console.log('[Startup] Triggering initial song sync...');
  syncSongsInternal().catch(err => {
    console.error('[Startup] Initial song sync failed on startup (this is normal if offline):', err.message);
    prefetchJacketsBackground(dbSongs.read());
  });
});
