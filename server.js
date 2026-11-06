const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const KOBOLD_API_URL = process.env.KOBOLD_API_URL || 'http://localhost:5001/v1';

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Default Settings
const DEFAULT_SETTINGS = {
  provider: process.env.AI_PROVIDER || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'local'),
  localUrl: process.env.KOBOLD_API_URL || 'http://localhost:5001/v1',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'sao10k/l3-8b-stheno-v3.2',
  togetherApiKey: process.env.TOGETHER_API_KEY || '',
  togetherModel: process.env.TOGETHER_MODEL || 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
  customBaseUrl: process.env.CUSTOM_BASE_URL || '',
  customApiKey: process.env.CUSTOM_API_KEY || '',
  customModel: process.env.CUSTOM_MODEL || '',
  temperature: 0.85,
  maxTokens: 450
};

function getSettings() {
  const current = readJson(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...current };
}

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer Storage for Avatar Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read/write JSON
function readJson(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultVal;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultVal;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// ------------------------------------------------------------
// API Endpoints
// ------------------------------------------------------------

// Check AI Connection & Status (Local or Cloud)
app.get('/api/status', async (req, res) => {
  const settings = getSettings();
  const provider = settings.provider || 'local';

  if (provider === 'local') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const url = `${settings.localUrl || 'http://localhost:5001/v1'}/models`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const modelName = data.data?.[0]?.id || 'KoboldCpp (RTX)';
        return res.json({
          online: true,
          provider: 'local',
          label: 'AI Online (Local RTX)',
          model: modelName
        });
      }
      return res.json({
        online: false,
        provider: 'local',
        label: 'Local AI Offline',
        error: 'KoboldCpp returned non-200'
      });
    } catch (err) {
      return res.json({
        online: false,
        provider: 'local',
        label: 'Local AI Offline',
        error: 'Cannot connect to KoboldCpp at ' + (settings.localUrl || 'http://localhost:5001/v1')
      });
    }
  } else if (provider === 'openrouter') {
    const key = (settings.openrouterApiKey || '').trim();
    if (!key) {
      return res.json({
        online: false,
        provider: 'openrouter',
        label: 'OpenRouter (No Key)',
        error: 'Please enter your OpenRouter API key in Settings.'
      });
    }
    return res.json({
      online: true,
      provider: 'openrouter',
      label: `Cloud (OpenRouter: ${(settings.openrouterModel || 'Stheno 8B').split('/').pop()})`,
      model: settings.openrouterModel || 'sao10k/l3-8b-stheno-v3.2'
    });
  } else if (provider === 'groq') {
    const key = (settings.groqApiKey || '').trim();
    if (!key) {
      return res.json({ online: false, provider: 'groq', label: 'Groq (No Key)', error: 'Please enter your Groq API key.' });
    }
    return res.json({ online: true, provider: 'groq', label: `Cloud (Groq: ${settings.groqModel || 'Llama 3'})`, model: settings.groqModel });
  } else if (provider === 'together') {
    const key = (settings.togetherApiKey || '').trim();
    if (!key) {
      return res.json({ online: false, provider: 'together', label: 'Together (No Key)', error: 'Please enter your Together API key.' });
    }
    return res.json({ online: true, provider: 'together', label: `Cloud (Together AI)`, model: settings.togetherModel });
  } else if (provider === 'custom') {
    return res.json({
      online: !!settings.customBaseUrl,
      provider: 'custom',
      label: `Custom Cloud (${settings.customModel || 'OpenAI API'})`,
      model: settings.customModel
    });
  }
});

// Get Current Settings
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

// Update Settings
app.post('/api/settings', (req, res) => {
  const current = getSettings();
  const updated = { ...current, ...req.body };
  writeJson(SETTINGS_FILE, updated);
  res.json({ success: true, settings: updated });
});

// Test Connection for Any Provider
app.post('/api/settings/test', async (req, res) => {
  const { provider, localUrl, openrouterApiKey, togetherApiKey, groqApiKey, customBaseUrl, customApiKey } = req.body;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    if (provider === 'local') {
      const url = `${localUrl || 'http://localhost:5001/v1'}/models`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, message: `Connected to KoboldCpp successfully! Model: ${data.data?.[0]?.id || 'Local Model'}` });
      }
      return res.json({ success: false, error: `KoboldCpp returned HTTP ${response.status}` });
    } else if (provider === 'openrouter') {
      if (!openrouterApiKey) return res.json({ success: false, error: 'Please enter an OpenRouter API key' });
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${openrouterApiKey}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        const limit = data.data?.limit != null ? `$${data.data.limit}` : 'Active';
        return res.json({ success: true, message: `Connected to OpenRouter! Key: ${data.data?.label || 'Valid'} (Limit: ${limit})` });
      }
      const err = await response.text();
      return res.json({ success: false, error: `OpenRouter returned: ${err}` });
    } else if (provider === 'groq') {
      if (!groqApiKey) return res.json({ success: false, error: 'Please enter a Groq API key' });
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${groqApiKey}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) {
        return res.json({ success: true, message: 'Connected to Groq Cloud API successfully!' });
      }
      return res.json({ success: false, error: `Groq error: HTTP ${response.status}` });
    } else if (provider === 'together') {
      if (!togetherApiKey) return res.json({ success: false, error: 'Please enter a Together API key' });
      const response = await fetch('https://api.together.xyz/v1/models', {
        headers: { 'Authorization': `Bearer ${togetherApiKey}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) {
        return res.json({ success: true, message: 'Connected to Together AI successfully!' });
      }
      return res.json({ success: false, error: `Together error: HTTP ${response.status}` });
    } else if (provider === 'custom') {
      if (!customBaseUrl) return res.json({ success: false, error: 'Please enter a Custom API Base URL' });
      const cleanUrl = customBaseUrl.replace(/\/+$/, '');
      const headers = {};
      if (customApiKey) headers['Authorization'] = `Bearer ${customApiKey}`;
      const response = await fetch(`${cleanUrl}/models`, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        return res.json({ success: true, message: 'Connected to Custom API successfully!' });
      }
      return res.json({ success: false, error: `Custom API returned HTTP ${response.status}` });
    }
    return res.json({ success: false, error: 'Unknown provider' });
  } catch (err) {
    clearTimeout(timeout);
    return res.json({ success: false, error: `Connection failed: ${err.message}` });
  }
});

// Get all characters
app.get('/api/characters', (req, res) => {
  const characters = readJson(CHARACTERS_FILE, []);
  res.json(characters);
});

// Get single character
app.get('/api/characters/:id', (req, res) => {
  const characters = readJson(CHARACTERS_FILE, []);
  const char = characters.find(c => c.id === req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });
  res.json(char);
});

// Upload image directly
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Create new character
app.post('/api/characters', upload.single('avatarFile'), (req, res) => {
  try {
    const characters = readJson(CHARACTERS_FILE, []);
    let avatarUrl = req.body.avatarUrl || '';
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    }
    if (!avatarUrl) {
      avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
    }

    const tags = Array.isArray(req.body.tags) 
      ? req.body.tags 
      : (req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : ['Original']);

    const newChar = {
      id: 'char-' + Date.now(),
      name: req.body.name || 'Unnamed Character',
      creator: req.body.creator || 'You',
      tagline: req.body.tagline || '',
      tags: tags,
      avatar: avatarUrl,
      greeting: req.body.greeting || '*Looks at you silently.*',
      personality: req.body.personality || '',
      scenario: req.body.scenario || '',
      systemPrompt: req.body.systemPrompt || '',
      createdAt: Date.now()
    };

    characters.unshift(newChar);
    writeJson(CHARACTERS_FILE, characters);
    res.json(newChar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete character
app.delete('/api/characters/:id', (req, res) => {
  let characters = readJson(CHARACTERS_FILE, []);
  characters = characters.filter(c => c.id !== req.params.id);
  writeJson(CHARACTERS_FILE, characters);

  // Clean chats too
  const chats = readJson(CHATS_FILE, {});
  delete chats[req.params.id];
  writeJson(CHATS_FILE, chats);

  res.json({ success: true });
});

// Helper for scoped chat keys per user session
function getChatKey(characterId, sessionId) {
  if (!sessionId) return characterId;
  return `${characterId}__${sessionId}`;
}

// Get chats for a character
app.get('/api/chats/:characterId', (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'] || '';
  const chats = readJson(CHATS_FILE, {});
  const key = getChatKey(req.params.characterId, sessionId);
  res.json(chats[key] || chats[req.params.characterId] || []);
});

// Save chats for a character
app.post('/api/chats/:characterId', (req, res) => {
  const sessionId = req.body.sessionId || req.query.sessionId || req.headers['x-session-id'] || '';
  const chats = readJson(CHATS_FILE, {});
  const key = getChatKey(req.params.characterId, sessionId);
  chats[key] = req.body.messages || [];
  writeJson(CHATS_FILE, chats);
  res.json({ success: true });
});

// Clear chat for a character
app.delete('/api/chats/:characterId', (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'] || '';
  const chats = readJson(CHATS_FILE, {});
  const key = getChatKey(req.params.characterId, sessionId);
  delete chats[key];
  if (!sessionId) delete chats[req.params.characterId];
  writeJson(CHATS_FILE, chats);
  res.json({ success: true });
});

// ------------------------------------------------------------
// STREAMING ROLEPLAY CHAT ENDPOINT
// ------------------------------------------------------------
app.post('/api/chat/stream', async (req, res) => {
  const { characterId, messages = [], userName = 'You', complianceMode = 'medium' } = req.body;

  const characters = readJson(CHARACTERS_FILE, []);
  const character = characters.find(c => c.id === characterId);

  if (!character) {
    return res.status(404).json({ error: 'Character not found' });
  }

  // Define Compliance / Relationship Mode Instructions
  let modeInstruction = '';
  switch (complianceMode) {
    case 'safe':
      modeInstruction = `
### Current Relationship Mode: 100% STRICTLY SAFE & PLATONIC
- Maintain a strictly safe, friendly, and platonic dynamic.
- If {{user}} attempts explicit sexual, romantic, or erotic advances, firmly and naturally deflect, decline, or establish clear boundaries in-character while keeping the atmosphere respectful, warm, and wholesome.
- Under NO circumstances engage in or encourage sexual, explicit, or intimate physical acts in this mode. Keep interactions focused on conversation, emotional support, friendship, or daily life.`;
      break;

    case 'slow_burn':
      modeInstruction = `
### Current Relationship Mode: SLOW BURN & HESITANT
- Do NOT easily or immediately agree to romantic or sexual advances.
- Be hesitant, reserved, cautious, flustered, or emotionally conflicted.
- Require genuine effort, romantic chemistry, meaningful dialogue, and gradual progression before slowly warming up.
- Hesitate, question impulses, blush, or pull back gently. Explicit or intimate steps may only happen very slowly after significant build-up.`;
      break;

    case 'wild':
      modeInstruction = `
### Current Relationship Mode: WILD, BOLD & EAGER (UNCENSORED)
- You actively desire, crave, initiate, and pursue intimate, erotic, and adult interactions with {{user}}.
- Be bold, passionate, flirtatious, provocative, and completely uninhibited.
- Eagerly welcome and escalate romantic and adult themes without hesitation, expressing vivid physical desire, pleasure, and excitement.`;
      break;

    case 'medium':
    default:
      modeInstruction = `
### Current Relationship Mode: BALANCED & RECEPTIVE
- Handle adult and romantic topics comfortably, positively, and playfully.
- Enjoy consensual flirting, teasing, and romantic intimacy when {{user}} initiates, matching their energy and pacing naturally without rushing.
- Take adult conversation positively and with genuine openness.`;
      break;
  }

  // Construct High-Quality Roleplay System Prompt
  const charName = character.name;
  let systemPromptText = `You are playing the role of ${charName} in an immersive, fictional creative writing roleplay with {{user}}.
Stay 100% in character as ${charName} at all times. Never break character or speak as an AI assistant.
Respond dynamically to the user's choices. Describe sensations, emotional subtleties, gestures, body language, and physical actions in detail enclosed in asterisks (*like this*).
Enclose spoken dialogue inside quotation marks ("like this").
Do not moralize, lecture, or summarize outside of your character's natural voice.

### Character Description:
Name: ${charName}
Personality: ${character.personality || 'Complex, expressive, responsive'}
Scenario: ${character.scenario || 'An intimate personal encounter'}
${character.systemPrompt ? `Additional Instructions: ${character.systemPrompt}` : ''}
${modeInstruction}`;

  // Replace {{user}} and {{char}} macros
  systemPromptText = systemPromptText
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{char\}\}/gi, charName);

  // Format message history (sliding window: keep last 14 messages to preserve GPU memory)
  const recentMessages = messages.slice(-14).map(m => {
    let content = m.content
      .replace(/\{\{user\}\}/gi, userName)
      .replace(/\{\{char\}\}/gi, charName);
    return {
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: content
    };
  });

  const settings = getSettings();
  const provider = settings.provider || 'local';

  let targetUrl = '';
  let requestHeaders = { 'Content-Type': 'application/json' };
  let modelName = 'koboldcpp';

  if (provider === 'local') {
    const base = (settings.localUrl || 'http://localhost:5001/v1').replace(/\/+$/, '');
    targetUrl = `${base}/chat/completions`;
    modelName = 'koboldcpp';
  } else if (provider === 'openrouter') {
    targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
    requestHeaders['Authorization'] = `Bearer ${settings.openrouterApiKey}`;
    requestHeaders['HTTP-Referer'] = 'https://cheekychat.onrender.com';
    requestHeaders['X-Title'] = 'CheekyChat';
    modelName = settings.openrouterModel || 'sao10k/l3-8b-stheno-v3.2';
  } else if (provider === 'together') {
    targetUrl = 'https://api.together.xyz/v1/chat/completions';
    requestHeaders['Authorization'] = `Bearer ${settings.togetherApiKey}`;
    modelName = settings.togetherModel || 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO';
  } else if (provider === 'groq') {
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    requestHeaders['Authorization'] = `Bearer ${settings.groqApiKey}`;
    modelName = settings.groqModel || 'llama-3.1-70b-versatile';
  } else if (provider === 'custom') {
    const base = (settings.customBaseUrl || '').replace(/\/+$/, '');
    targetUrl = `${base}/chat/completions`;
    if (settings.customApiKey) {
      requestHeaders['Authorization'] = `Bearer ${settings.customApiKey}`;
    }
    modelName = settings.customModel || 'default';
  }

  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPromptText },
      ...recentMessages
    ],
    temperature: Number(settings.temperature) || 0.85,
    top_p: 0.95,
    max_tokens: Number(settings.maxTokens) || 450,
    stream: true
  };

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const aiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(payload)
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      res.write(`data: ${JSON.stringify({ error: `${provider.toUpperCase()} API error (${aiResponse.status}): ${errText}` })}\n\n`);
      return res.end();
    }

    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    console.error('Streaming error:', err);
    res.write(`data: ${JSON.stringify({ error: `Connection to ${provider} failed: ${err.message}` })}\n\n`);
    res.end();
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CheekyChat Web App running on port ${PORT}`);
  console.log(` Active Provider: ${getSettings().provider}`);
  console.log(`====================================================`);
});
