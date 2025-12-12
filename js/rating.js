const ratingBody = document.getElementById('ratingTableBody');
const currentPlayerBlock = document.getElementById('currentPlayerResult');
const playAgainBtn = document.getElementById('playAgainBtn');
const clearBtn = document.getElementById('clearRatingBtn');
const tableHead = document.querySelector('#ratingTable thead');

let currentSort = { field: 'score', dir: 'desc' };

function renderRating(list) {
  ratingBody.innerHTML = '';
  if (!list.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'text-muted';
    cell.textContent = 'Нет данных, сыграйте первую партию';
    row.appendChild(cell);
    ratingBody.appendChild(row);
    return;
  }
  list.forEach((item, index) => {
    const row = document.createElement('tr');
    const cells = [
      String(index + 1),
      String(item.name || ''),
      String(item.score || 0),
      String(item.maxLevel || 0),
      String(item.difficulty || ''),
      String(item.date || '')
    ];
    cells.forEach((text, i) => {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.appendChild(cell);
    });
    ratingBody.appendChild(row);
  });
}

function applySort(list) {
  const sorted = [...list];
  const { field, dir } = currentSort;
  sorted.sort((a, b) => {
    if (field === 'score' || field === 'maxLevel') {
      return dir === 'asc' ? a[field] - b[field] : b[field] - a[field];
    }
    return dir === 'asc'
      ? String(a[field]).localeCompare(String(b[field]))
      : String(b[field]).localeCompare(String(a[field]));
  });
  return sorted;
}

function renderCurrentPlayer() {
  const name = Storage.getCurrentPlayerName();
  const last = Storage.getLastResult();
  if (!name || !last) {
    currentPlayerBlock.textContent = 'Данных нет — вернитесь в игру и завершите партию.';
    return;
  }
  const records = Storage.getPlayerRecords(name);
  const best = records.length ? Math.max(...records.map((r) => r.score)) : last.score;
  
  currentPlayerBlock.innerHTML = '';
  const nameP = document.createElement('p');
  const nameStrong = document.createElement('strong');
  nameStrong.textContent = name;
  nameP.appendChild(nameStrong);
  currentPlayerBlock.appendChild(nameP);
  
  const scoreP = document.createElement('p');
  scoreP.textContent = `Очки: ${last.score || 0}, лучший результат: ${best || 0}`;
  currentPlayerBlock.appendChild(scoreP);
  
  const levelP = document.createElement('p');
  levelP.textContent = `Уровень: ${last.maxLevel || 0}, сложность: ${last.difficulty || 'unknown'}`;
  currentPlayerBlock.appendChild(levelP);
  
  const dateP = document.createElement('p');
  dateP.textContent = `Дата: ${last.date || Utils.nowDateTime()}`;
  currentPlayerBlock.appendChild(dateP);
}

function handleSort(evt) {
  const th = evt.target.closest('th[data-sort]');
  if (!th) return;
  const field = th.dataset.sort;
  if (currentSort.field === field) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort = { field, dir: 'asc' };
  }
  renderRating(applySort(Storage.getRating()));
}

function init() {
  if (!ratingBody || !currentPlayerBlock || !playAgainBtn || !clearBtn || !tableHead) {
    console.error('Не найдены необходимые элементы на странице рейтинга');
    return;
  }
  
  renderRating(applySort(Storage.getRating()));
  renderCurrentPlayer();
  playAgainBtn.addEventListener('click', () => window.location.href = 'game.html');
  clearBtn.addEventListener('click', () => {
    if (confirm('Точно очистить рейтинг?')) {
      Storage.clearRating();
      renderRating([]);
    }
  });
  
  const clearAllBtn = document.getElementById('clearAllDataBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите удалить ВСЕ данные? Это удалит:\n- Все аккаунты игроков\n- Весь рейтинг\n- Текущего игрока\n- Последний результат\n\nЭто действие нельзя отменить!')) {
        Storage.clearAllData();
        renderRating([]);
        renderCurrentPlayer();
        alert('Все данные успешно удалены!');
      }
    });
  }
  tableHead.addEventListener('click', handleSort);
}

document.addEventListener('DOMContentLoaded', init);

