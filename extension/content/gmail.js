// extension/content/gmail.js — Gmail integration (PRD Feature 6)
// MutationObserver watches for compose windows and email views.
// Uses ARIA roles/attributes (not class names, which change with Gmail updates).
//
// Actions: Reply Drafts, Fix Email, Expand Bullets, Summarise Thread, Subject Lines, Translate
//
// 🔒 Security:
//   - Only runs on https://mail.google.com/*
//   - Text never leaves the device — all processing via localhost WebSocket
//   - Uses stable ARIA attributes for DOM queries (not volatile CSS classes)

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

  // Also run once on load
  setTimeout(injectComposeButtons, 2000);

  // -------------------------------------------------------------------------
  // Inject buttons into compose windows
  // -------------------------------------------------------------------------
  function injectComposeButtons() {
    // Gmail compose textboxes have role="textbox" and an aria-label
    const composeBoxes = document.querySelectorAll('[role="textbox"][aria-label]');

    for (const box of composeBoxes) {
      // Find the compose container (parent with compose-specific structure)
      const compose = box.closest('[role="dialog"], .nH');
      if (!compose || compose.getAttribute(INJECTED_ATTR)) continue;
      compose.setAttribute(INJECTED_ATTR, 'true');

      // Find the toolbar row — typically the row with formatting buttons
      const toolbar = compose.querySelector('[role="toolbar"], .btC');
      if (!toolbar) continue;

      // Create Anton AI button
      const btn = createAntonButton();
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showActionPanel(compose, box, btn);
      });

      toolbar.appendChild(btn);
    }
  }

  // -------------------------------------------------------------------------
  // Create the Anton AI toolbar button
  // -------------------------------------------------------------------------
  function createAntonButton() {
    const btn = document.createElement('div');
    btn.setAttribute('data-antonai', 'button');
    btn.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      margin-left: 4px;
      transition: background 0.15s;
      position: relative;
    `;
    btn.title = 'Anton AI';

    // Small blue "A" icon
    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 12px; font-weight: 800; color: #2563EB;
      font-family: -apple-system, sans-serif;
    `;
    icon.textContent = 'A';
    btn.appendChild(icon);

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#F1F5F9';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });

    return btn;
  }

  // -------------------------------------------------------------------------
  // Action panel — floats above compose
  // -------------------------------------------------------------------------
  function showActionPanel(compose, textbox, anchorBtn) {
    // Remove any existing panel
    const existing = document.querySelector('[data-antonai="panel"]');
    if (existing) { existing.remove(); }

    const rect = anchorBtn.getBoundingClientRect();

    const panel = document.createElement('div');
    panel.setAttribute('data-antonai', 'panel');
    panel.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      width: 300px;
      padding: 12px;
      top: ${rect.top - 280}px;
      left: ${rect.left - 130}px;
      font-family: -apple-system, 'Segoe UI', sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px; padding-bottom: 8px;
      border-bottom: 1px solid #F1F5F9;
    `;
    header.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:#334155;">Anton AI</span>
      <span data-antonai="close" style="cursor:pointer;color:#94A3B8;font-size:16px;">✕</span>
    `;
    header.querySelector('[data-antonai="close"]').addEventListener('click', () => panel.remove());
    panel.appendChild(header);

    // Action buttons
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
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 8px 10px;
        border: none; background: #F8FAFC; border-radius: 8px;
        cursor: pointer; margin-bottom: 4px;
        text-align: left; transition: background 0.1s;
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
        handleGmailAction(action.id, compose, textbox);
      });

      panel.appendChild(row);
    }

    // Close on outside click
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
  // Handle Gmail actions
  // -------------------------------------------------------------------------
  async function handleGmailAction(actionId, compose, textbox) {
    const composeText = textbox.textContent || textbox.innerText || '';
    const subject = getSubject(compose);

    let payload;

    switch (actionId) {
      case 'reply': {
        const emailText = getThreadText(compose);
        payload = { action: 'email:reply', payload: { emailText, subject } };
        break;
      }
      case 'fix': {
        if (composeText.trim().length < 10) return;
        payload = { action: 'email:fix', payload: { emailText: composeText } };
        break;
      }
      case 'expand': {
        if (composeText.trim().length < 10) return;
        payload = { action: 'email:expand', payload: { bullets: composeText } };
        break;
      }
      case 'summarise': {
        const threadText = getThreadText(compose);
        if (threadText.trim().length < 20) return;
        payload = { action: 'email:summarise', payload: { threadText } };
        break;
      }
      case 'subjects': {
        const text = composeText || getThreadText(compose);
        if (text.trim().length < 10) return;
        payload = { action: 'email:subjects', payload: { emailText: text } };
        break;
      }
      case 'translate': {
        if (composeText.trim().length < 10) return;
        payload = { action: 'text:enhance', payload: { text: composeText, mode: 'translate' } };
        break;
      }
      default:
        return;
    }

    // Show loading state
    const loadingEl = showLoadingPanel(compose, actionId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'antonai:request',
        payload,
      });

      if (loadingEl) loadingEl.remove();

      if (!response.success) {
        showErrorBanner(compose, response.error || 'Request failed');
        return;
      }

      // Route result display
      switch (actionId) {
        case 'reply':
          showReplyDrafts(compose, textbox, response.result);
          break;
        case 'fix':
          showFixResult(compose, textbox, composeText, response.result);
          break;
        case 'expand':
        case 'translate':
          setComposeContent(textbox, response.result);
          break;
        case 'summarise':
          showSummaryPanel(compose, response.result);
          break;
        case 'subjects':
          showSubjectOptions(compose, response.result);
          break;
      }
    } catch (err) {
      if (loadingEl) loadingEl.remove();
      showErrorBanner(compose, err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Reply drafts — parse PROFESSIONAL: / FRIENDLY: / BRIEF: and show 3 cards
  // -------------------------------------------------------------------------
  function showReplyDrafts(compose, textbox, result) {
    const drafts = parseReplyDrafts(result);
    const panel = createResultPanel(compose);

    for (const draft of drafts) {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 10px 12px; margin-bottom: 6px;
        border: 1px solid #E2E8F0; border-radius: 10px;
        cursor: pointer; transition: border-color 0.15s;
        background: white;
      `;

      const badgeColors = {
        Professional: { bg: '#DBEAFE', text: '#1E40AF' },
        Friendly: { bg: '#D1FAE5', text: '#065F46' },
        Brief: { bg: '#F1F5F9', text: '#475569' },
      };
      const bc = badgeColors[draft.tone] || badgeColors.Brief;

      card.innerHTML = `
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:500;
          background:${bc.bg};color:${bc.text};margin-bottom:6px;">${draft.tone}</span>
        <p style="font-size:12px;color:#334155;line-height:1.5;margin:4px 0 6px;">${escapeHtml(draft.text.slice(0, 200))}${draft.text.length > 200 ? '...' : ''}</p>
        <span style="font-size:11px;color:#2563EB;cursor:pointer;">Use this →</span>
      `;

      card.addEventListener('mouseenter', () => { card.style.borderColor = '#93C5FD'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = '#E2E8F0'; });
      card.addEventListener('click', () => {
        setComposeContent(textbox, draft.text);
        panel.remove();
      });

      panel.appendChild(card);
    }
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

    // If parsing failed, return the whole thing as one draft
    if (drafts.length === 0 && text.trim()) {
      drafts.push({ tone: 'Reply', text: text.trim() });
    }

    return drafts;
  }

  // -------------------------------------------------------------------------
  // Fix email — show original (strikethrough) + fixed text
  // -------------------------------------------------------------------------
  function showFixResult(compose, textbox, original, fixed) {
    const panel = createResultPanel(compose);

    panel.innerHTML += `
      <div style="margin-bottom:8px;">
        <p style="font-size:11px;color:#94A3B8;margin-bottom:4px;">Original:</p>
        <p style="font-size:12px;color:#94A3B8;text-decoration:line-through;line-height:1.5;">${escapeHtml(original.slice(0, 300))}</p>
      </div>
      <div style="margin-bottom:10px;">
        <p style="font-size:11px;color:#10B981;margin-bottom:4px;">Fixed:</p>
        <p style="font-size:12px;color:#334155;line-height:1.5;">${escapeHtml(fixed.slice(0, 300))}</p>
      </div>
    `;

    const applyBtn = document.createElement('button');
    applyBtn.style.cssText = `
      width:100%; padding:8px; border:none; background:#2563EB; color:white;
      border-radius:8px; font-size:12px; cursor:pointer; font-weight:500;
    `;
    applyBtn.textContent = 'Apply Fix';
    applyBtn.addEventListener('click', () => {
      setComposeContent(textbox, fixed);
      panel.remove();
    });
    panel.appendChild(applyBtn);
  }

  // -------------------------------------------------------------------------
  // Summary panel — SUMMARY + ACTION_ITEMS + OPEN_QUESTIONS
  // -------------------------------------------------------------------------
  function showSummaryPanel(compose, result) {
    const panel = createResultPanel(compose);
    panel.innerHTML += `
      <div style="font-size:12px;color:#334155;line-height:1.6;white-space:pre-wrap;">${escapeHtml(result)}</div>
    `;
  }

  // -------------------------------------------------------------------------
  // Subject line options
  // -------------------------------------------------------------------------
  function showSubjectOptions(compose, result) {
    const lines = result.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
    const panel = createResultPanel(compose);

    for (const line of lines.slice(0, 3)) {
      const cleanLine = line.replace(/^\d+[\.\)]\s*/, '');
      const btn = document.createElement('button');
      btn.style.cssText = `
        display:block; width:100%; padding:8px 10px; margin-bottom:4px;
        border:1px solid #E2E8F0; border-radius:8px; background:#F8FAFC;
        cursor:pointer; text-align:left; font-size:12px; color:#334155;
        transition: border-color 0.15s;
      `;
      btn.textContent = cleanLine;
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#93C5FD'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#E2E8F0'; });
      btn.addEventListener('click', () => {
        // Set the subject field
        const subjectInput = compose.querySelector('input[name="subjectbox"]');
        if (subjectInput) {
          subjectInput.value = cleanLine;
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
    const subjectInput = compose.querySelector('input[name="subjectbox"]');
    return subjectInput ? subjectInput.value : '';
  }

  function getThreadText(compose) {
    // Get text from all visible email bodies in the thread
    const thread = compose.closest('[role="list"]') || compose.parentElement;
    const bodies = thread ? thread.querySelectorAll('[data-message-id] [dir="ltr"]') : [];
    const texts = [];
    for (const body of bodies) {
      const text = body.textContent || body.innerText || '';
      if (text.trim().length > 10) {
        texts.push(text.trim());
      }
    }
    return texts.join('\n\n---\n\n').slice(0, 30000);
  }

  function setComposeContent(textbox, text) {
    // Gmail uses contenteditable, so we set innerHTML with <br> for newlines
    textbox.innerHTML = text.replace(/\n/g, '<br>');
    textbox.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function createResultPanel(compose) {
    // Remove existing result panel
    const existing = document.querySelector('[data-antonai="result"]');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.setAttribute('data-antonai', 'result');
    panel.style.cssText = `
      position: relative; z-index: 2147483647;
      background: white; border: 1px solid #E2E8F0;
      border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      padding: 14px; margin: 8px 0; max-height: 320px; overflow-y: auto;
      font-family: -apple-system, 'Segoe UI', sans-serif;
    `;

    // Close button
    const close = document.createElement('span');
    close.style.cssText = `
      position:absolute; top:10px; right:12px;
      cursor:pointer; color:#94A3B8; font-size:14px;
    `;
    close.textContent = '✕';
    close.addEventListener('click', () => panel.remove());
    panel.appendChild(close);

    // Insert before compose box
    compose.parentElement.insertBefore(panel, compose);
    return panel;
  }

  function showLoadingPanel(compose, actionId) {
    const panel = createResultPanel(compose);
    panel.innerHTML += `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 0;">
        <div style="width:16px;height:16px;border:2px solid #2563EB;border-top-color:transparent;border-radius:50%;animation:antonai-spin 0.8s linear infinite;"></div>
        <span style="font-size:12px;color:#64748B;">Processing...</span>
      </div>
      <style>@keyframes antonai-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    `;
    return panel;
  }

  function showErrorBanner(compose, msg) {
    const banner = document.createElement('div');
    banner.setAttribute('data-antonai', 'error');
    banner.style.cssText = `
      padding: 8px 12px; margin: 8px 0; border-radius: 8px;
      background: #FEF2F2; border: 1px solid #FECACA;
      font-size: 12px; color: #DC2626;
      font-family: -apple-system, sans-serif;
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
