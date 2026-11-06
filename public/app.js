// CheekyChat Frontend Application
const app = {
  characters: [],
  activeCharacter: null,
  activeMessages: [],
  selectedTag: 'all',
  currentStreamController: null,
  isStreaming: false,
  recentChats: [],
  currentMode: localStorage.getItem('cheeky_compliance_mode') || 'medium',
  editingIndex: null,
  activeSettingsTab: 'local',
  sessionId: localStorage.getItem('cheeky_session_id') || ('sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36)),

  // Mode Definitions
  modes: {
    safe: {
      id: 'safe',
      icon: '🛡️',
      name: 'Full Safe',
      badge: 'Platonic',
      color: 'text-emerald-400'
    },
    slow_burn: {
      id: 'slow_burn',
      icon: '⏳',
      name: 'Slow Burn',
      badge: 'Hesitant',
      color: 'text-amber-400'
    },
    medium: {
      id: 'medium',
      icon: '🔥',
      name: 'Medium',
      badge: 'Receptive',
      color: 'text-pink-400'
    },
    wild: {
      id: 'wild',
      icon: '💋',
      name: 'Wild & Eager',
      badge: 'Uninhibited',
      color: 'text-purple-400'
    }
  },

  // Initialize
  async init() {
    try {
      localStorage.setItem('cheeky_session_id', this.sessionId);
    } catch (_) {}
    this.checkStatus();
    setInterval(() => this.checkStatus(), 10000);
    this.updateModeUI();
    await this.loadCharacters();
    this.loadRecentChats();

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('mode-dropdown-menu');
      const btn = document.getElementById('btn-mode-dropdown');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && !btn?.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      }
    });

    if (window.lucide) lucide.createIcons();
  },

  // Mode UI Controls
  updateModeUI() {
    const mode = this.modes[this.currentMode] || this.modes.medium;
    const iconEl = document.getElementById('current-mode-icon');
    const labelEl = document.getElementById('current-mode-label');
    if (iconEl) iconEl.innerText = mode.icon;
    if (labelEl) {
      labelEl.innerText = mode.name;
      labelEl.className = `${mode.color} text-xs font-bold`;
    }
  },

  toggleModeDropdown() {
    const dropdown = document.getElementById('mode-dropdown-menu');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
    }
  },

  setComplianceMode(modeId) {
    if (!this.modes[modeId]) return;
    this.currentMode = modeId;
    try {
      localStorage.setItem('cheeky_compliance_mode', modeId);
    } catch (_) {}
    this.updateModeUI();
    const dropdown = document.getElementById('mode-dropdown-menu');
    if (dropdown) dropdown.classList.add('hidden');
  },

  // Check AI Engine Status (Local KoboldCpp or Cloud)
  async checkStatus() {
    const headerDot = document.getElementById('header-status-dot');
    const headerText = document.getElementById('header-status-text');
    const sidebarDot = document.getElementById('sidebar-status-dot');

    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.online) {
        if (headerDot) headerDot.className = 'w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
        if (headerText) headerText.innerText = data.label || 'AI Online';
        if (sidebarDot) sidebarDot.className = 'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]';
      } else {
        if (headerDot) headerDot.className = 'w-2 h-2 rounded-full bg-rose-400 animate-pulse';
        if (headerText) headerText.innerText = data.label || 'AI Offline';
        if (sidebarDot) sidebarDot.className = 'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse';
      }
    } catch (e) {
      if (headerDot) headerDot.className = 'w-2 h-2 rounded-full bg-rose-400 animate-pulse';
      if (headerText) headerText.innerText = 'AI Offline';
      if (sidebarDot) sidebarDot.className = 'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse';
    }
  },

  // Load all characters
  async loadCharacters() {
    try {
      const res = await fetch('/api/characters');
      this.characters = await res.json();
      this.renderCharacters();
      this.renderRecentChats();
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
  },

  // Filter & Search characters
  setTagFilter(tag) {
    this.selectedTag = tag;
    document.querySelectorAll('.category-btn').forEach(btn => {
      const text = btn.innerText.trim();
      if (text.toLowerCase().includes(tag.toLowerCase()) || (tag === 'all' && text === 'All')) {
        btn.className = 'category-btn active px-3.5 py-1.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-400 border border-pink-500/40';
      } else {
        btn.className = 'category-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:border-pink-500/40';
      }
    });
    this.renderCharacters();
  },

  filterCharacters() {
    this.renderCharacters();
  },

  // Render Character Cards Grid (Gallery)
  renderCharacters() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    const query = (document.getElementById('character-search')?.value || '').toLowerCase().trim();

    const filtered = (this.characters || []).filter(c => {
      const matchesTag = this.selectedTag === 'all' || (c.tags && c.tags.some(t => t.toLowerCase().includes(this.selectedTag.toLowerCase())));
      const matchesSearch = !query || 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (c.tagline && c.tagline.toLowerCase().includes(query)) || 
        (c.tags && c.tags.some(t => t.toLowerCase().includes(query)));
      return matchesTag && matchesSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-500 space-y-3">
          <i data-lucide="ghost" class="w-10 h-10 mx-auto text-slate-600"></i>
          <p class="text-sm">No characters found matching your filters.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    grid.innerHTML = filtered.map(c => `
      <div onclick="app.openChat('${c.id}')" class="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col h-[340px]">
        <!-- Avatar Header -->
        <div class="relative h-48 w-full overflow-hidden bg-slate-950">
          <img src="${c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}" alt="${c.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-[#121927] via-transparent to-black/30"></div>
          
          <!-- Badges -->
          <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
            ${(c.tags || []).slice(0, 2).map(tag => `
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-pink-300 border border-pink-500/20">
                ${tag}
              </span>
            `).join('')}
          </div>

          <!-- Quick Action -->
          <button class="absolute bottom-3 right-3 p-2 rounded-xl bg-pink-500 text-white shadow-lg opacity-0 group-hover:opacity-100 transition transform translate-y-2 group-hover:translate-y-0">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Details -->
        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-bold text-slate-100 text-base group-hover:text-pink-400 transition mb-1">
              ${c.name}
            </h3>
            <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              ${c.tagline || c.personality || 'No description available.'}
            </p>
          </div>

          <div class="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60">
            <span class="flex items-center gap-1 text-pink-400 font-medium">
              <i data-lucide="flame" class="w-3.5 h-3.5 fill-pink-400"></i> Uncensored
            </span>
            <span class="hover:text-rose-400 p-1" onclick="event.stopPropagation(); app.deleteCharacter('${c.id}')" title="Delete character">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </span>
          </div>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  // Open Chat Room with Character
  async openChat(charId) {
    const character = this.characters.find(c => c.id === charId);
    if (!character) return;

    this.activeCharacter = character;
    this.editingIndex = null;

    // Switch view
    const viewGallery = document.getElementById('view-gallery');
    const viewChat = document.getElementById('view-chat');
    if (viewGallery) viewGallery.classList.add('hidden');
    if (viewChat) viewChat.classList.remove('hidden');

    // Populate Top Header
    const headerAvatar = document.getElementById('chat-header-avatar');
    if (headerAvatar) headerAvatar.src = character.avatar || '';
    const headerName = document.getElementById('chat-header-name');
    if (headerName) headerName.innerText = character.name || '';
    const headerTagline = document.getElementById('chat-header-tagline');
    if (headerTagline) headerTagline.innerText = character.tagline || '';

    // Populate Left Character Details Panel ("Ch", "creator name", "Ch. Detail")
    const sideAvatar = document.getElementById('side-char-avatar');
    if (sideAvatar) sideAvatar.src = character.avatar || '';
    const sideName = document.getElementById('side-char-name');
    if (sideName) sideName.innerText = character.name || '';
    const sideTagline = document.getElementById('side-char-tagline');
    if (sideTagline) sideTagline.innerText = character.tagline || '';

    // Creator name
    const sideCreator = document.getElementById('side-char-creator');
    if (sideCreator) sideCreator.innerText = character.creator || 'You';

    // Character Detail (Personality & Scenario)
    const sidePersonality = document.getElementById('side-char-personality');
    if (sidePersonality) sidePersonality.innerText = character.personality || 'Dominant yet flustered, caring, playful.';
    const sideScenario = document.getElementById('side-char-scenario');
    if (sideScenario) sideScenario.innerText = character.scenario || character.tagline || 'In a private room together.';

    // Tags badges
    const tagsContainer = document.getElementById('side-char-tags');
    if (tagsContainer) {
      tagsContainer.innerHTML = (character.tags || []).map(tag => 
        `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-pink-300 border border-pink-500/30">${tag}</span>`
      ).join('');
    }

    // Update Mode UI
    this.updateModeUI();

    // Record recent chat
    this.pushRecentChat(charId);

    // Load Chat History
    try {
      const res = await fetch(`/api/chats/${charId}?sessionId=${encodeURIComponent(this.sessionId)}`);
      const history = await res.json();

      if (!history || history.length === 0) {
        // Start with character greeting
        this.activeMessages = [
          { role: 'assistant', content: character.greeting || '*Looks at you expectantly.*' }
        ];
        this.saveChatHistory();
      } else {
        this.activeMessages = history;
      }
      this.renderChatMessages();
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }

    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
      this.scrollToBottom();
    }, 100);
  },

  showGallery() {
    const viewChat = document.getElementById('view-chat');
    const viewGallery = document.getElementById('view-gallery');
    if (viewChat) viewChat.classList.add('hidden');
    if (viewGallery) viewGallery.classList.remove('hidden');
    this.renderRecentChats();
  },

  toggleSidePanel() {
    const panel = document.getElementById('chat-character-panel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  },

  // Recent chats handling
  renderRecentChats() {
    const container = document.getElementById('sidebar-recent-chats');
    if (!container) return;
    container.innerHTML = this.recentChats.map(rc => {
      const char = this.characters.find(c => c.id === rc.id);
      if (!char) return '';
      const isActive = this.activeCharacter?.id === char.id;
      return `
        <button onclick="app.openChat('${char.id}')" class="w-10 h-10 rounded-xl overflow-hidden border ${isActive ? 'border-pink-500 ring-2 ring-pink-500/40' : 'border-slate-800 hover:border-pink-500/50'} transition flex-shrink-0 group relative" title="${char.name}">
          <img src="${char.avatar || ''}" alt="${char.name}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300">
        </button>
      `;
    }).join('');
  },

  pushRecentChat(charId) {
    this.recentChats = this.recentChats.filter(c => c.id !== charId);
    this.recentChats.unshift({ id: charId, ts: Date.now() });
    if (this.recentChats.length > 10) this.recentChats.pop();
    try {
      localStorage.setItem('cheeky_recent_chats', JSON.stringify(this.recentChats));
    } catch (_) {}
    this.renderRecentChats();
  },

  loadRecentChats() {
    try {
      const data = localStorage.getItem('cheeky_recent_chats');
      if (data) {
        this.recentChats = JSON.parse(data);
      }
    } catch (_) {
      this.recentChats = [];
    }
    this.renderRecentChats();
  },

  // ------------------------------------------------------------
  // MESSAGE EDITING
  // ------------------------------------------------------------
  startEditMessage(index) {
    this.editingIndex = index;
    this.renderChatMessages();
    setTimeout(() => {
      const input = document.getElementById(`edit-msg-input-${index}`);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 50);
  },

  cancelEditMessage() {
    this.editingIndex = null;
    this.renderChatMessages();
  },

  saveEditedMessage(index) {
    const input = document.getElementById(`edit-msg-input-${index}`);
    if (!input) return;
    const newContent = input.value.trim();
    if (!newContent) return;

    this.activeMessages[index].content = newContent;
    this.editingIndex = null;
    this.saveChatHistory();
    this.renderChatMessages();
  },

  async saveEditedMessageAndReroll(index) {
    const input = document.getElementById(`edit-msg-input-${index}`);
    if (!input) return;
    const newContent = input.value.trim();
    if (!newContent) return;

    // Update user message and trim all subsequent messages
    this.activeMessages[index].content = newContent;
    this.activeMessages = this.activeMessages.slice(0, index + 1);
    this.editingIndex = null;
    this.saveChatHistory();
    this.renderChatMessages();

    // Trigger regeneration of assistant reply
    await this.triggerAssistantGeneration();
  },

  // Render chat messages with Edit Option
  renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = this.activeMessages.map((msg, index) => {
      const isAssistant = msg.role === 'assistant';
      const isEditing = this.editingIndex === index;

      return `
        <div class="flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'} group">
          ${isAssistant ? `
            <img src="${this.activeCharacter?.avatar || ''}" class="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-pink-500/30 self-end mb-1 shadow-sm">
          ` : ''}

          <div class="max-w-[85%] sm:max-w-[75%] space-y-1">
            <div class="flex items-center gap-2 ${isAssistant ? '' : 'justify-end'} text-[11px] text-slate-500">
              <span class="font-semibold ${isAssistant ? 'text-pink-400' : 'text-purple-300'}">
                ${isAssistant ? (this.activeCharacter?.name || 'Character') : (document.getElementById('user-persona-name')?.value || 'You')}
              </span>
            </div>

            <!-- Bubble Content or Edit Mode -->
            <div class="chat-bubble ${isAssistant ? 'assistant' : 'user'}">
              ${isEditing ? `
                <div class="space-y-2 w-full min-w-[280px] sm:min-w-[400px]">
                  <textarea id="edit-msg-input-${index}" class="w-full bg-slate-900/90 border border-pink-500/60 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-y min-h-[90px] leading-relaxed">${this.escapeHtml(msg.content)}</textarea>
                  <div class="flex items-center justify-end gap-2 text-xs pt-1">
                    <button onclick="app.cancelEditMessage()" class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                    <button onclick="app.saveEditedMessage(${index})" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium hover:brightness-110 transition shadow">Save</button>
                    ${!isAssistant ? `
                      <button onclick="app.saveEditedMessageAndReroll(${index})" class="px-3 py-1.5 rounded-lg bg-pink-600 text-white font-medium hover:bg-pink-500 transition shadow flex items-center gap-1.5">
                        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Save &amp; Regenerate
                      </button>
                    ` : ''}
                  </div>
                </div>
              ` : `
                <div class="formatted-message">${this.formatRoleplayText(msg.content)}</div>
              `}
            </div>

            <!-- Message Action Toolbar (Edit, Copy, Reroll, Delete) -->
            ${!isEditing ? `
              <div class="flex items-center gap-2 ${isAssistant ? 'justify-start' : 'justify-end'} opacity-0 group-hover:opacity-100 transition text-[11px] text-slate-500 px-1">
                <!-- Edit Message -->
                <button onclick="app.startEditMessage(${index})" class="hover:text-pink-400 flex items-center gap-1" title="Edit message">
                  <i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit
                </button>
                <!-- Copy Text -->
                <button onclick="app.copyMessage('${encodeURIComponent(msg.content || '')}')" class="hover:text-slate-300 flex items-center gap-1" title="Copy text">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
                <!-- Reroll if last assistant message -->
                ${isAssistant && index === this.activeMessages.length - 1 ? `
                  <button onclick="app.rerollResponse()" class="hover:text-pink-400 flex items-center gap-1" title="Regenerate response">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Reroll
                  </button>
                ` : ''}
                <!-- Delete Message -->
                <button onclick="app.deleteMessage(${index})" class="hover:text-rose-400" title="Delete message">
                  <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
    this.scrollToBottom();
  },

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Format Text for Immersive Roleplay (Token placeholder isolation prevents regex collision)
  formatRoleplayText(text) {
    if (!text) return '';

    // 1. Escape basic HTML first
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Extract *actions* safely into placeholders without HTML quotes
    const actions = [];
    safe = safe.replace(/\*([^*]+)\*/g, (_, p1) => {
      actions.push(p1);
      return `@@@RPACTION_${actions.length - 1}@@@`;
    });

    // 3. Extract "dialogue" safely into placeholders without HTML quotes
    const dialogues = [];
    safe = safe.replace(/"([^"]+)"/g, (_, p1) => {
      dialogues.push(p1);
      return `@@@RPDIALOGUE_${dialogues.length - 1}@@@`;
    });
    safe = safe.replace(/&quot;([^&]+)&quot;/g, (_, p1) => {
      dialogues.push(p1);
      return `@@@RPDIALOGUE_${dialogues.length - 1}@@@`;
    });

    // 4. Handle line breaks
    safe = safe.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

    // 5. Restore placeholders with clean HTML tags
    safe = safe.replace(/@@@RPACTION_(\d+)@@@/g, (_, i) => {
      return `<span class="rp-action font-serif italic text-purple-300">${actions[parseInt(i, 10)]}</span>`;
    });
    safe = safe.replace(/@@@RPDIALOGUE_(\d+)@@@/g, (_, i) => {
      return `<span class="rp-dialogue text-slate-100 font-medium">"${dialogues[parseInt(i, 10)]}"</span>`;
    });

    return safe;
  },

  // Send Message & Fast Line-by-Line Stream
  async sendMessage() {
    if (this.isStreaming) return;
    const input = document.getElementById('chat-input');
    const userText = input ? input.value.trim() : '';
    if (!userText) return;

    if (input) {
      input.value = '';
      this.autoResizeTextarea(input);
    }

    // 1. Add user message
    this.activeMessages.push({ role: 'user', content: userText });
    this.saveChatHistory();

    // 2. Trigger generation
    await this.triggerAssistantGeneration();
  },

  // Common Assistant Generation Trigger with Mode & Line-by-Line Stream
  async triggerAssistantGeneration() {
    if (this.isStreaming) return;

    const botMsgIndex = this.activeMessages.length;
    this.activeMessages.push({ role: 'assistant', content: '' });
    this.renderChatMessages();

    // Setup streaming UI
    this.isStreaming = true;
    document.getElementById('btn-stop-stream')?.classList.remove('hidden');
    const sendBtn = document.getElementById('btn-send');
    if (sendBtn) sendBtn.disabled = true;

    const messageElements = document.querySelectorAll('#chat-messages .formatted-message');
    const targetElement = messageElements[messageElements.length - 1];
    if (targetElement) targetElement.classList.add('streaming-cursor');

    this.currentStreamController = new AbortController();
    const userName = document.getElementById('user-persona-name')?.value || 'You';

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.currentStreamController.signal,
        body: JSON.stringify({
          characterId: this.activeCharacter.id,
          messages: this.activeMessages.slice(0, -1),
          userName: userName,
          complianceMode: this.currentMode || 'medium',
          sessionId: this.sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Connection to AI model failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let streamBuffer = '';
      let lastFlush = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) throw new Error(parsed.error);
            const token = parsed.choices?.[0]?.delta?.content || '';
            streamBuffer += token;

            // Line-by-line / quick-burst chunk flushing
            const now = Date.now();
            const hasNewline = streamBuffer.includes('\n');
            const hasSentenceBreak = /[.!?]\s$/.test(streamBuffer);
            const isBufferLong = streamBuffer.length >= 35;
            const isTimeElapsed = now - lastFlush >= 70 && streamBuffer.length >= 10;

            if (hasNewline || hasSentenceBreak || isBufferLong || isTimeElapsed) {
              accumulatedText += streamBuffer;
              streamBuffer = '';
              lastFlush = now;
              this.activeMessages[botMsgIndex].content = accumulatedText;
              if (targetElement) targetElement.innerHTML = this.formatRoleplayText(accumulatedText);
              this.scrollToBottom();
            }
          } catch (e) {
            // Partial chunk
          }
        }
      }

      // Flush remaining buffer
      if (streamBuffer) {
        accumulatedText += streamBuffer;
        this.activeMessages[botMsgIndex].content = accumulatedText;
        if (targetElement) targetElement.innerHTML = this.formatRoleplayText(accumulatedText);
        this.scrollToBottom();
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Stream error:', err);
        this.activeMessages[botMsgIndex].content = `*Error: ${err.message}*`;
        if (targetElement) targetElement.innerHTML = this.formatRoleplayText(this.activeMessages[botMsgIndex].content);
      }
    } finally {
      if (targetElement) targetElement.classList.remove('streaming-cursor');
      this.isStreaming = false;
      document.getElementById('btn-stop-stream')?.classList.add('hidden');
      if (sendBtn) sendBtn.disabled = false;
      this.saveChatHistory();
      this.renderChatMessages();
    }
  },

  // Stop generation early
  stopStreaming() {
    if (this.currentStreamController) {
      this.currentStreamController.abort();
    }
  },

  // Reroll / Regenerate last message
  async rerollResponse() {
    if (this.isStreaming || this.activeMessages.length < 2) return;
    if (this.activeMessages[this.activeMessages.length - 1].role === 'assistant') {
      this.activeMessages.pop();
      this.saveChatHistory();
      this.renderChatMessages();
      await this.triggerAssistantGeneration();
    }
  },

  // Delete message
  deleteMessage(index) {
    this.activeMessages.splice(index, 1);
    this.saveChatHistory();
    this.renderChatMessages();
  },

  // Copy message
  copyMessage(encoded) {
    const text = decodeURIComponent(encoded);
    navigator.clipboard.writeText(text);
  },

  // Restart chat
  async restartChat() {
    if (!confirm('Restart conversation with this character? All current messages will be cleared.')) return;
    this.activeMessages = [
      { role: 'assistant', content: this.activeCharacter.greeting || '*Looks at you silently.*' }
    ];
    await fetch(`/api/chats/${this.activeCharacter.id}?sessionId=${encodeURIComponent(this.sessionId)}`, { method: 'DELETE' });
    this.saveChatHistory();
    this.renderChatMessages();
  },

  // Save chat history
  async saveChatHistory() {
    if (!this.activeCharacter) return;
    try {
      await fetch(`/api/chats/${this.activeCharacter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: this.activeMessages,
          sessionId: this.sessionId
        })
      });
    } catch (e) {
      console.error('Failed to save chat:', e);
    }
  },

  // Delete Character
  async deleteCharacter(charId) {
    if (!confirm('Are you sure you want to delete this character?')) return;
    try {
      await fetch(`/api/characters/${charId}`, { method: 'DELETE' });
      await this.loadCharacters();
    } catch (e) {
      alert('Failed to delete character');
    }
  },

  // Character Studio: Modal Controls
  openCreateCharacterModal() {
    document.getElementById('modal-create-char')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeCreateCharacterModal() {
    document.getElementById('modal-create-char')?.classList.add('hidden');
    document.getElementById('form-create-character')?.reset();
    const avatarPreview = document.getElementById('avatar-preview');
    if (avatarPreview) {
      avatarPreview.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
    }
  },

  handleAvatarFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  },

  handleAvatarUrlInput(url) {
    if (url && url.trim().startsWith('http')) {
      const preview = document.getElementById('avatar-preview');
      if (preview) preview.src = url.trim();
    }
  },

  async handleCreateCharacter(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-create-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Creating...';
    }

    const formData = new FormData();
    const fileInput = document.getElementById('char-avatar-file');
    if (fileInput?.files[0]) {
      formData.append('avatarFile', fileInput.files[0]);
    }
    formData.append('avatarUrl', document.getElementById('char-avatar-url')?.value || '');
    formData.append('name', document.getElementById('char-name')?.value || '');
    formData.append('creator', document.getElementById('char-creator')?.value || 'You');
    formData.append('tagline', document.getElementById('char-tagline')?.value || '');
    formData.append('tags', document.getElementById('char-tags')?.value || '');
    formData.append('greeting', document.getElementById('char-greeting')?.value || '');
    formData.append('personality', document.getElementById('char-personality')?.value || '');
    formData.append('scenario', document.getElementById('char-scenario')?.value || '');

    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to create character');
      const newChar = await res.json();
      this.closeCreateCharacterModal();
      await this.loadCharacters();
      this.openChat(newChar.id);
    } catch (err) {
      alert('Error creating character: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Create Character';
      }
    }
  },

  // ------------------------------------------------------------
  // AI ENGINE SETTINGS (LOCAL & CLOUD)
  // ------------------------------------------------------------
  async openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;

    // Reset test banner
    const statusBanner = document.getElementById('settings-test-status');
    if (statusBanner) statusBanner.classList.add('hidden');

    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();

      // Populate local
      const localUrlInput = document.getElementById('setting-local-url');
      if (localUrlInput) localUrlInput.value = settings.localUrl || 'http://localhost:5001/v1';

      // Populate cloud provider dropdown
      const providerSelect = document.getElementById('setting-cloud-provider');
      if (providerSelect) {
        providerSelect.value = settings.provider === 'local' ? 'openrouter' : (settings.provider || 'openrouter');
      }

      // OpenRouter
      const orKey = document.getElementById('setting-openrouter-key');
      if (orKey) orKey.value = settings.openrouterApiKey || '';
      const orModel = document.getElementById('setting-openrouter-model');
      if (orModel) orModel.value = settings.openrouterModel || 'sao10k/l3-8b-stheno-v3.2';
      const orPreset = document.getElementById('setting-openrouter-model-preset');
      if (orPreset) {
        const knownPresets = [
          'sao10k/l3-8b-stheno-v3.2',
          'gryphe/mythomax-l2-13b',
          'sao10k/l3-euryale-70b',
          'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
          'meta-llama/llama-3.1-8b-instruct:free'
        ];
        orPreset.value = knownPresets.includes(settings.openrouterModel) ? settings.openrouterModel : 'custom';
      }

      // Groq
      const groqKey = document.getElementById('setting-groq-key');
      if (groqKey) groqKey.value = settings.groqApiKey || '';
      const groqModel = document.getElementById('setting-groq-model');
      if (groqModel) groqModel.value = settings.groqModel || 'llama-3.1-70b-versatile';

      // Together
      const togKey = document.getElementById('setting-together-key');
      if (togKey) togKey.value = settings.togetherApiKey || '';
      const togModel = document.getElementById('setting-together-model');
      if (togModel) togModel.value = settings.togetherModel || 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO';

      // Custom
      const custUrl = document.getElementById('setting-custom-url');
      if (custUrl) custUrl.value = settings.customBaseUrl || '';
      const custKey = document.getElementById('setting-custom-key');
      if (custKey) custKey.value = settings.customApiKey || '';
      const custModel = document.getElementById('setting-custom-model');
      if (custModel) custModel.value = settings.customModel || '';

      // Activate corresponding tab
      this.selectSettingsProviderTab(settings.provider === 'local' ? 'local' : 'cloud');
      this.handleCloudProviderChange(providerSelect ? providerSelect.value : 'openrouter');

    } catch (e) {
      console.error('Failed to load settings:', e);
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (modal) modal.classList.add('hidden');
  },

  selectSettingsProviderTab(tab) {
    this.activeSettingsTab = tab;
    const tabLocal = document.getElementById('tab-provider-local');
    const tabCloud = document.getElementById('tab-provider-cloud');
    const panelLocal = document.getElementById('panel-settings-local');
    const panelCloud = document.getElementById('panel-settings-cloud');

    if (tab === 'local') {
      if (tabLocal) tabLocal.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow';
      if (tabCloud) tabCloud.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 text-slate-400 hover:text-white';
      if (panelLocal) panelLocal.classList.remove('hidden');
      if (panelCloud) panelCloud.classList.add('hidden');
    } else {
      if (tabCloud) tabCloud.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow';
      if (tabLocal) tabLocal.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 text-slate-400 hover:text-white';
      if (panelLocal) panelLocal.classList.add('hidden');
      if (panelCloud) panelCloud.classList.remove('hidden');
    }
    if (window.lucide) lucide.createIcons();
  },

  handleCloudProviderChange(provider) {
    const sections = ['openrouter', 'groq', 'together', 'custom'];
    sections.forEach(p => {
      const el = document.getElementById(`cloud-section-${p}`);
      if (el) {
        if (p === provider) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });
    if (window.lucide) lucide.createIcons();
  },

  handleOpenRouterPresetChange(val) {
    const modelInput = document.getElementById('setting-openrouter-model');
    if (!modelInput) return;
    if (val !== 'custom') {
      modelInput.value = val;
    } else {
      modelInput.focus();
    }
  },

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  },

  async testSettingsConnection() {
    const btn = document.getElementById('btn-settings-test');
    const statusBanner = document.getElementById('settings-test-status');
    if (!statusBanner) return;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Testing...`;
    }
    if (window.lucide) lucide.createIcons();

    const provider = this.activeSettingsTab === 'local' 
      ? 'local' 
      : (document.getElementById('setting-cloud-provider')?.value || 'openrouter');

    const payload = {
      provider,
      localUrl: document.getElementById('setting-local-url')?.value,
      openrouterApiKey: document.getElementById('setting-openrouter-key')?.value,
      togetherApiKey: document.getElementById('setting-together-key')?.value,
      groqApiKey: document.getElementById('setting-groq-key')?.value,
      customBaseUrl: document.getElementById('setting-custom-url')?.value,
      customApiKey: document.getElementById('setting-custom-key')?.value
    };

    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      statusBanner.classList.remove('hidden');
      if (data.success) {
        statusBanner.className = 'p-3 rounded-xl text-xs font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center gap-2';
        statusBanner.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400 flex-shrink-0"></i> <span>${data.message}</span>`;
      } else {
        statusBanner.className = 'p-3 rounded-xl text-xs font-medium border border-rose-500/40 bg-rose-500/10 text-rose-300 flex items-center gap-2';
        statusBanner.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i> <span>${data.error}</span>`;
      }
    } catch (err) {
      statusBanner.classList.remove('hidden');
      statusBanner.className = 'p-3 rounded-xl text-xs font-medium border border-rose-500/40 bg-rose-500/10 text-rose-300 flex items-center gap-2';
      statusBanner.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i> <span>Test request failed: ${err.message}</span>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i> Test Connection`;
      }
      if (window.lucide) lucide.createIcons();
    }
  },

  async saveSettings() {
    const btn = document.getElementById('btn-settings-save');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Saving...';
    }

    const provider = this.activeSettingsTab === 'local' 
      ? 'local' 
      : (document.getElementById('setting-cloud-provider')?.value || 'openrouter');

    const payload = {
      provider,
      localUrl: document.getElementById('setting-local-url')?.value || 'http://localhost:5001/v1',
      openrouterApiKey: document.getElementById('setting-openrouter-key')?.value || '',
      openrouterModel: document.getElementById('setting-openrouter-model')?.value || 'sao10k/l3-8b-stheno-v3.2',
      groqApiKey: document.getElementById('setting-groq-key')?.value || '',
      groqModel: document.getElementById('setting-groq-model')?.value || 'llama-3.1-70b-versatile',
      togetherApiKey: document.getElementById('setting-together-key')?.value || '',
      togetherModel: document.getElementById('setting-together-model')?.value || 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
      customBaseUrl: document.getElementById('setting-custom-url')?.value || '',
      customApiKey: document.getElementById('setting-custom-key')?.value || '',
      customModel: document.getElementById('setting-custom-model')?.value || ''
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      await this.checkStatus();
      this.closeSettingsModal();
    } catch (e) {
      alert('Error saving settings: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Save & Apply';
      }
    }
  },

  // Helpers
  autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  },

  handleInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
};

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
