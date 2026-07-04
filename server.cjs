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

  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS patterns (
      song_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      burst INTEGER DEFAULT 0,
      jacks INTEGER DEFAULT 0,
      trill INTEGER DEFAULT 0,
      onehand_trill INTEGER DEFAULT 0,
      doublet INTEGER DEFAULT 0,
      aim INTEGER DEFAULT 0,
      flick INTEGER DEFAULT 0,
      holding INTEGER DEFAULT 0,
      reading INTEGER DEFAULT 0,
      rhythm INTEGER DEFAULT 0,
      gimmick INTEGER DEFAULT 0,
      crossing INTEGER DEFAULT 0,
      PRIMARY KEY (song_id, difficulty)
    )
  `);

  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS pattern_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      username TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      before_values TEXT NOT NULL,
      after_values TEXT NOT NULL
    )
  `);

  // Migrate 'onehand_trill' and 'crossing' columns in patterns table if they don't exist
  try {
    const tableInfo = await dbQuery.all("PRAGMA table_info(patterns)");
    const hasOnehandTrill = tableInfo.some(col => col.name === 'onehand_trill');
    if (!hasOnehandTrill) {
      await dbQuery.run("ALTER TABLE patterns ADD COLUMN onehand_trill INTEGER DEFAULT 0");
      console.log("[Migration] Added 'onehand_trill' column to patterns table.");
    }
    const hasCrossing = tableInfo.some(col => col.name === 'crossing');
    if (!hasCrossing) {
      await dbQuery.run("ALTER TABLE patterns ADD COLUMN crossing INTEGER DEFAULT 0");
      console.log("[Migration] Added 'crossing' column to patterns table.");
    }
  } catch (err) {
    console.error("[Migration] Error adding columns to patterns:", err);
  }

  // Migrate 'role' column
  try {
    const tableInfo = await dbQuery.all("PRAGMA table_info(users)");
    const hasRole = tableInfo.some(col => col.name === 'role');
    if (!hasRole) {
      await dbQuery.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
      console.log("[Migration] Added 'role' column to users table.");
    }
    // Force admin role for the default admin user
    await dbQuery.run("UPDATE users SET role = 'admin' WHERE LOWER(username) = 'admin'");
  } catch (err) {
    console.error("[Migration] Error adding role column to users:", err);
  }

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
            `INSERT INTO users (username, nickname, password_salt, password_hash, scores, friends, settings, rating_history, created_at, role)
             VALUES (?, ?, ?, ?, ?, '[]', '{"songTitleLang":"jp"}', '{}', ?, ?)`,
            [u.username, u.nickname, u.salt, u.hash, JSON.stringify(userScores), u.createdAt || new Date().toISOString(), u.username.toLowerCase() === 'admin' ? 'admin' : 'user']
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

const originalDbSongsRead = dbSongs.read.bind(dbSongs);
dbSongs.read = function() {
  const songs = originalDbSongsRead();
  const isAfterRemoveDate = new Date() >= new Date('2026-04-22');
  if (isAfterRemoveDate) {
    return songs.filter(song => {
      const idStr = String(Number(song.id));
      return !["707", "708", "709"].includes(idStr);
    });
  }
  return songs;
};

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

// --- Helper to merge Guest and Server scores ---
function mergeScores(localScores, serverScores) {
  const getStatusRank = (status) => {
    if (status === 'full_perfect') return 3;
    if (status === 'full_combo') return 2;
    if (status === 'clear') return 1;
    return 0;
  };

  const getBetterStatus = (s1, s2) => {
    return getStatusRank(s1) >= getStatusRank(s2) ? s1 : s2;
  };

  const mergedMap = new Map();

  // Populate map with server scores first
  if (Array.isArray(serverScores)) {
    for (const score of serverScores) {
      if (score && score.id) {
        mergedMap.set(String(score.id), { ...score });
      }
    }
  }

  // Merge local/guest scores
  if (Array.isArray(localScores)) {
    for (const score of localScores) {
      if (score && score.id) {
        const idStr = String(score.id);
        const existing = mergedMap.get(idStr);
        if (existing) {
          mergedMap.set(idStr, {
            id: idStr,
            easy: getBetterStatus(score.easy, existing.easy),
            normal: getBetterStatus(score.normal, existing.normal),
            hard: getBetterStatus(score.hard, existing.hard),
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
        // [Fix L-2] Handle write-stream errors to avoid unhandled exception crashes
        fileStream.on('error', (writeErr) => {
          console.error(`Error writing jacket file for song ${songId}:`, writeErr.message);
          fs.unlink(jacketPath, () => {}); // Remove partial file
          resolve(null);
        });
      } else {
        res.resume(); // Drain the response to free up memory
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
    let currentTokens = user.token || '';
    let tokenList = [];
    if (currentTokens) {
      tokenList = currentTokens.split(',').map(t => t.trim()).filter(Boolean);
    }
    tokenList.push(token);
    if (tokenList.length > 10) {
      tokenList = tokenList.slice(-10);
    }
    const tokenStr = ',' + tokenList.join(',') + ',';
    await dbQuery.run('UPDATE users SET token = ? WHERE LOWER(username) = LOWER(?)', [tokenStr, username]);

    const updatedHistory = await updateUserRatingHistoryIfNeeded(user.username, user);
    // [Fix M-3] Wrap JSON.parse calls to prevent 500 crashes on malformed DB data
    const safeParseArray = (str) => { try { return JSON.parse(str || '[]'); } catch { return []; } };
    const safeParseObj = (str, def) => { try { return JSON.parse(str || def); } catch { return JSON.parse(def); } };
    res.json({
      message: '로그인 성공!',
      token,
      user: {
        username: user.username,
        nickname: user.nickname,
        role: user.role || (user.username.toLowerCase() === 'admin' ? 'admin' : 'user'),
        friends: safeParseArray(user.friends),
        settings: safeParseObj(user.settings, '{"songTitleLang": "jp"}'),
        rating_history: updatedHistory || safeParseObj(user.rating_history, '{}'),
        scores: safeParseArray(user.scores)
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
    const user = await dbQuery.get('SELECT * FROM users WHERE token = ? OR token LIKE ?', [token, '%,' + token + ',%']);
    if (!user) {
      return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }

    const updatedHistory = await updateUserRatingHistoryIfNeeded(user.username, user);
    // [Fix M-3] Safe JSON parse wrappers
    const safeParseArray = (str) => { try { return JSON.parse(str || '[]'); } catch { return []; } };
    const safeParseObj = (str, def) => { try { return JSON.parse(str || def); } catch { return JSON.parse(def); } };
    res.json({
      user: {
        username: user.username,
        nickname: user.nickname,
        role: user.role || (user.username.toLowerCase() === 'admin' ? 'admin' : 'user'),
        friends: safeParseArray(user.friends),
        settings: safeParseObj(user.settings, '{"songTitleLang": "jp"}'),
        rating_history: updatedHistory || safeParseObj(user.rating_history, '{}'),
        scores: safeParseArray(user.scores)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// --- Shared Auth Middleware ---
// [Fix H-1/H-2/H-3] All write APIs that touch user data now require a valid token.
// The authenticated user's username is stored in req.user.username so endpoints
// can verify that the requester owns the resource they're modifying.
const requireAuth = async (req, res, next) => {
  let token = req.headers.authorization;
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else {
    token = req.query.token || req.body?.token;
  }

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다.' });
  }

  try {
    const user = await dbQuery.get(
      'SELECT * FROM users WHERE token = ? OR token LIKE ?',
      [token, '%,' + token + ',%']
    );
    if (!user) {
      return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
};

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
    const user = await dbQuery.get('SELECT * FROM users WHERE token = ? OR token LIKE ?', [token, '%,' + token + ',%']);
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
    const users = await dbQuery.all('SELECT username, nickname, role, created_at FROM users');
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

// Admin update user role API
app.post('/api/admin/users/:username/role', adminAuth, async (req, res) => {
  const targetUsername = req.params.username;
  const { role } = req.body;

  if (targetUsername.toLowerCase() === 'admin') {
    return res.status(400).json({ error: '최고 관리자의 권한은 변경할 수 없습니다.' });
  }

  if (!['user', 'editor'].includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 권한입니다.' });
  }

  try {
    const result = await dbQuery.run(
      'UPDATE users SET role = ? WHERE LOWER(username) = LOWER(?)',
      [role, targetUsername]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '존재하지 않는 회원입니다.' });
    }

    res.json({ success: true, message: `회원 권한이 ${role === 'editor' ? '수정 권한자' : '일반 유저'}로 변경되었습니다.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '권한 변경 중 에러가 발생했습니다.' });
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
    const user = await dbQuery.get('SELECT * FROM users WHERE token = ? OR token LIKE ?', [token, '%,' + token + ',%']);
    if (!user) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
      return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    const tokenStr = ',' + token + ',';
    await dbQuery.run(
      'UPDATE users SET password_salt = ?, password_hash = ?, token = ? WHERE LOWER(username) = LOWER(?)',
      [salt, hash, tokenStr, user.username]
    );

    res.json({ success: true, message: '비밀번호가 정상적으로 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '비밀번호 변경 중 에러가 발생했습니다.' });
  }
});

// --- Dynamic Config Parsing ---
let CONFIG = {
  songsApiUrl: 'https://api.rilaksekai.com/api/songs',
  syncIntervalMs: 1 * 60 * 60 * 1000
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

// Helper to fetch plain text / HTML with proxy fallback
async function fetchTextWithFallback(targetUrl) {
  console.log(`[Fetch Text] Attempting to fetch from: ${targetUrl}`);
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (response.ok) {
      return await response.text();
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (directError) {
    console.warn(`[Fetch Text] Direct fetch failed: ${directError.message}`);
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
    console.log(`[Fetch Text] Attempting fallback via proxy: ${proxyUrl}`);
    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        return await response.text();
      }
      throw new Error(`Proxy HTTP error! status: ${response.status}`);
    } catch (proxyError) {
      console.error(`[Fetch Text] Proxy fetch failed: ${proxyError.message}`);
      throw new Error(`Both direct fetch and proxy fallback failed. Direct: ${directError.message}, Proxy: ${proxyError.message}`);
    }
  }
}

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

function processAndSaveSongs(songsArray, releaseDates = {}, songTypes = {}) {
  const currentSongs = dbSongs.read();
  const currentMap = new Map(currentSongs.map(s => [s.id, s]));
  let updatedCount = 0;
  let addedCount = 0;

  const isAfterRemoveDate = new Date() >= new Date('2026-04-22');
  if (isAfterRemoveDate) {
    currentMap.delete(707);
    currentMap.delete(708);
    currentMap.delete(709);
    currentMap.delete("707");
    currentMap.delete("708");
    currentMap.delete("709");
  }

  const parseConstant = (val) => {
    if (val === undefined || val === null) return null;
    const valStr = String(val).trim();
    if (valStr === '' || valStr === '-') return null;
    const parsed = parseFloat(valStr);
    return isNaN(parsed) ? null : parsed;
  };

  const normalizeNameForType = name => name ? name.toLowerCase().replace(/[\s\-\_\,\.\!\?\'\"\`\’\“\”\：\:\；\;\~\(\)\[\]\※]/g, '').replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) : '';

  for (const song of songsArray) {
    const songIdStr = String(Number(song.id));
    if (isAfterRemoveDate && ["707", "708", "709"].includes(songIdStr)) {
      continue;
    }

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

    const publishedAtVal = releaseDates[songIdStr] || song.publishedAt || (currentMap.get(song.id)?.publishedAt) || null;

    // Match song type (既, 公, 書) from pjsekai.com wiki scraping
    let songType = '既'; // default is existing
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

    const forceFalseIds = ["230", "231", "232", "233", "234"];
    const forceTrueIds = ["162", "163", "164", "447", "448", "449", "503", "536", "622"];
    let isOriginal = songType === '書';
    if (forceFalseIds.includes(songIdStr)) {
      isOriginal = false;
    } else if (forceTrueIds.includes(songIdStr)) {
      isOriginal = true;
    }

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
      publishedAt: publishedAtVal,
      original: isOriginal
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
  syncAllUsersRatingHistory().catch(err => {
    console.error('[Auto Sync] Failed to run syncAllUsersRatingHistory in background:', err);
  });

  return { success: true, addedCount, updatedCount, totalCount: updatedList.length };
}

async function syncSongsInternal(targetUrl = SONGS_API_URL) {
  if (isSyncing) return null;
  isSyncing = true;
  try {
    const apiResponse = await fetchUrlWithFallback(targetUrl);
    
    let releaseDates = {};
    try {
      const datesData = await fetchUrlWithFallback('https://sekai-world.github.io/sekai-master-db-diff/musics.json');
      if (Array.isArray(datesData)) {
        datesData.forEach(m => {
          if (m.id && m.publishedAt) {
            releaseDates[String(m.id)] = m.publishedAt;
          }
        });
        console.log(`[Auto Sync] Successfully fetched ${Object.keys(releaseDates).length} release dates.`);
      }
    } catch (e) {
      console.error('[Auto Sync] Failed to fetch release dates, fallback to none:', e.message);
    }

    let songTypes = {};
    try {
      console.log('[Auto Sync] Fetching song types from pjsekai.com...');
      const wikiHtml = await fetchTextWithFallback('https://pjsekai.com/?aad6ee23b0');
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let m;
      const cleanText = text => text ? text.replace(/<[^>]*>/g, '').trim() : '';
      const normalizeNameForType = name => name ? name.toLowerCase().replace(/[\s\-\_\,\.\!\?\'\"\`\’\“\”\：\:\；\;\~\(\)\[\]\※]/g, '').replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) : '';

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
          if ((typeText === '既' || typeText === '公' || typeText === '書') && titleTd.includes('<a href=')) {
            const titleText = cleanText(titleTd);
            const normTitle = normalizeNameForType(titleText);
            if (normTitle) {
              songTypes[normTitle] = typeText;
            }
            songTypes[titleText] = typeText;
          }
        }
      }
      console.log(`[Auto Sync] Successfully fetched song types map of size ${Object.keys(songTypes).length}.`);
    } catch (e) {
      console.error('[Auto Sync] Failed to fetch song types, fallback to empty:', e.message);
    }

    return processAndSaveSongs(apiResponse, releaseDates, songTypes);
  } catch (error) {
    console.error('[Auto Sync] Error syncing songs:', error);
    throw error;
  } finally {
    isSyncing = false;
  }
}

const TRAINER_CACHE_PATH = path.join(DB_DIR, 'trainer_songs.json');
let lastTrainerSyncTime = 0;
let cachedTrainerSongs = null;

// Scraping trainer site data and caching
async function fetchTrainerSongs() {
  const now = Date.now();

  // 1. Return in-memory cache if it exists and is less than 1 hour old
  if (cachedTrainerSongs && (now - lastTrainerSyncTime < 1 * 60 * 60 * 1000)) {
    return cachedTrainerSongs;
  }

  // 2. If memory cache doesn't exist or is expired, check if disk cache exists and is fresh
  try {
    if (!cachedTrainerSongs && fs.existsSync(TRAINER_CACHE_PATH)) {
      const stats = fs.statSync(TRAINER_CACHE_PATH);
      const cacheAge = now - stats.mtimeMs;
      if (cacheAge < 1 * 60 * 60 * 1000) {
        console.log('[Trainer] Loading from disk cache...');
        const data = fs.readFileSync(TRAINER_CACHE_PATH, 'utf-8');
        cachedTrainerSongs = JSON.parse(data);
        lastTrainerSyncTime = stats.mtimeMs; // Align sync time to file's mtime
        return cachedTrainerSongs;
      }
    }
  } catch (err) {
    console.error('[Trainer] Error reading cache file:', err.message);
  }

  // 3. Otherwise, perform scraping
  console.log('[Trainer] Scraping trainer data from proseka-trainer.com...');
  try {
    const htmlRes = await fetch("https://proseka-trainer.com/", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!htmlRes.ok) throw new Error(`HTML fetch failed: ${htmlRes.status}`);
    const html = await htmlRes.text();
    
    const scriptRegex = /<script[^>]*src="([^"]*static\/js\/main[^"]*)"/i;
    const match = html.match(scriptRegex);
    if (!match) throw new Error("No main script found in HTML");
    
    const scriptUrl = new URL(match[1], "https://proseka-trainer.com/").toString();
    console.log("[Trainer] Fetching JS from:", scriptUrl);
    
    const jsRes = await fetch(scriptUrl);
    if (!jsRes.ok) throw new Error(`JS fetch failed: ${jsRes.status}`);
    const jsText = await jsRes.text();
    
    const target = "S=[{";
    const startIndex = jsText.indexOf(target);
    if (startIndex === -1) throw new Error("Could not find 'S=[{' in JS");
    
    const arrayStartIndex = startIndex + 2; // index of '['
    
    let bracketCount = 1;
    let index = arrayStartIndex + 1;
    let insideString = false;
    let stringChar = null;
    
    while (bracketCount > 0 && index < jsText.length) {
      const char = jsText[index];
      if (insideString) {
        if (char === stringChar && jsText[index - 1] !== '\\') {
          insideString = false;
          stringChar = null;
        }
      } else {
        if (char === '"' || char === "'" || char === '`') {
          insideString = true;
          stringChar = char;
        } else if (char === '[') {
          bracketCount++;
        } else if (char === ']') {
          bracketCount--;
        }
      }
      index++;
    }
    
    const arrayString = jsText.substring(arrayStartIndex, index);
    
    // [Fix H-5] Replace vm.runInContext with a safe JSON.parse approach.
    // Node's vm module is NOT a secure sandbox; executing remote JS from a
    // third-party site risks server compromise if the site is ever hijacked.
    // We use a safe, custom character-tokenization parser to convert the JS literal
    // array to a JavaScript object, avoiding insecure eval/vm or fragile regex-based JSON conversion.
    function parseJSArrayOrObject(str) {
      let index = 0;
      
      function skipWhitespace() {
        while (index < str.length && /\s/.test(str[index])) {
          index++;
        }
      }
      
      function parseValue() {
        skipWhitespace();
        if (index >= str.length) throw new Error("Unexpected end of input");
        
        const char = str[index];
        if (char === '[') return parseArray();
        if (char === '{') return parseObject();
        if (char === '"' || char === "'") return parseString();
        
        return parsePrimitiveOrIdentifier();
      }
      
      function parseArray() {
        index++; // skip '['
        const arr = [];
        skipWhitespace();
        if (str[index] === ']') {
          index++;
          return arr;
        }
        while (true) {
          arr.push(parseValue());
          skipWhitespace();
          if (str[index] === ',') {
            index++;
            skipWhitespace();
            // check trailing comma
            if (str[index] === ']') {
              index++;
              return arr;
            }
          } else if (str[index] === ']') {
            index++;
            return arr;
          } else {
            throw new Error(`Expected ',' or ']' at position ${index}, got '${str[index]}'`);
          }
        }
      }
      
      function parseObject() {
        index++; // skip '{'
        const obj = {};
        skipWhitespace();
        if (str[index] === '}') {
          index++;
          return obj;
        }
        while (true) {
          let key;
          skipWhitespace();
          const char = str[index];
          if (char === '"' || char === "'") {
            key = parseString();
          } else {
            // identifier key
            const match = str.slice(index).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
            if (!match) {
              throw new Error(`Expected object key identifier at position ${index}`);
            }
            key = match[0];
            index += key.length;
          }
          skipWhitespace();
          if (str[index] !== ':') {
            throw new Error(`Expected ':' at position ${index}, got '${str[index]}'`);
          }
          index++; // skip ':'
          obj[key] = parseValue();
          skipWhitespace();
          if (str[index] === ',') {
            index++;
            skipWhitespace();
            // check trailing comma
            if (str[index] === '}') {
              index++;
              return obj;
            }
          } else if (str[index] === '}') {
            index++;
            return obj;
          } else {
            throw new Error(`Expected ',' or '}' at position ${index}, got '${str[index]}'`);
          }
        }
      }
      
      function parseString() {
        const quote = str[index];
        index++; // skip quote
        let val = "";
        while (index < str.length) {
          const char = str[index];
          if (char === quote) {
            index++;
            return val;
          }
          if (char === '\\') {
            index++;
            const nextChar = str[index];
            if (nextChar === 'x') {
              // hex escape (e.g. \xd7)
              const hex = str.slice(index + 1, index + 3);
              val += String.fromCharCode(parseInt(hex, 16));
              index += 3;
            } else if (nextChar === 'u') {
              // unicode escape (e.g. \u30fc)
              const hex = str.slice(index + 1, index + 5);
              val += String.fromCharCode(parseInt(hex, 16));
              index += 5;
            } else {
              const escapeMap = {
                'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f',
                '\\': '\\', '"': '"', "'": "'", '/': '/'
              };
              val += escapeMap[nextChar] || nextChar;
              index++;
            }
          } else {
            val += char;
            index++;
          }
        }
        throw new Error("Unterminated string");
      }
      
      function parsePrimitiveOrIdentifier() {
        const start = index;
        // Match until a delimiter
        const match = str.slice(index).match(/^[^,\]\}\s:]+/);
        if (!match) {
          throw new Error(`Expected value at position ${index}`);
        }
        const raw = match[0];
        index += raw.length;
        
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw === 'null') return null;
        if (raw === 'undefined') return null; // Convert undefined to null
        if (raw === 'NaN') return null;       // Convert NaN to null
        if (raw === 'Infinity') return null;  // Convert Infinity to null
        
        // Try to parse number
        let numStr = raw;
        if (numStr.startsWith('.')) {
          numStr = '0' + numStr;
        } else if (numStr.startsWith('-.') || numStr.startsWith('+.')) {
          numStr = numStr[0] + '0' + numStr.slice(1);
        }
        const num = Number(numStr);
        if (!isNaN(num)) {
          return num;
        }
        
        throw new Error(`Unknown token: ${raw} at position ${start}`);
      }
      
      return parseValue();
    }

    let parsedArray;
    try {
      parsedArray = parseJSArrayOrObject(arrayString);
    } catch (parseErr) {
      throw new Error(`Parsing JS array failed: ${parseErr.message}`);
    }
    
    if (Array.isArray(parsedArray)) {
      fs.writeFileSync(TRAINER_CACHE_PATH, JSON.stringify(parsedArray, null, 2), 'utf-8');
      cachedTrainerSongs = parsedArray;
      lastTrainerSyncTime = Date.now();
      console.log(`[Trainer] Successfully crawled and cached ${parsedArray.length} songs from trainer.`);
      return parsedArray;
    } else {
      throw new Error("Parsed data is not an array");
    }
  } catch (error) {
    console.error("[Trainer] Scraping failed, fallback to cache if available:", error.message);
    if (fs.existsSync(TRAINER_CACHE_PATH)) {
      try {
        const data = fs.readFileSync(TRAINER_CACHE_PATH, 'utf-8');
        cachedTrainerSongs = JSON.parse(data);
        lastTrainerSyncTime = Date.now(); // Postpone next attempt by 1 hour
        return cachedTrainerSongs;
      } catch (e) {
        console.error('[Trainer] Fallback cache read failed:', e.message);
      }
    }
    return cachedTrainerSongs || [];
  }
}

function normalizeSongName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\s\-\_\,\.\!\?\'\"\`\’\“\”\：\:\；\;\~\(\)\[\]\※]/g, '')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function findTrainerSong(song, trainerSongs) {
  const titleJpNormal = normalizeSongName(song.title_jp);
  const titleKoNormal = normalizeSongName(song.title_ko);
  
  let match = trainerSongs.find(ts => {
    const tsNormal = normalizeSongName(ts.songName);
    return tsNormal === titleJpNormal || tsNormal === titleKoNormal;
  });
  
  if (match) return match;
  
  const titleHangulNormal = normalizeSongName(song.title_hangul);
  match = trainerSongs.find(ts => {
    const tsNormal = normalizeSongName(ts.songName);
    return tsNormal === titleHangulNormal;
  });
  
  return match || null;
}

// --- Pattern Constants APIs ---
app.get('/api/patterns', async (req, res) => {
  try {
    const rows = await dbQuery.all('SELECT * FROM patterns');
    res.json(rows);
  } catch (err) {
    console.error('[Patterns API] Error fetching patterns:', err);
    res.status(500).json({ error: '패턴 상수를 가져오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/patterns', requireAuth, async (req, res) => {
  const userRole = req.user.role || (req.user.username.toLowerCase() === 'admin' ? 'admin' : 'user');
  if (userRole !== 'admin' && userRole !== 'editor') {
    return res.status(403).json({ error: '패턴 상수를 수정할 권한이 없습니다.' });
  }

  const {
    song_id,
    difficulty,
    burst,
    jacks,
    trill,
    onehand_trill,
    doublet,
    aim,
    flick,
    holding,
    reading,
    rhythm,
    gimmick,
    crossing
  } = req.body;

  if (!song_id || !difficulty) {
    return res.status(400).json({ error: '곡 ID와 난이도는 필수입니다.' });
  }

  try {
    // 1. Fetch previous pattern values to compare
    const previousPattern = await dbQuery.get(
      'SELECT * FROM patterns WHERE song_id = ? AND difficulty = ?',
      [song_id, difficulty]
    );

    // 2. Prepare before and after objects
    const afterValues = {
      burst: Number(burst) || 0,
      jacks: Number(jacks) || 0,
      trill: Number(trill) || 0,
      onehand_trill: Number(onehand_trill) || 0,
      doublet: Number(doublet) || 0,
      aim: Number(aim) || 0,
      flick: Number(flick) || 0,
      holding: Number(holding) || 0,
      reading: Number(reading) || 0,
      rhythm: Number(rhythm) || 0,
      gimmick: Number(gimmick) || 0,
      crossing: Number(crossing) || 0
    };

    const beforeValues = previousPattern ? {
      burst: Number(previousPattern.burst) || 0,
      jacks: Number(previousPattern.jacks) || 0,
      trill: Number(previousPattern.trill) || 0,
      onehand_trill: Number(previousPattern.onehand_trill) || 0,
      doublet: Number(previousPattern.doublet) || 0,
      aim: Number(previousPattern.aim) || 0,
      flick: Number(previousPattern.flick) || 0,
      holding: Number(previousPattern.holding) || 0,
      reading: Number(previousPattern.reading) || 0,
      rhythm: Number(previousPattern.rhythm) || 0,
      gimmick: Number(previousPattern.gimmick) || 0,
      crossing: Number(previousPattern.crossing) || 0
    } : {
      burst: 0,
      jacks: 0,
      trill: 0,
      onehand_trill: 0,
      doublet: 0,
      aim: 0,
      flick: 0,
      holding: 0,
      reading: 0,
      rhythm: 0,
      gimmick: 0,
      crossing: 0
    };

    // 3. Check if anything actually changed
    let hasChanged = false;
    for (const key of Object.keys(afterValues)) {
      if (beforeValues[key] !== afterValues[key]) {
        hasChanged = true;
        break;
      }
    }

    // 4. Update patterns table
    await dbQuery.run(`
      INSERT INTO patterns (song_id, difficulty, burst, jacks, trill, onehand_trill, doublet, aim, flick, holding, reading, rhythm, gimmick, crossing)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(song_id, difficulty) DO UPDATE SET
        burst = excluded.burst,
        jacks = excluded.jacks,
        trill = excluded.trill,
        onehand_trill = excluded.onehand_trill,
        doublet = excluded.doublet,
        aim = excluded.aim,
        flick = excluded.flick,
        holding = excluded.holding,
        reading = excluded.reading,
        rhythm = excluded.rhythm,
        gimmick = excluded.gimmick,
        crossing = excluded.crossing
    `, [
      song_id,
      difficulty,
      afterValues.burst,
      afterValues.jacks,
      afterValues.trill,
      afterValues.onehand_trill,
      afterValues.doublet,
      afterValues.aim,
      afterValues.flick,
      afterValues.holding,
      afterValues.reading,
      afterValues.rhythm,
      afterValues.gimmick,
      afterValues.crossing
    ]);

    // 5. If changed, record history
    if (hasChanged) {
      const changedAt = new Date().toISOString();
      const username = req.user.username;
      await dbQuery.run(`
        INSERT INTO pattern_history (song_id, difficulty, username, changed_at, before_values, after_values)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        song_id,
        difficulty,
        username,
        changedAt,
        JSON.stringify(beforeValues),
        JSON.stringify(afterValues)
      ]);
    }

    res.json({ success: true, message: '패턴 상수가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('[Patterns API] Error updating pattern:', error);
    res.status(500).json({ error: '패턴 상수 저장 중 오류가 발생했습니다.' });
  }
});

app.get('/api/patterns/history', async (req, res) => {
  try {
    const rows = await dbQuery.all('SELECT * FROM pattern_history ORDER BY changed_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) {
    console.error('[Patterns History API] Error fetching history:', err);
    res.status(500).json({ error: '패턴 변경 히스토리를 가져오는 중 오류가 발생했습니다.' });
  }
});

app.get('/api/songs', async (req, res) => {
  try {
    const songs = dbSongs.read();
    const trainerSongs = await fetchTrainerSongs();
    
    const mergedSongs = songs.map(song => {
      const trainerSong = findTrainerSong(song, trainerSongs);
      return {
        ...song,
        videoIds: trainerSong ? trainerSong.videoIds : null
      };
    });
    
    res.json(mergedSongs);
  } catch (error) {
    console.error('[Songs API] Error sending songs with trainer data:', error);
    res.json(dbSongs.read());
  }

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
    const updatedHistory = await updateUserRatingHistoryIfNeeded(user.username, user);
    res.json({
      username: user.username,
      nickname: user.nickname,
      scores: JSON.parse(user.scores || '[]'),
      rating_history: updatedHistory || JSON.parse(user.rating_history || '{}')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// [Fix H-1] requireAuth ensures only the token owner can write their scores.
// Ownership check: token's username must match the requested username.
app.post('/api/scores', requireAuth, async (req, res) => {
  const { username, scores, rating: ratingDestructured, ratings, modifications, replace } = req.body;
  if (!username) {
    return res.status(400).json({ error: '유저 계정명이 누락되었습니다.' });
  }

  // [Fix H-1] Ownership check: requester can only modify their own data
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ error: '다른 유저의 데이터를 수정할 권한이 없습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT scores, rating_history, nickname FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '해당 유저를 찾을 수 없습니다.' });
    }

    let finalScores;
    if (replace) {
      finalScores = scores || [];
    } else if (modifications && Array.isArray(modifications)) {
      let currentScores = [];
      try {
        currentScores = JSON.parse(user.scores || '[]');
      } catch (err) {
        console.error("JSON parse error for scores", err);
      }

      modifications.forEach(mod => {
        const songId = String(mod.id);
        const diff = mod.diff;
        const status = mod.status === 'none' ? null : mod.status;

        const existIdx = currentScores.findIndex(s => String(s.id) === songId);
        if (existIdx !== -1) {
          currentScores[existIdx] = {
            ...currentScores[existIdx],
            [diff]: status
          };
        } else {
          currentScores.push({
            id: songId,
            easy: diff === 'easy' ? status : null,
            normal: diff === 'normal' ? status : null,
            hard: diff === 'hard' ? status : null,
            expert: diff === 'expert' ? status : null,
            master: diff === 'master' ? status : null,
            append: diff === 'append' ? status : null
          });
        }
      });
      finalScores = currentScores;
    } else {
      finalScores = scores || [];
    }

    await dbQuery.run(
      'UPDATE users SET scores = ? WHERE LOWER(username) = LOWER(?)',
      [JSON.stringify(finalScores), username]
    );

    const updatedHistory = await updateUserRatingHistoryIfNeeded(username);
    // [Fix M-3] Safe parse for stale rating_history fallback
    const safeParseObj = (str, def) => { try { return JSON.parse(str || def); } catch { return JSON.parse(def); } };

    res.json({
      success: true,
      message: '플레이 기록과 레이팅이 성공적으로 저장되었습니다!',
      scores: finalScores,
      rating_history: updatedHistory || safeParseObj(user.rating_history, '{}')
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
// [Fix H-2] requireAuth + ownership check for friends/add
app.post('/api/friends/add', requireAuth, async (req, res) => {
  const { username, friendUsername } = req.body;
  if (!username || !friendUsername) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
  }

  // Ownership check
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ error: '다른 유저의 데이터를 수정할 권한이 없습니다.' });
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

    let friendsList = [];
    try { friendsList = JSON.parse(user.friends || '[]'); } catch { friendsList = []; }
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

// [Fix H-2] requireAuth + ownership check for friends/remove
app.post('/api/friends/remove', requireAuth, async (req, res) => {
  const { username, friendUsername } = req.body;
  if (!username || !friendUsername) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
  }

  // Ownership check
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ error: '다른 유저의 데이터를 수정할 권한이 없습니다.' });
  }

  try {
    const user = await dbQuery.get('SELECT friends FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });
    }

    let friendsList = [];
    try { friendsList = JSON.parse(user.friends || '[]'); } catch { friendsList = []; }
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

// [Fix H-3] requireAuth + ownership check for user/settings
// 6. User Settings & Profile API
app.post('/api/user/settings', requireAuth, async (req, res) => {
  const { username, nickname, settings } = req.body;
  if (!username) {
    return res.status(400).json({ error: '유저 계정명이 누락되었습니다.' });
  }

  // Ownership check
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ error: '다른 유저의 설정을 변경할 권한이 없습니다.' });
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

async function updateUserRatingHistoryIfNeeded(username, userRecord = null, songsMap = null) {
  try {
    let user = userRecord;
    if (!user) {
      user = await dbQuery.get('SELECT username, scores, rating_history FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    }
    if (!user) return null;

    const scoresArray = JSON.parse(user.scores || '[]');
    const ratingHistory = JSON.parse(user.rating_history || '{}');

    if (!songsMap) {
      const songsList = dbSongs.read();
      songsMap = new Map(songsList.map(s => [String(s.id), s]));
    }

    const computed = calculateRatingsOnServer(scoresArray, songsMap);
    const newNormal = computed.normal;
    const newAppend = computed.append;
    const newPotential = Math.floor(computed.potential * 10000) / 10000;

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

    const today = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(today);

    let needsUpdate = false;

    if (ratingHistory[todayStr]) {
      const todayEntry = ratingHistory[todayStr];
      const todayNormal = typeof todayEntry === 'object' ? (todayEntry.normal || 0) : todayEntry;
      const todayAppend = typeof todayEntry === 'object' ? (todayEntry.append || 0) : 0;
      const todayPotential = typeof todayEntry === 'object' ? (todayEntry.potential || 0) : 0;

      if (newNormal !== todayNormal || newAppend !== todayAppend || newPotential !== todayPotential) {
        needsUpdate = true;
      }
    } else {
      if (sortedDates.length === 0) {
        if (newNormal > 0 || newAppend > 0 || newPotential > 0) {
          needsUpdate = true;
        }
      } else if (newNormal !== lastNormal || newAppend !== lastAppend || newPotential !== lastPotential) {
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      ratingHistory[todayStr] = {
        normal: newNormal,
        append: newAppend,
        potential: newPotential
      };

      await dbQuery.run(
        'UPDATE users SET rating_history = ? WHERE LOWER(username) = LOWER(?)',
        [JSON.stringify(ratingHistory), username]
      );
      console.log(`[Auto Update History] Updated rating history for ${username} on ${todayStr} (Normal: ${newNormal}, Append: ${newAppend}, Potential: ${newPotential})`);
    }

    return ratingHistory;
  } catch (e) {
    console.error(`Error updating rating history for ${username}:`, e);
    return null;
  }
}

async function syncAllUsersRatingHistory() {
  console.log('[Auto Update History] Starting global ratings sync for all users...');
  try {
    const songsList = dbSongs.read();
    const songsMap = new Map(songsList.map(s => [String(s.id), s]));

    const users = await dbQuery.all("SELECT username, scores, rating_history FROM users WHERE LOWER(username) != 'admin'");
    let updatedCount = 0;

    for (const user of users) {
      const updated = await updateUserRatingHistoryIfNeeded(user.username, user, songsMap);
      if (updated) {
        updatedCount++;
      }
    }
    console.log(`[Auto Update History] Global ratings sync finished. Processed ${users.length} users.`);
  } catch (e) {
    console.error('[Auto Update History] Error in global ratings sync:', e);
  }
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

  console.log('[Startup] Fetching trainer songs data...');
  fetchTrainerSongs().catch(err => {
    console.error('[Startup] Failed to fetch trainer songs data on startup:', err.message);
  });
});
