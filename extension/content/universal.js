// extension/content/universal.js — Universal text enhancer for any website
// Injects a small Anton AI icon on focus of any textarea / contenteditable.
// Hover shows 5 action buttons. Click sends text to desktop app for AI processing.
//
// 🔒 Security:
//   - Never reads password fields
//   - Ignores very short inputs (< 20 chars)
//   - Ignores inputs inside Anton AI's own extension popup

(function () {
  'use strict';

  const ACTIONS = [
    { id: 'improve', label: 'Fix', icon: '✨' },
    { id: 'shorten', label: 'Shorten', icon: '✂️' },
    { id: 'formal', label: 'Formal', icon: '👔' },
    { id: 'casual', label: 'Casual', icon: '😊' },
    { id: 'translate', label: 'Translate', icon: '🌐' },
  ];

  let currentIcon = null;
  let currentTooltip = null;
  let focusedInput = null;
  let removeTimeout = null;

  // -------------------------------------------------------------------------
  // Inject icon on input focus
  // -------------------------------------------------------------------------
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!isEligibleInput(el)) return;

    focusedInput = el;
    removeExisting();
    injectIcon(el);
  });

  document.addEventListener('focusout', () => {
    // Delay removal so the icon/tooltip click handler can fire first
    removeTimeout = setTimeout(() => {
      removeExisting();
      focusedInput = null;
    }, 250);
  });

  // -------------------------------------------------------------------------
  // Check if an element is eligible for enhancement
  // -------------------------------------------------------------------------
  function isEligibleInput(el) {
    if (!el) return false;

    // Must be a textarea or contenteditable
    const isTextarea = el.tagName === 'TEXTAREA';
    const isEditable = el.isContentEditable;
    if (!isTextarea && !isEditable) return false;

    // 🔒 Never touch password fields
    if (el.type === 'password') return false;

    // 🔒 Ignore inputs inside our own extension
    if (el.closest('[data-antonai]')) return false;

    // Ignore very short readonly inputs
    if (el.readOnly || el.disabled) return false;

    return true;
  }

  // -------------------------------------------------------------------------
  // Get text from the input
  // -------------------------------------------------------------------------
  function getInputText(el) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    return el.textContent || el.innerText || '';
  }

  // -------------------------------------------------------------------------
  // Set text on the input
  // -------------------------------------------------------------------------
  function setInputText(el, text) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = text;
      // Trigger input event so frameworks (React, Angular) detect the change
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // -------------------------------------------------------------------------
  // Inject the icon button
  // -------------------------------------------------------------------------
  function injectIcon(el) {
    const rect = el.getBoundingClientRect();

    const icon = document.createElement('div');
    icon.setAttribute('data-antonai', 'icon');
    icon.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: #2563EB;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      transition: transform 0.15s ease;
      font-size: 10px; font-weight: 700; color: white;
      font-family: -apple-system, sans-serif;
      top: ${rect.bottom - 28}px;
      left: ${rect.right - 30}px;
    `;
    icon.textContent = 'A';
    icon.title = 'Anton AI';

    icon.addEventListener('mouseenter', () => {
      icon.style.transform = 'scale(1.15)';
      showTooltip(icon);
    });

    icon.addEventListener('mouseleave', () => {
      icon.style.transform = 'scale(1)';
      // Don't hide tooltip immediately — let user move mouse to it
    });

    document.body.appendChild(icon);
    currentIcon = icon;
  }

  // -------------------------------------------------------------------------
  // Show tooltip with action buttons
  // -------------------------------------------------------------------------
  function showTooltip(anchorIcon) {
    if (currentTooltip) return;

    const anchorRect = anchorIcon.getBoundingClientRect();

    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-antonai', 'tooltip');
    tooltip.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      padding: 6px;
      display: flex; flex-direction: column; gap: 2px;
      top: ${anchorRect.top - (ACTIONS.length * 30 + 16)}px;
      left: ${anchorRect.left - 80}px;
      min-width: 120px;
    `;

    for (const action of ACTIONS) {
      const btn = document.createElement('button');
      btn.setAttribute('data-antonai', 'action');
      btn.style.cssText = `
        display: flex; align-items: center; gap: 6px;
        padding: 5px 10px;
        border: none; background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px; color: #334155;
        font-family: -apple-system, sans-serif;
        width: 100%; text-align: left;
      `;
      btn.innerHTML = `<span>${action.icon}</span><span>${action.label}</span>`;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#EFF6FF';
        btn.style.color = '#1D4ED8';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.color = '#334155';
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(removeTimeout); // prevent focusout removal
        handleAction(action.id);
      });

      tooltip.appendChild(btn);
    }

    // Hide tooltip when mouse leaves it
    tooltip.addEventListener('mouseleave', () => {
      removeTooltip();
    });

    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
  }

  // -------------------------------------------------------------------------
  // Handle an action
  // -------------------------------------------------------------------------
  async function handleAction(actionId) {
    if (!focusedInput) return;

    const text = getInputText(focusedInput);
    if (text.trim().length < 20) {
      // Too short to process meaningfully
      return;
    }

    // Show processing state on icon
    if (currentIcon) {
      currentIcon.style.background = '#F59E0B';
      currentIcon.textContent = '⏳';
    }
    removeTooltip();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'antonai:request',
        payload: {
          action: 'text:enhance',
          payload: { text, mode: actionId },
        },
      });

      if (response.success && response.result) {
        setInputText(focusedInput, response.result);
        // Flash green on success
        if (currentIcon) {
          currentIcon.style.background = '#10B981';
          currentIcon.textContent = '✓';
          setTimeout(() => {
            if (currentIcon) {
              currentIcon.style.background = '#2563EB';
              currentIcon.textContent = 'A';
            }
          }, 1500);
        }
      } else {
        showError(response.error || 'Failed');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Show error state on icon
  // -------------------------------------------------------------------------
  function showError(msg) {
    if (currentIcon) {
      currentIcon.style.background = '#EF4444';
      currentIcon.textContent = '✕';
      currentIcon.title = msg;
      setTimeout(() => {
        if (currentIcon) {
          currentIcon.style.background = '#2563EB';
          currentIcon.textContent = 'A';
          currentIcon.title = 'Anton AI';
        }
      }, 2000);
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  function removeExisting() {
    removeTooltip();
    if (currentIcon) {
      currentIcon.remove();
      currentIcon = null;
    }
  }

  function removeTooltip() {
    if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }
})();
