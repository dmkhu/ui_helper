// Слушаем сообщения из popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillField') {
    const { key, value } = request;
    const filled = fillInputsByKey(key, value);
    if (filled) {
      showNotification(`✅ Заполнено: ${key} = ${value}`);
    } else {
      showNotification(`⚠️ Поле с ключом "${key}" не найдено`);
    }
    sendResponse({ success: filled });
    return true;
  }

  // 🆕 Обработка "Заполнить все"
  if (request.action === 'fillAllFields') {
    const data = request.data;
    let totalFilled = 0;
    const results = [];

    for (const [key, value] of Object.entries(data)) {
      const filled = fillInputsByKey(key, value);
      if (filled) {
        totalFilled++;
        results.push(`${key}=${value}`);
      }
    }

    if (totalFilled > 0) {
      showNotification(`✅ Заполнено ${totalFilled} полей: ${results.join(', ')}`);
    } else {
      showNotification('⚠️ Ни одно поле не найдено для заполнения');
    }

    sendResponse({ filled: totalFilled });
    return true;
  }
});

// Функция заполнения (улучшенная)
function fillInputsByKey(key, value) {
  const selectors = [
    `input[name="${key}"]`,
    `input[id="${key}"]`,
    `input[placeholder*="${key}" i]`,
    `input[data-testid*="${key}" i]`,
    `input[data-test*="${key}" i]`,
    `input[data-cy*="${key}" i]`,
    `input[data-qa*="${key}" i]`,
    `textarea[name="${key}"]`,
    `textarea[id="${key}"]`,
    `textarea[placeholder*="${key}" i]`,
    `select[name="${key}"]`,
    `select[id="${key}"]`,
    `input[name*="${key}" i]`,
    `input[id*="${key}" i]`,
    `input[aria-label*="${key}" i]`,
    `input[aria-labelledby*="${key}" i]`,
  ];

  let found = false;

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (el.type === 'hidden' || el.disabled || el.readOnly) continue;
      
      if (el.tagName === 'SELECT') {
        const options = el.options;
        for (let i = 0; i < options.length; i++) {
          if (options[i].value === value || options[i].text === value) {
            el.value = options[i].value;
            triggerEvents(el);
            found = true;
            break;
          }
        }
      } else {
        el.value = value;
        triggerEvents(el);
        found = true;
      }
    }
  }

  // Поиск по data-* атрибутам
  if (!found) {
    const allInputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    for (const el of allInputs) {
      if (el.type === 'hidden' || el.disabled || el.readOnly) continue;
      
      const attrs = el.attributes;
      let matched = false;
      for (const attr of attrs) {
        if (attr.name.startsWith('data-') && attr.value.toLowerCase().includes(key.toLowerCase())) {
          matched = true;
          break;
        }
        // Проверяем aria-* атрибуты
        if (attr.name.startsWith('aria-') && attr.value.toLowerCase().includes(key.toLowerCase())) {
          matched = true;
          break;
        }
      }
      
      if (matched) {
        if (el.tagName === 'SELECT') {
          const options = el.options;
          for (let i = 0; i < options.length; i++) {
            if (options[i].value === value || options[i].text === value) {
              el.value = options[i].value;
              triggerEvents(el);
              found = true;
              break;
            }
          }
        } else {
          el.value = value;
          triggerEvents(el);
          found = true;
        }
        if (found) break;
      }
    }
  }

  return found;
}

// Триггерим события для реактивных фреймворков
function triggerEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // Для React
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeInputValueSetter && el.tagName === 'INPUT') {
    nativeInputValueSetter.call(el, el.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Показываем уведомление на странице
function showNotification(text) {
  const existing = document.getElementById('test-data-helper-notification');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'test-data-helper-notification';
  div.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #333;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 500px;
    opacity: 0;
    transition: opacity 0.3s ease;
    word-break: break-word;
  `;
  div.textContent = text;
  document.body.appendChild(div);

  requestAnimationFrame(() => {
    div.style.opacity = '1';
  });

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 400);
  }, 4000);
}

// Автоматическое заполнение при клике по полю (опционально)
// Раскомментируйте для включения
/*
document.addEventListener('click', (e) => {
  const el = e.target;
  if (el.matches('input:not([type="hidden"]), textarea')) {
    const name = el.name || el.id || '';
    if (name) {
      chrome.storage.local.get(name, (result) => {
        if (result[name]) {
          el.value = result[name];
          triggerEvents(el);
        }
      });
    }
  }
});
*/