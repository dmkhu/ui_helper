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

  // Заполнить все поля
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

  // Включить/выключить автозаполнение
  if (request.action === 'toggleAutoFill') {
    if (request.enabled) {
      enableAutoFill();
    } else {
      disableAutoFill();
    }
    sendResponse({ success: true });
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
      
      // ⭐ НОВОЕ: Проверяем, не заполнено ли уже поле
      if (el.value && el.value.trim() !== '') {
        continue; // Пропускаем заполненное поле
      }
      
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

  // Поиск по data-* и aria-* атрибутам
  if (!found) {
    const allInputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    for (const el of allInputs) {
      if (el.type === 'hidden' || el.disabled || el.readOnly) continue;
      
      // ⭐ НОВОЕ: Проверяем, не заполнено ли уже поле
      if (el.value && el.value.trim() !== '') {
        continue; // Пропускаем заполненное поле
      }
      
      const attrs = el.attributes;
      let matched = false;
      for (const attr of attrs) {
        if (attr.name.startsWith('data-') && attr.value.toLowerCase().includes(key.toLowerCase())) {
          matched = true;
          break;
        }
        if (attr.name.startsWith('aria-') && attr.value.toLowerCase().includes(key.toLowerCase())) {
          matched = true;
          break;
        }
      }
      
      // Проверяем label
      if (!matched) {
        const label = el.closest('label')?.textContent?.trim() || '';
        if (label.toLowerCase().includes(key.toLowerCase())) {
          matched = true;
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

// ===== АВТОЗАПОЛНЕНИЕ =====

let autoFillEnabled = false;
let autoFillObserver = null;

// Функция для автозаполнения всех полей (исправленная)
function autoFillAllFields() {
  chrome.storage.local.get(null, (data) => {
    // Удаляем ключ состояния автозаполнения
    const { autoFillEnabled, ...fillData } = data;
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    let filledCount = 0;
    
    for (const input of inputs) {
      // Пропускаем disabled и readonly поля
      if (input.disabled || input.readOnly) continue;
      
      // ⭐ ПРОВЕРКА: Если поле уже заполнено - пропускаем
      if (input.value && input.value.trim() !== '') {
        continue;
      }
      
      const id = input.id || '';
      const name = input.name || '';
      const placeholder = input.placeholder || '';
      const label = input.closest('label')?.textContent?.trim() || '';
      const ariaLabel = input.getAttribute('aria-label') || '';
      
      for (const [key, value] of Object.entries(fillData)) {
        const searchKey = key.toLowerCase();
        if (id.toLowerCase().includes(searchKey) || 
            name.toLowerCase().includes(searchKey) || 
            placeholder.toLowerCase().includes(searchKey) ||
            label.toLowerCase().includes(searchKey) ||
            ariaLabel.toLowerCase().includes(searchKey)) {
          // ⭐ УБИРАЕМ ПРОВЕРКУ НА ПУСТОТУ, ТАК КАК МЫ УЖЕ ПРОВЕРИЛИ
          if (input.tagName === 'SELECT') {
            const options = input.options;
            for (let i = 0; i < options.length; i++) {
              if (options[i].value === value || options[i].text === value) {
                input.value = options[i].value;
                triggerEvents(input);
                filledCount++;
                break;
              }
            }
          } else {
            input.value = value;
            triggerEvents(input);
            filledCount++;
          }
          break;
        }
      }
    }
    
    if (filledCount > 0 && document.getElementById('test-data-helper-notification') === null) {
      showNotification(`🔄 Автозаполнение: заполнено ${filledCount} полей`);
    }
  });
}

// Включить автозаполнение
function enableAutoFill() {
  if (autoFillEnabled) return;
  autoFillEnabled = true;
  
  // Сначала заполняем существующие поля
  setTimeout(autoFillAllFields, 300);
  
  // Настраиваем MutationObserver для отслеживания новых полей
  if (autoFillObserver) {
    autoFillObserver.disconnect();
  }
  
  autoFillObserver = new MutationObserver((mutations) => {
    let hasNewInputs = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.('input:not([type="hidden"]), textarea, select') || 
                node.querySelector?.('input:not([type="hidden"]), textarea, select')) {
              hasNewInputs = true;
              break;
            }
          }
        }
      }
    }
    if (hasNewInputs) {
      setTimeout(autoFillAllFields, 200);
    }
  });
  
  autoFillObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('✅ Автозаполнение включено');
}

// Отключить автозаполнение
function disableAutoFill() {
  if (!autoFillEnabled) return;
  autoFillEnabled = false;
  
  if (autoFillObserver) {
    autoFillObserver.disconnect();
    autoFillObserver = null;
  }
  
  // Удаляем уведомление
  const notification = document.getElementById('test-data-helper-notification');
  if (notification) notification.remove();
  
  console.log('⏸ Автозаполнение отключено');
}

// Проверяем состояние при загрузке страницы
chrome.storage.local.get('autoFillEnabled', (result) => {
  if (result.autoFillEnabled) {
    enableAutoFill();
  }
});

// Автоматически включаем автозаполнение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('autoFillEnabled', (result) => {
    if (result.autoFillEnabled) {
      enableAutoFill();
    }
  });
});

// При изменении DOM (для SPA) также проверяем
if (window.MutationObserver) {
  const domObserver = new MutationObserver(() => {
    if (autoFillEnabled) {
      // Проверяем, не появились ли новые поля
      chrome.storage.local.get('autoFillEnabled', (result) => {
        if (result.autoFillEnabled && !autoFillEnabled) {
          enableAutoFill();
        }
      });
    }
  });
  
  domObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

console.log('🔧 Test Data Helper content script loaded');