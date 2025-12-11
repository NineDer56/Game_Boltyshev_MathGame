// Хелперы для безопасной работы с localStorage
const Storage = (function() {
  const STORAGE_KEYS = {
    currentPlayerName: 'currentPlayerName',
    rating: 'playersRating',
    lastResult: 'lastGameResult',
  };

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (e) {
      return fallback;
    }
  }

  return {
    setCurrentPlayerName: function(name) {
      try {
        localStorage.setItem(STORAGE_KEYS.currentPlayerName, name);
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.error('Превышен лимит localStorage');
        } else {
          console.error('Ошибка сохранения имени:', e);
        }
        throw e;
      }
    },
    getCurrentPlayerName: function() {
      return localStorage.getItem(STORAGE_KEYS.currentPlayerName) || '';
    },
    clearCurrentPlayer: function() {
      localStorage.removeItem(STORAGE_KEYS.currentPlayerName);
    },
    getRating: function() {
      const raw = localStorage.getItem(STORAGE_KEYS.rating);
      const parsed = safeParse(raw, []);
      // Убеждаемся, что всегда возвращаем массив
      return Array.isArray(parsed) ? parsed : [];
    },
    saveRating: function(list) {
      try {
        const data = JSON.stringify(list);
        // Проверка размера (примерно, localStorage обычно 5-10MB)
        if (data.length > 1000000) { // 1MB
          console.warn('Размер рейтинга слишком большой, возможно превышение лимита');
        }
        localStorage.setItem(STORAGE_KEYS.rating, data);
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.error('Превышен лимит localStorage, невозможно сохранить рейтинг');
          // Можно попробовать удалить старые записи
        } else {
          console.error('Ошибка сохранения рейтинга:', e);
        }
        throw e;
      }
    },
    addRatingRecord: function(record) {
      const list = Storage.getRating();
      // Дополнительная проверка на случай, если getRating вернул не массив
      if (!Array.isArray(list)) {
        console.warn('getRating вернул не массив, инициализируем пустым массивом');
        Storage.saveRating([]);
        return Storage.addRatingRecord(record); // Рекурсивный вызов с исправленными данными
      }
      // Обновляем рекорд игрока, если новый результат лучше
      const existingIndex = list.findIndex((item) => item && item.name === record.name);
      if (existingIndex >= 0) {
        if (record.score > list[existingIndex].score) {
          list[existingIndex] = record;
        }
      } else {
        list.push(record);
      }
      list.sort((a, b) => b.score - a.score);
      Storage.saveRating(list);
    },
    clearRating: function() {
      localStorage.removeItem(STORAGE_KEYS.rating);
    },
    saveLastResult: function(result) {
      localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(result));
    },
    getLastResult: function() {
      const raw = localStorage.getItem(STORAGE_KEYS.lastResult);
      return safeParse(raw, null);
    },
    getPlayerRecords: function(name) {
      return Storage.getRating().filter((entry) => entry.name === name);
    },
    clearAllData: function() {
      // Очищаем все данные игры
      localStorage.removeItem(STORAGE_KEYS.currentPlayerName);
      localStorage.removeItem(STORAGE_KEYS.rating);
      localStorage.removeItem(STORAGE_KEYS.lastResult);
    }
  };
})();

