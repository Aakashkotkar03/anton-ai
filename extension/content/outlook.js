// extension/content/outlook.js — Outlook Web integration (PRD Feature 6)
// Same structure as gmail.js but with Outlook-specific ARIA/DOM selectors.
// Targets: outlook.live.com (personal) and outlook.office365.com (work/school).
//
// 🔒 Security:
//   - Only runs on outlook.live.com/* and outlook.office365.com/*
//   - Text processed locally via localhost WebSocket

(function () {
  'use strict';

  const INJECTED_ATTR = 'data-antonai-injected';

  // -------------------------------------------------------------------------
  // MutationObserver — watch for compose + email view elements
  // -------------------------------------------------------------------------
  const observer = new MutationObserver(() => {
    injectComposeButtons();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  setTimeout(injectComposeButtons, 3000);

  // -------------------------------------------------------------------------
  // Inject buttons into compose windows
  // -------------------------------------------------------------------------
  function injectComposeButtons() {
    // Outlook compose body: [role="textbox"] with aria-label containing "Message body"
    const composeBoxes = document.querySelectorAll(
      '[role="textbox"][aria-label*="Message body"], [role="textbox"][aria-label*="message body"]'
    );

    for (const box of composeBoxes) {
      const compose = box.closest('[class*="compose"], [role="dialog"]') || box.parentElement;
      if (!compose || compose.getAttribute(INJECTED_ATTR)) continue;
      compose.setAttribute(INJECTED_ATTR, 'true');

      // Find toolbar — Outlook's compose toolbar
      const toolbar = compose.querySelector(
        '[role="toolbar"], [class*="CommandBar"], [class*="toolbar"]'
      );

      // Create Anton AI button
      const btn = createAntonButton();
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showActionPanel(compose, box, btn);
      });

      if (toolbar) {
        toolbar.appendChild(btn);
      } else {
        // Fallback: place above the compose box
        box.parentElement.insertBefore(btn, box);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Button + Panel (same structure as Gmail — adapted visually)
  // -------------------------------------------------------------------------
  function createAntonButton() {
    const btn = document.createElement('div');
    btn.setAttribute('data-antonai', 'button');
    btn.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 50%;
      background: transparent; cursor: pointer; margin-left: 4px;
      transition: background 0.15s; position: relative;
    `;
    btn.title = 'Anton AI';

    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 12px; font-weight: 800; color: #2563EB;
      font-family: -apple-system, sans-serif;
    `;
    icon.textContent = 'A';
    btn.appendChild(icon);

    btn.addEventListener('mouseenter', () => { btn.style.background = '#F1F5F9'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });

    return btn;
  }

  function showActionPanel(compose, textbox, anchorBtn) {
    const existing = document.querySelector('[data-antonai="panel"]');
    if (existing) existing.remove();

    const rect = anchorBtn.getBoundingClientRect();

    const panel = document.createElement('div');
    panel.setAttribute('data-antonai', 'panel');
    panel.style.cssText = `
      position: fixed; z-index: 2147483647;
      background: white; border: 1px solid #E2E8F0; border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12); width: 300px; padding: 12px;
      top: ${rect.top - 280}px; left: ${rect.left - 130}px;
      font-family: -apple-system, 'Segoe UI', sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #F1F5F9;
    `;
    header.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:#334155;">Anton AI</span>
      <span data-antonai="close" style="cursor:pointer;color:#94A3B8;font-size:16px;">✕</span>
    `;
    header.querySelector('[data-antonai="close"]').addEventListener('click', () => panel.remove());
    panel.appendChild(header);

    const actions = [
      { id: 'reply',     label: 'Reply Drafts',     icon: '💬', desc: '3 tone options' },
      { id: 'fix',       label: 'Fix Email',        icon: '✨', desc: 'Grammar & clarity' },
      { id: 'expand',    label: 'Expand Bullets',   icon: '📝', desc: 'Bullets → full email' },
      { id: 'summarise', label: 'Summarise Thread', icon: '📋', desc: 'TL;DR + action items' },
      { id: 'subjects',  label: 'Subject Lines',    icon: '📧', desc: '3 subject options' },
      { id: 'translate', label: 'Translate',         icon: '🌐', desc: 'Auto-detect language' },
    ];

    for (const action of actions) {
      const row = document.createElement('button');
      row.style.cssText = `
        display:flex; align-items:center; gap:10px;
        width:100%; padding:8px 10px; border:none; background:#F8FAFC;
        border-radius:8px; cursor:pointer; margin-bottom:4px;
        text-align:left; transition: background 0.1s;
      `;
      row.innerHTML = `
        <span style="font-size:16px;">${action.icon}</span>
        <div>
          <div style="font-size:12px;font-weight:500;color:#334155;">${action.label}</div>
          <div style="font-size:10px;color:#94A3B8;">${action.desc}</div>
        </div>
      `;
      row.addEventListener('mouseenter', () => { row.style.background = '#EFF6FF'; });
      row.addEventListener('mouseleave', () => { row.style.background = '#F8FAFC'; });
      row.addEventListener('click', () => {
        panel.remove();
        handleOutlookAction(action.id, compose, textbox);
      });
      panel.appendChild(row);
    }

    setTimeout(() => {
      document.addEventListener('click', function closePanel(e) {
        if (!panel.contains(e.target) && e.target !== anchorBtn) {
          panel.remove();
          document.removeEventListener('click', closePanel);
        }
      });
    }, 100);

    document.body.appendChild(panel);
  }

  // -------------------------------------------------------------------------
  // Handle Outlook actions
  // -------------------------------------------------------------------------
  async function handleOutlookAction(actionId, compose, textbox) {
    const composeText = textbox.textContent || textbox.innerText || '';
    const subject = getSubject(compose);

    let payload;

    switch (actionId) {
      case 'reply': {
        const emailText = getThreadText();
        payload = { action: 'email:reply', payload: { emailText, subject } };
        break;
      }
      case 'fix':
        if (composeText.trim().length < 10) return;
        payload = { action: 'email:fix', payload: { emailText: composeText } };
        break;
      case 'expand':
        if (composeText.trim().length < 10) return;
        payload = { action: 'email:expand', payload: { bullets: composeText } };
        break;
      case 'summarise': {
        const threadText = getThreadText();
        if (threadText.trim().length < 20) return;
        payload = { action: 'email:summarise', payload: { threadText } };
        break;
      }
      case 'subjects': {
        const text = composeText || getThreadText();
        if (text.trim().length < 10) return;
        payload = { action: 'email:subjects', payload: { emailText: text } };
        break;
      }
      case 'translate':
        if (composeText.trim().length < 10) return;
        payload = { action: 'text:enhance', payload: { text: composeText, mode: 'translate' } };
        break;
      default:
        return;
    }

    const loadingEl = showLoading(compose);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'antonai:request',
        payload,
      });

      if (loadingEl) loadingEl.remove();

      if (!response.success) {
        showError(compose, response.error || 'Request failed');
        return;
      }

      // For simple replacements
      if (['fix', 'expand', 'translate'].includes(actionId)) {
        setComposeContent(textbox, response.result);
      } else if (actionId === 'reply') {
        showReplyCards(compose, textbox, response.result);
      } else if (actionId === 'summarise') {
        showResultPanel(compose, response.result);
      } else if (actionId === 'subjects') {
        showSubjectOptions(compose, response.result);
      }
    } catch (err) {
      if (loadingEl) loadingEl.remove();
      showError(compose, err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Reply cards (same pattern as Gmail)
  // -------------------------------------------------------------------------
  function showReplyCards(compose, textbox, result) {
    const panel = createResultPanel(compose);
    const drafts = parseReplyDrafts(result);

    for (const draft of drafts) {
      const card = document.createElement('div');
      card.style.cssText = `
        padding:10px 12px; margin-bottom:6px; border:1px solid #E2E8F0;
        border-radius:10px; cursor:pointer; transition:border-color 0.15s; background:white;
      `;
      card.innerHTML = `
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:500;
          background:#DBEAFE;color:#1E40AF;margin-bottom:6px;">${escapeHtml(draft.tone)}</span>
        <p style="font-size:12px;color:#334155;line-height:1.5;margin:4px 0 6px;">
          ${escapeHtml(draft.text.slice(0, 200))}${draft.text.length > 200 ? '...' : ''}
        </p>
        <span style="font-size:11px;color:#2563EB;cursor:pointer;">Use this →</span>
      `;
      card.addEventListener('click', () => {
        setComposeContent(textbox, draft.text);
        panel.remove();
      });
      panel.appendChild(card);
    }
  }

  // -------------------------------------------------------------------------
  // Subject options
  // -------------------------------------------------------------------------
  function showSubjectOptions(compose, result) {
    const lines = result.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
    const panel = createResultPanel(compose);

    for (const line of lines.slice(0, 3)) {
      const clean = line.replace(/^\d+[\.\)]\s*/, '');
      const btn = document.createElement('button');
      btn.style.cssText = `
        display:block; width:100%; padding:8px 10px; margin-bottom:4px;
        border:1px solid #E2E8F0; border-radius:8px; background:#F8FAFC;
        cursor:pointer; text-align:left; font-size:12px; color:#334155;
      `;
      btn.textContent = clean;
      btn.addEventListener('click', () => {
        const subjectInput = compose.querySelector('input[aria-label*="Subject"], input[type="text"]');
        if (subjectInput) {
          subjectInput.value = clean;
          subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        panel.remove();
      });
      panel.appendChild(btn);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function getSubject(compose) {
    const input = compose.querySelector('input[aria-label*="Subject"], input[type="text"]');
    return input ? input.value : '';
  }

  function getThreadText() {
    // Outlook reading pane — collect all email body containers
    const containers = document.querySelectorAll(
      '[class*="ReadingPaneContent"] [dir="ltr"], [data-convid] [dir="ltr"]'
    );
    const texts = [];
    for (const c of containers) {
      const text = c.textContent || '';
      if (text.trim().length > 10) texts.push(text.trim());
    }
    return texts.join('\n\n---\n\n').slice(0, 30000);
  }

  function setComposeContent(textbox, text) {
    textbox.innerHTML = text.replace(/\n/g, '<br>');
    textbox.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function parseReplyDrafts(text) {
    const drafts = [];
    const labels = ['PROFESSIONAL:', 'FRIENDLY:', 'BRIEF:'];
    const sections = text.split(new RegExp(`(${labels.join('|')})`, 'i')).filter(Boolean);

    let currentTone = null;
    for (const section of sections) {
      const upper = section.trim().toUpperCase();
      if (labels.includes(upper)) {
        currentTone = section.trim().replace(':', '');
        currentTone = currentTone.charAt(0).toUpperCase() + currentTone.slice(1).toLowerCase();
      } else if (currentTone && section.trim()) {
        drafts.push({ tone: currentTone, text: section.trim() });
      }
    }
    if (drafts.length === 0 && text.trim()) {
      drafts.push({ tone: 'Reply', text: text.trim() });
    }
    return drafts;
  }

  function createResultPanel(compose) {
    const existing = document.querySelector('[data-antonai="result"]');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.setAttribute('data-antonai', 'result');
    panel.style.cssText = `
      position:relative; z-index:2147483647;
      background:white; border:1px solid #E2E8F0; border-radius:12px;
      box-shadow:0 4px 16px rgba(0,0,0,0.08); padding:14px; margin:8px 0;
      max-height:320px; overflow-y:auto;
      font-family:-apple-system,'Segoe UI',sans-serif;
    `;

    const close = document.createElement('span');
    close.style.cssText = `position:absolute;top:10px;right:12px;cursor:pointer;color:#94A3B8;font-size:14px;`;
    close.textContent = '✕';
    close.addEventListener('click', () => panel.remove());
    panel.appendChild(close);

    compose.parentElement.insertBefore(panel, compose);
    return panel;
  }

  function showResultPanel(compose, result) {
    const panel = createResultPanel(compose);
    panel.innerHTML += `
      <div style="font-size:12px;color:#334155;line-height:1.6;white-space:pre-wrap;">${escapeHtml(result)}</div>
    `;
  }

  function showLoading(compose) {
    const panel = createResultPanel(compose);
    panel.innerHTML += `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 0;">
        <div style="width:16px;height:16px;border:2px solid #2563EB;border-top-color:transparent;
          border-radius:50%;animation:antonai-spin 0.8s linear infinite;"></div>
        <span style="font-size:12px;color:#64748B;">Processing...</span>
      </div>
      <style>@keyframes antonai-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    `;
    return panel;
  }

  function showError(compose, msg) {
    const banner = document.createElement('div');
    banner.setAttribute('data-antonai', 'error');
    banner.style.cssText = `
      padding:8px 12px; margin:8px 0; border-radius:8px;
      background:#FEF2F2; border:1px solid #FECACA;
      font-size:12px; color:#DC2626;
      font-family:-apple-system,sans-serif;
    `;
    banner.textContent = msg;
    compose.parentElement.insertBefore(banner, compose);
    setTimeout(() => banner.remove(), 5000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
