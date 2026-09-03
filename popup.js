document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('keyInput');
  const valueInput = document.getElementById('valueInput');
  const saveBtn = document.getElementById('saveBtn');
  const listEl = document.getElementById('list');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const fillAllBtn = document.getElementById('fillAllBtn');

  // Загрузить и отобразить все данные
  function renderList() {
    chrome.storage.local.get(null, (items) => {
      const keys = Object.keys(items);
      if (keys.length === 0) {
        listEl.innerHTML = '<div class="empty">Нет данных. Добавьте пару выше.</div>';
        fillAllBtn.disabled = true;
        return;
      }

      fillAllBtn.disabled = false;
      let html = '';
      keys.forEach((key) => {
        const value = items[key];
        html += `
          <div class="item">
            <span class="key">${escapeHtml(key)}</span>
            <span class="value">${escapeHtml(value)}</span>
            <div class="actions">
              <button class="fill-btn" data-key="${escapeHtml(key)}" title="Заполнить на активной вкладке">📝</button>
              <button class="delete-btn" data-key="${escapeHtml(key)}" title="Удалить">✕</button>
            </div>
          </div>
        `;
      });
      listEl.innerHTML = html;

      // Навесить обработчики
      document.querySelectorAll('.fill-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const key = e.target.dataset.key;
          fillOnActiveTab(key);
        });
      });

      document.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const key = e.target.dataset.key;
          deleteKey(key);
        });
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Сохранить новую пару
  function saveKeyValue() {
    const key = keyInput.value.trim();
    const value = valueInput.value.trim();
    if (!key) {
      alert('Введите ключ');
      return;
    }
    if (!value) {
      alert('Введите значение');
      return;
    }

    chrome.storage.local.set({ [key]: value }, () => {
      keyInput.value = '';
      valueInput.value = '';
      renderList();
    });
  }

  // Удалить ключ
  function deleteKey(key) {
    chrome.storage.local.remove(key, renderList);
  }

  // Очистить всё
  function clearAll() {
    if (confirm('Удалить все сохранённые данные?')) {
      chrome.storage.local.clear(renderList);
    }
  }

  // Заполнить одно поле на активной вкладке
  function fillOnActiveTab(key) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.storage.local.get(key, (result) => {
        const value = result[key];
        if (!value) {
          alert(`Нет значения для ключа "${key}"`);
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillField',
          key: key,
          value: value
        });
      });
    });
  }

  // 🆕 Заполнить ВСЕ поля на активной вкладке
  function fillAllOnActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        alert('Нет активной вкладки');
        return;
      }

      chrome.storage.local.get(null, (allData) => {
        const keys = Object.keys(allData);
        if (keys.length === 0) {
          alert('Нет сохранённых данных');
          return;
        }

        // Отправляем все данные на страницу
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillAllFields',
          data: allData
        }, (response) => {
          if (chrome.runtime.lastError) {
            alert('Ошибка: возможно, страница не загружена или расширение не имеет доступа');
          } else if (response && response.filled > 0) {
            // Успешно
          }
        });
      });
    });
  }

  // События
  saveBtn.addEventListener('click', saveKeyValue);
  clearAllBtn.addEventListener('click', clearAll);
  fillAllBtn.addEventListener('click', fillAllOnActiveTab);

  // Enter в полях
  keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKeyValue(); });
  valueInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKeyValue(); });

  renderList();
});