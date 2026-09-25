/* ============================================================
   ai-chat.js — Floating chat button + AI assistant, injected on
   every page (imported from nav.js). Talks directly to Groq or
   Gemini from the browser using the API key you enter in
   Settings — there is no backend server relaying this.

   Model names for both providers change often; the exact model
   string is a free-text Settings field rather than hardcoded,
   so a deprecated model never silently breaks the assistant.
   ============================================================ */
import { getAIConfig, isAIConfigured, getChatHistory, addChatMessage, clearChatHistory } from './db.js';
import { icon } from './icons.js';
import { TOOL_DEFS, executeTool } from './ai-tools.js';

const SYSTEM_PROMPT =
  'You are the assistant built into Money follow, a personal finance app for a student. ' +
  'Use the provided tools to answer questions about their spending, add expenses/income they ' +
  'mention, or manage Vault goals and Khata entries when asked. Always confirm what you did in ' +
  'plain, short sentences. Amounts are in Indian Rupees (₹). Never invent numbers — use the tools.';

/* ---------------- Floating button + panel injection ---------------- */

function injectUI() {
  if (document.getElementById('mf-ai-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'mf-ai-fab';
  fab.setAttribute('aria-label', 'Open AI assistant');
  fab.innerHTML = icon('sparkle', 24);
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'mf-ai-panel';
  panel.className = 'hidden';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="mf-ai-header">
      <div class="flex items-center gap-2">
        <span class="text-crimson">${icon('sparkle', 18)}</span>
        <p class="font-black text-[14px]">Money follow Assistant</p>
      </div>
      <div class="flex items-center gap-1">
        <button id="mf-ai-clear" class="w-8 h-8 rounded-full flex items-center justify-center text-sage" aria-label="Clear chat">${icon('trash', 15)}</button>
        <button id="mf-ai-close" class="w-8 h-8 rounded-full flex items-center justify-center" aria-label="Close">${icon('close', 16)}</button>
      </div>
    </div>
    <div id="mf-ai-messages" class="mf-ai-messages"></div>
    <div id="mf-ai-setup" class="hidden mf-ai-setup">
      <p class="text-[12px] font-bold text-sage mb-3">Add a Groq or Gemini API key in Settings to start chatting.</p>
      <a href="settings.html" class="inline-block py-2.5 px-4 rounded-2xl bg-charcoal text-white font-black text-[12px]">Go to Settings</a>
    </div>
    <div id="mf-ai-inputrow" class="mf-ai-inputrow">
      <input id="mf-ai-input" type="text" placeholder="Ask about your money…" autocomplete="off" />
      <button id="mf-ai-send" aria-label="Send">${icon('send', 17)}</button>
    </div>
  `;
  document.body.appendChild(panel);

  fab.addEventListener('click', () => openPanel());
  document.getElementById('mf-ai-close').addEventListener('click', () => { panel.classList.add('hidden'); panel.hidden = true; });
  document.getElementById('mf-ai-clear').addEventListener('click', async () => {
    await clearChatHistory();
    renderMessages([]);
  });
  document.getElementById('mf-ai-send').addEventListener('click', sendMessage);
  document.getElementById('mf-ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

async function openPanel() {
  const panel = document.getElementById('mf-ai-panel');
  panel.classList.remove('hidden');
  panel.hidden = false;
  const configured = isAIConfigured();
  document.getElementById('mf-ai-setup').classList.toggle('hidden', configured);
  document.getElementById('mf-ai-inputrow').classList.toggle('hidden', !configured);
  if (configured) {
    const history = await getChatHistory();
    renderMessages(history);
  }
}

function renderMessages(history) {
  const el = document.getElementById('mf-ai-messages');
  if (history.length === 0) {
    el.innerHTML = `<div class="mf-ai-empty"><p>Ask me things like "how much did I spend on food this month?" or "add ₹50 mess expense".</p></div>`;
    return;
  }
  el.innerHTML = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `<div class="mf-ai-bubble mf-ai-${m.role}">${escapeHtml(m.content)}</div>`)
    .join('');
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function appendBubble(role, text) {
  const el = document.getElementById('mf-ai-messages');
  const empty = el.querySelector('.mf-ai-empty');
  if (empty) empty.remove();
  const bubble = document.createElement('div');
  bubble.className = `mf-ai-bubble mf-ai-${role}`;
  bubble.textContent = text;
  el.appendChild(bubble);
  el.scrollTop = el.scrollHeight;
  return bubble;
}

/* ---------------- Send flow ---------------- */

let sending = false;

async function sendMessage() {
  if (sending) return;
  const input = document.getElementById('mf-ai-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sending = true;

  appendBubble('user', text);
  await addChatMessage('user', text);
  const thinkingBubble = appendBubble('assistant', '…');

  try {
    const history = await getChatHistory();
    const config = getAIConfig();
    const reply = await runAssistant(config, history);
    thinkingBubble.textContent = reply;
    await addChatMessage('assistant', reply);
  } catch (err) {
    thinkingBubble.textContent = `Something went wrong: ${err.message}`;
  } finally {
    sending = false;
  }
}

async function runAssistant(config, history) {
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  if (config.provider === 'gemini') {
    return runGemini(config, messages);
  }
  return runGroq(config, messages);
}

/* ---------------- Groq (OpenAI-compatible tool calling) ---------------- */

async function runGroq(config, messages) {
  const model = config.model || 'openai/gpt-oss-120b';
  const tools = TOOL_DEFS.map((t) => ({ type: 'function', function: t }));
  const convo = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  for (let round = 0; round < 4; round++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model, messages: convo, tools, tool_choice: 'auto' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const msg = data.choices[0].message;
    convo.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const call of msg.tool_calls) {
        const args = JSON.parse(call.function.arguments || '{}');
        const result = await executeTool(call.function.name, args);
        convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue; // loop again so the model can respond using the tool results
    }
    return msg.content || '(no response)';
  }
  return 'I ran out of steps handling that — try rephrasing your request.';
}

/* ---------------- Gemini (functionDeclarations tool calling) ---------------- */

function jsonSchemaToGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { ...schema };
  if (out.type) out.type = String(out.type).toUpperCase();
  if (out.properties) {
    const props = {};
    Object.entries(out.properties).forEach(([k, v]) => (props[k] = jsonSchemaToGemini(v)));
    out.properties = props;
  }
  return out;
}

async function runGemini(config, messages) {
  const model = config.model || 'gemini-3.8-flash';
  const functionDeclarations = TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: jsonSchemaToGemini(t.parameters),
  }));

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  for (let round = 0; round < 4; round++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: [{ functionDeclarations }],
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const candidate = data.candidates && data.candidates[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];
    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    if (functionCalls.length > 0) {
      contents.push({ role: 'model', parts });
      const responseParts = [];
      for (const call of functionCalls) {
        const result = await executeTool(call.name, call.args || {});
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: 'function', parts: responseParts });
      continue;
    }

    const textPart = parts.find((p) => p.text);
    return (textPart && textPart.text) || '(no response)';
  }
  return 'I ran out of steps handling that — try rephrasing your request.';
}

/* ---------------- Boot ---------------- */

injectUI();
