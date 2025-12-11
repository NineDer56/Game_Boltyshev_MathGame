// game.js - основная игровая логика

const difficulties = {
  easy: { time: 70, fallDuration: 9, spawn: 1200, multiplier: 1, maxNumber: 60 },
  medium: { time: 55, fallDuration: 7, spawn: 950, multiplier: 1.5, maxNumber: 100 },
  hard: { time: 45, fallDuration: 6, spawn: 800, multiplier: 2, maxNumber: 150 },
};

const SUBLEVELS_PER_LEVEL = 3;
const BASE_POINTS = 100;
const PENALTY = 10;

const hud = {
  player: document.getElementById('hudPlayer'),
  difficulty: document.getElementById('hudDifficulty'),
  level: document.getElementById('hudLevel'),
  sublevel: document.getElementById('hudSublevel'),
  score: document.getElementById('hudScore'),
  timer: document.getElementById('hudTimer'),
};

const elements = {
  ruleTitle: document.getElementById('ruleTitle'),
  gameArea: document.getElementById('gameArea'),
  messages: document.getElementById('messages'),
  difficultyPanel: document.getElementById('difficultyPanel'),
  playerNameTitle: document.getElementById('playerNameTitle'),
  hintBtn: document.getElementById('hintBtn'),
  devSkip: document.getElementById('devSkipSelect'),
  exitBtn: document.getElementById('exitBtn'),
  finishBtn: document.getElementById('finishBtn'),
};

const state = {
  player: '',
  difficulty: null,
  level: 1,
  sublevel: 1,
  score: 0,
  timeLeft: 0,
  timerId: null,
  spawnId: null,
  collisionId: null,
  expectedSequence: [],
  expectedIndex: 0,
  allowLevels: 1,
  currentRuleHint: '',
};

function resetTimers() {
  if (state.timerId) clearInterval(state.timerId);
  if (state.spawnId) clearInterval(state.spawnId);
  if (state.collisionId) clearInterval(state.collisionId);
  state.timerId = null;
  state.spawnId = null;
  state.collisionId = null;
}

function setMessage(text, type = 'info') {
  const el = Utils.createEl('div', `message ${type === 'success' ? 'message--success' : type === 'error' ? 'message--error' : ''}`, text);
  elements.messages.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

function updateHUD() {
  if (hud.player) hud.player.textContent = state.player || '---';
  // Переводим сложность на русский
  const difficultyNames = {
    easy: 'Легкий',
    medium: 'Средний',
    hard: 'Сложный'
  };
  if (hud.difficulty) {
    hud.difficulty.textContent = state.difficulty ? (difficultyNames[state.difficulty] || state.difficulty) : '—';
  }
  if (hud.level) hud.level.textContent = state.level;
  if (hud.sublevel) hud.sublevel.textContent = `${state.sublevel}/${SUBLEVELS_PER_LEVEL}`;
  if (hud.score) hud.score.textContent = Math.round(state.score);
  if (hud.timer) hud.timer.textContent = Utils.formatTime(state.timeLeft);
}

function startTimer(seconds, onTimeout) {
  state.timeLeft = seconds;
  updateHUD();
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    updateHUD();
    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      onTimeout();
    }
  }, 1000);
}

function addScore(base) {
  const mult = state.difficulty ? difficulties[state.difficulty].multiplier : 1;
  state.score += base * mult;
  updateHUD();
}

function applyPenalty() {
  const mult = state.difficulty ? difficulties[state.difficulty].multiplier : 1;
  state.score = Math.max(0, state.score - PENALTY * mult);
  updateHUD();
}

function exitToMenu() {
  try {
    console.log('Выход в меню без сохранения результата');
    resetTimers();
    // Просто возвращаемся на главную страницу без сохранения
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Ошибка при выходе в меню:', error);
    alert('Ошибка при выходе: ' + error.message);
  }
}

function finishGame(reason = 'finish') {
  try {
    console.log('finishGame вызвана с reason:', reason);
    resetTimers();
    // Сохраняем результат только если игра была начата (выбрана сложность)
    if (state.difficulty && state.score >= 0) {
      const record = {
        name: state.player,
        score: Math.round(state.score),
        maxLevel: state.level,
        difficulty: state.difficulty || 'unknown',
        date: Utils.nowDateTime(),
        reason,
      };
      Storage.addRatingRecord(record);
      Storage.saveLastResult(record);
      console.log('Результат сохранен, переход на rating.html');
      window.location.href = 'rating.html';
    } else {
      // Если игра не была начата, просто выходим в меню
      console.log('Игра не была начата, выход в меню');
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Ошибка в finishGame:', error);
    alert('Ошибка при завершении игры: ' + error.message);
  }
}

function clearArea() {
  if (elements.gameArea) {
    // Очищаем cleanup функцию, если она есть
    if (elements.gameArea.cleanup) {
      elements.gameArea.cleanup();
      delete elements.gameArea.cleanup;
    }
    elements.gameArea.innerHTML = '';
  }
}

function guardPlayer() {
  const player = Storage.getCurrentPlayerName();
  if (!player) {
    window.location.href = 'index.html';
    return;
  }
  state.player = player;
  elements.playerNameTitle.textContent = player;
  hud.player.textContent = player;
}

// -------- Level 1 (статическая сетка) ----------
function generateLevel1Task() {
  // Получаем максимальное число в зависимости от сложности
  const maxNum = state.difficulty ? difficulties[state.difficulty].maxNumber : 60;
  const minNum = 2;
  const maxGuaranteed = Math.floor(maxNum * 0.7); // Для гарантированных чисел используем 70% от максимума
  
  const rules = [
    {
      make: () => {
        // Случайно выбираем направление сортировки
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        const sortFn = ascending ? (a, b) => a - b : (a, b) => b - a;
        
        // Генерируем гарантированные четные числа
        const guaranteed = Array.from({ length: 6 }, () => {
          const num = Utils.randomInt(minNum, maxGuaranteed);
          return num % 2 === 0 ? num : num + 1;
        });
        // Генерируем дополнительные числа
        const pool = Array.from({ length: 18 }, () => Utils.randomInt(minNum, maxNum));
        // Объединяем все числа
        const allNumbers = [...new Set([...guaranteed, ...pool])];
        // Находим ВСЕ четные числа из всех доступных чисел
        const allEvens = allNumbers.filter(n => n % 2 === 0).sort(sortFn);
        // Если четных меньше 4, добавляем еще гарантированных
        if (allEvens.length < 4) {
          const extra = Array.from({ length: 4 }, () => {
            const num = Utils.randomInt(minNum, maxGuaranteed);
            return num % 2 === 0 ? num : num + 1;
          });
          allNumbers.push(...extra);
          const finalEvens = [...new Set([...allEvens, ...extra])].filter(n => n % 2 === 0).sort(sortFn);
          const firstNumber = finalEvens[0];
          return { 
            numbers: Utils.shuffle(allNumbers), 
            sequence: finalEvens,
            text: `Выберите по ${direction} все четные числа, начиная с ${firstNumber}`
          };
        }
        const firstNumber = allEvens[0];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: allEvens,
          text: `Выберите по ${direction} все четные числа, начиная с ${firstNumber}`
        };
      },
    },
    {
      make: () => {
        // Случайно выбираем число от 2 до 9, на которое нужно искать кратные
        const multiplier = Utils.randomInt(2, 9);
        // Случайно выбираем направление сортировки
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        const sortFn = ascending ? (a, b) => a - b : (a, b) => b - a;
        
        // Генерируем гарантированные числа, кратные выбранному множителю
        const maxFactor = Math.floor(maxNum / multiplier);
        const guaranteed = Array.from({ length: 6 }, () => {
          const factor = Utils.randomInt(2, Math.min(15, maxFactor));
          return factor * multiplier;
        });
        // Генерируем дополнительные числа (могут быть кратны множителю или нет)
        const pool = Array.from({ length: 18 }, () => Utils.randomInt(5, maxNum));
        // Объединяем все числа
        const allNumbers = [...new Set([...guaranteed, ...pool])];
        // Находим ВСЕ числа, кратные выбранному множителю, из всех доступных чисел
        const allMultiples = allNumbers.filter(n => n % multiplier === 0).sort(sortFn);
        // Если кратных меньше 4, добавляем еще гарантированных
        if (allMultiples.length < 4) {
          const extra = Array.from({ length: 4 }, () => {
            const factor = Utils.randomInt(2, Math.min(15, maxFactor));
            return factor * multiplier;
          });
          allNumbers.push(...extra);
          const finalMultiples = [...new Set([...allMultiples, ...extra])].filter(n => n % multiplier === 0).sort(sortFn);
          const firstNumber = finalMultiples[0];
          return { 
            numbers: Utils.shuffle(allNumbers), 
            sequence: finalMultiples,
            text: `Выберите по ${direction} все числа, кратные ${multiplier}, начиная с ${firstNumber}`
          };
        }
        const firstNumber = allMultiples[0];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: allMultiples,
          text: `Выберите по ${direction} все числа, кратные ${multiplier}, начиная с ${firstNumber}`
        };
      },
    },
    {
      make: () => {
        // Генерируем минимальное число для прогрессии
        // Максимальный start зависит от сложности, чтобы последнее число не превышало maxNum
        const maxStart = Math.max(1, Math.floor((maxNum - 8) / 2));
        const start = Utils.randomInt(1, Math.min(8, maxStart));
        let seq = [start, start + 2, start + 4, start + 6, start + 8];
        
        // Случайно выбираем направление сортировки
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        
        // Если убывание, переворачиваем последовательность
        if (!ascending) {
          seq = seq.reverse();
        }
        
        const maxInSeq = Math.max(...seq);
        
        // Генерируем дополнительные числа, которые ВСЕ больше максимального числа в прогрессии
        // Это гарантирует, что первое число прогрессии будет минимальным (при возрастании)
        // или максимальным (при убывании)
        const noiseRange = Math.min(25, Math.floor(maxNum * 0.2)); // 20% от максимума, но не больше 25
        const noise = Array.from({ length: 15 }, () => {
          // Генерируем числа от maxInSeq + 1 до maxNum
          return Utils.randomInt(maxInSeq + 1, maxNum);
        });
        
        // Убеждаемся, что все числа последовательности есть в numbers
        const allNumbers = [...new Set([...seq, ...noise])];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: seq,
          text: `Выберите числа арифметической прогрессии (шаг 2) по ${direction}, начиная с ${ascending ? start : seq[0]}`
        };
      },
    },
    {
      make: () => {
        // Случайно выбираем направление сортировки
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        const sortFn = ascending ? (a, b) => a - b : (a, b) => b - a;
        
        // Гарантированные простые числа (расширяем список в зависимости от сложности)
        const basePrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        // Добавляем большие простые числа для среднего и сложного уровней
        const extendedPrimes = maxNum > 60 ? [...basePrimes, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97] : basePrimes;
        const veryExtendedPrimes = maxNum > 100 ? [...extendedPrimes, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149] : extendedPrimes;
        const guaranteed = veryExtendedPrimes.filter(p => p <= maxNum);
        // Выбираем случайные простые числа
        const selectedPrimes = Utils.shuffle(guaranteed).slice(0, 5);
        // Генерируем дополнительные числа (могут быть простыми или нет)
        const pool = Array.from({ length: 20 }, () => Utils.randomInt(minNum, maxNum));
        // Объединяем все числа
        const allNumbers = [...new Set([...selectedPrimes, ...pool])];
        // Находим ВСЕ простые числа из всех доступных чисел
        const allPrimes = allNumbers.filter((n) => Utils.isPrime(n)).sort(sortFn);
        // Если простых меньше 4, добавляем еще гарантированных
        if (allPrimes.length < 4) {
          const extra = Utils.shuffle(guaranteed).slice(0, 4);
          allNumbers.push(...extra);
          const finalPrimes = [...new Set([...allPrimes, ...extra])].filter((n) => Utils.isPrime(n)).sort(sortFn);
          const firstNumber = finalPrimes[0];
          return { 
            numbers: Utils.shuffle(allNumbers), 
            sequence: finalPrimes,
            text: `Выберите все простые числа по ${direction}, начиная с ${firstNumber}`
          };
        }
        const firstNumber = allPrimes[0];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: allPrimes,
          text: `Выберите все простые числа по ${direction}, начиная с ${firstNumber}`
        };
      },
    },
  ];
  const rule = rules[Utils.randomInt(0, rules.length - 1)];
  const result = rule.make();
  const text = result.text || rule.text;
  return { ruleText: text, numbers: result.numbers, sequence: result.sequence };
}

function renderLevel1() {
  const task = generateLevel1Task();
  state.expectedSequence = task.sequence;
  state.expectedIndex = 0;
  state.currentRuleHint = task.ruleText;
  elements.ruleTitle.textContent = task.ruleText;

  clearArea();
  const grid = Utils.createEl('div', 'grid');
  task.numbers.forEach((num) => {
    const card = Utils.createEl('div', 'card-number', num);
    card.dataset.value = num;
    card.addEventListener('click', () => {
      // Проверяем, что карточка еще не была выбрана
      if (card.classList.contains('correct')) {
        return; // Уже выбрана правильно
      }
      const expectedValue = state.expectedSequence[state.expectedIndex];
      if (expectedValue === num) {
        card.classList.add('correct');
        state.expectedIndex += 1;
        addScore(BASE_POINTS / 3);
        if (state.expectedIndex === state.expectedSequence.length) {
          setMessage(`Подуровень ${state.sublevel} пройден!`, 'success');
          setTimeout(() => completeSublevel(true), 500);
        } else {
          setMessage(`Правильно! Следующее: ${state.expectedSequence[state.expectedIndex]}`, 'success');
        }
      } else {
        card.classList.add('error');
        setTimeout(() => card.classList.remove('error'), 450);
        // Проверяем, может это число правильное, но не в том порядке
        if (state.expectedSequence.includes(num)) {
          setMessage(`Это число правильное, но нужно выбрать ${expectedValue}`, 'error');
        } else {
          setMessage(`Неправильно. Следующее: ${expectedValue}`, 'error');
        }
        applyPenalty();
      }
    });
    card.addEventListener('mouseover', () => {
      if (!card.classList.contains('correct')) {
        card.classList.add('hover');
      }
    });
    card.addEventListener('mouseout', () => card.classList.remove('hover'));
    grid.appendChild(card);
  });
  elements.gameArea.appendChild(grid);
}

// -------- Level 2 (движущиеся числа) ----------
function generateLevel2Task() {
  const rules = [
    {
      make: () => {
        const start = Utils.randomInt(2, 5);
        const seq = [start, start * 2, start * 4, start * 8].filter(n => n <= 100); // Ограничиваем максимальное значение
        // Генерируем дополнительные числа, исключая числа из последовательности
        const extras = Array.from({ length: 12 }, () => {
          let num = Utils.randomInt(1, 50);
          // Избегаем чисел из последовательности
          while (seq.includes(num)) {
            num = Utils.randomInt(1, 50);
          }
          return num;
        });
        // Убеждаемся, что все числа последовательности есть в numbers
        const allNumbers = [...new Set([...seq, ...extras])];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: seq,
          text: `Кликните числа геометрической прогрессии (знаменатель 2) по возрастанию, начиная с ${start}`
        };
      },
    },
    {
      make: () => {
        const start = Utils.randomInt(3, 15);
        const seq = [start, start + 1, start + 2, start + 3];
        // Генерируем дополнительные числа, исключая числа из последовательности
        const extras = Array.from({ length: 12 }, () => {
          let num = Utils.randomInt(2, 30);
          // Избегаем чисел из последовательности
          while (seq.includes(num)) {
            num = Utils.randomInt(2, 30);
          }
          return num;
        });
        // Убеждаемся, что все числа последовательности есть в numbers
        const allNumbers = [...new Set([...seq, ...extras])];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: seq,
          text: `Кликните подряд идущие числа по возрастанию, начиная с ${start}`
        };
      },
    },
    {
      make: () => {
        // Случайно выбираем число от 2 до 9, на которое нужно искать кратные
        const multiplier = Utils.randomInt(2, 9);
        // Случайно выбираем направление сортировки
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастания' : 'убывания';
        
        // Генерируем последовательность чисел, кратных выбранному множителю, строго по порядку
        // Берем последовательные множители для создания последовательности без пропусков
        const startFactor = Utils.randomInt(1, 8); // Начальный множитель
        const seqLength = 4; // Количество чисел в последовательности
        const seq = [];
        for (let i = 0; i < seqLength; i++) {
          seq.push((startFactor + i) * multiplier);
        }
        
        // Сортируем последовательность в зависимости от направления
        const sortedSeq = ascending ? [...seq] : [...seq].reverse();
        
        // Генерируем дополнительные числа (могут быть кратны множителю или нет)
        const extras = Array.from({ length: 12 }, () => {
          let num = Utils.randomInt(2, 60);
          // Избегаем чисел из последовательности
          while (seq.includes(num)) {
            num = Utils.randomInt(2, 60);
          }
          return num;
        });
        
        // Объединяем все числа
        const allNumbers = [...new Set([...seq, ...extras])];
        const firstNumber = sortedSeq[0];
        
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: sortedSeq,
          text: `Кликните числа, кратные ${multiplier}, в порядке ${direction}, начиная с ${firstNumber}`
        };
      },
    },
  ];
  const rule = rules[Utils.randomInt(0, rules.length - 1)];
  const result = rule.make();
  const text = result.text || rule.text;
  return { ruleText: text, numbers: Utils.shuffle(result.numbers), sequence: result.sequence };
}

function spawnFallingNumber(area, value, needed) {
  const node = Utils.createEl('div', 'falling-number', value);
  const diff = difficulties[state.difficulty] || difficulties.easy; // Fallback на easy
  const duration = Utils.clamp(diff.fallDuration - state.level * 0.5, 3.8, diff.fallDuration);
  node.style.left = `${Utils.randomInt(2, 88)}%`;
  node.style.animationDuration = `${duration}s`;
  node.dataset.value = value;
  node.dataset.needed = needed ? '1' : '0';
  // Сохраняем, какое число ожидается сейчас (для правильной проверки упущенных)
  node.dataset.expectedValue = state.expectedSequence[state.expectedIndex] || '';
  node.addEventListener('click', () => {
    handleFallingHit(node);
  });
  node.addEventListener('animationend', () => {
    // Проверяем, упущено ли нужное число, только если это было следующее ожидаемое число
    if (node.dataset.needed === '1' && node.dataset.expectedValue === String(value)) {
      setMessage('Упущено нужное число', 'error');
      applyPenalty();
    }
    node.remove();
  });
  area.appendChild(node);
}

function handleFallingHit(node) {
  // Проверяем, что узел еще не обработан
  if (node.dataset.processed === '1') return;
  node.dataset.processed = '1';
  
  const value = Number(node.dataset.value);
  const expectedValue = state.expectedSequence[state.expectedIndex];
  if (expectedValue === value) {
    node.remove();
    state.expectedIndex += 1;
    addScore(BASE_POINTS / 2);
    if (state.expectedIndex === state.expectedSequence.length) {
      setMessage(`Подуровень ${state.sublevel} пройден!`, 'success');
      setTimeout(() => completeSublevel(true), 500);
    } else {
      setMessage(`Правильно! Следующее: ${state.expectedSequence[state.expectedIndex]}`, 'success');
    }
  } else {
    node.classList.add('error');
    applyPenalty();
    // Проверяем, может это число правильное, но не в том порядке
    if (state.expectedSequence.includes(value)) {
      setMessage(`Это число правильное, но нужно выбрать ${expectedValue}`, 'error');
    } else {
      setMessage(`Неправильно. Следующее: ${expectedValue}`, 'error');
    }
    // Удаляем узел через небольшую задержку, чтобы визуально показать ошибку
    setTimeout(() => {
      if (node.parentNode) node.remove();
    }, 500);
  }
}

function renderLevel2() {
  const task = generateLevel2Task();
  state.expectedSequence = task.sequence;
  state.expectedIndex = 0;
  state.currentRuleHint = task.ruleText;
  elements.ruleTitle.textContent = task.ruleText;
  clearArea();

  const area = Utils.createEl('div', 'falling-area');
  elements.gameArea.appendChild(area);

  // Отслеживаем, какие нужные числа уже появились
  const spawnedNeeded = new Set();
  let spawnCount = 0;
  const maxSpawns = 100; // Увеличено для гарантии появления всех чисел
  const maxFallingAtOnce = 6; // Максимальное количество одновременно падающих чисел

  // Гарантируем появление всех нужных чисел через очередь
  const neededQueue = [...task.sequence]; // Очередь нужных чисел для гарантированного спавна
  let neededSpawnIndex = 0; // Индекс для гарантированного спавна нужных чисел
  let lastNeededSpawn = 0; // Счетчик спавнов с последнего нужного числа

  state.spawnId = setInterval(() => {
    spawnCount++;
    
    // Ограничиваем количество одновременно падающих чисел
    const currentlyFalling = area.querySelectorAll('.falling-number').length;
    if (currentlyFalling >= maxFallingAtOnce) {
      return; // Пропускаем спавн, если слишком много чисел падает
    }

    let value;
    let needed = false;
    
    // Гарантируем появление всех нужных чисел
    // Если прошло более 3 спавнов с последнего нужного числа, обязательно спавним следующее
    if (neededSpawnIndex < neededQueue.length && (lastNeededSpawn >= 3 || spawnCount % 5 === 0)) {
      value = neededQueue[neededSpawnIndex];
      needed = true;
      spawnedNeeded.add(value);
      neededSpawnIndex++;
      lastNeededSpawn = 0;
    } else {
      lastNeededSpawn++;
      // Обычный спавн
      const nextNeeded = state.expectedSequence[state.expectedIndex];
      const allNeededSpawned = state.expectedSequence.every(num => spawnedNeeded.has(num));
      
      if (!allNeededSpawned && nextNeeded && !spawnedNeeded.has(nextNeeded) && Math.random() < 0.6) {
        // 60% шанс спавнить следующее нужное число, если оно еще не появилось
        value = nextNeeded;
        needed = true;
        spawnedNeeded.add(value);
        lastNeededSpawn = 0;
      } else if (!allNeededSpawned && state.expectedSequence.some(num => !spawnedNeeded.has(num)) && Math.random() < 0.3) {
        // 30% шанс спавнить любое другое нужное число, которое еще не появилось
        const notSpawned = state.expectedSequence.filter(num => !spawnedNeeded.has(num));
        if (notSpawned.length > 0) {
          value = notSpawned[Utils.randomInt(0, notSpawned.length - 1)];
          needed = true;
          spawnedNeeded.add(value);
          lastNeededSpawn = 0;
        } else {
          // Если массив пуст, спавним случайное число
          value = task.numbers[Utils.randomInt(0, task.numbers.length - 1)];
          if (task.sequence.includes(value) && !spawnedNeeded.has(value)) {
            needed = true;
            spawnedNeeded.add(value);
            lastNeededSpawn = 0;
          }
        }
      } else {
        // Спавним случайное число (может быть нужным или нет)
        value = task.numbers[Utils.randomInt(0, task.numbers.length - 1)];
        if (task.sequence.includes(value) && !spawnedNeeded.has(value)) {
          needed = true;
          spawnedNeeded.add(value);
          lastNeededSpawn = 0;
        }
      }
    }
    
    spawnFallingNumber(area, value, needed);
    
    // Останавливаем спавн только если все нужные числа появились и прошло достаточно времени
    if (spawnCount >= maxSpawns && state.expectedSequence.every(num => spawnedNeeded.has(num))) {
      clearInterval(state.spawnId);
      state.spawnId = null;
    }
  }, (difficulties[state.difficulty] || difficulties.easy).spawn);

  // Убрана проверка столкновения с корзиной - теперь только клик по числам
  // cleanup не нужен, так как нет обработчиков клавиатуры
}

// -------- Level 3 (drag & drop выражение) ----------
// Функция для вычисления выражения с учетом приоритета операций
function evaluateExpression(num1, op1, num2, op2, num3) {
  // Проверка валидности операций
  const validOps = ['+', '-', '*', '/'];
  if (!validOps.includes(op1) || !validOps.includes(op2)) {
    console.error('Некорректная операция:', op1, op2);
    return null;
  }
  
  // Определяем приоритет операций
  const isHighPriority = (op) => op === '*' || op === '/';
  const isLowPriority = (op) => op === '+' || op === '-';
  
  // Если обе операции одинакового приоритета, вычисляем слева направо
  // Если приоритеты разные, сначала выполняем операцию с высоким приоритетом
  
  let result;
  
  // Если первая операция высокого приоритета, а вторая низкого
  if (isHighPriority(op1) && isLowPriority(op2)) {
    // Сначала выполняем op1, потом op2
    let step1;
    if (op1 === '*') step1 = num1 * num2;
    else if (op1 === '/') {
      if (num2 === 0) return null; // Деление на ноль
      step1 = num1 / num2;
    }
    
    if (op2 === '+') result = step1 + num3;
    else if (op2 === '-') result = step1 - num3;
  }
  // Если вторая операция высокого приоритета, а первая низкого
  else if (isLowPriority(op1) && isHighPriority(op2)) {
    // Сначала выполняем op2, потом op1
    let step1;
    if (op2 === '*') step1 = num2 * num3;
    else if (op2 === '/') {
      if (num3 === 0) return null; // Деление на ноль
      step1 = num2 / num3;
    }
    
    if (op1 === '+') result = num1 + step1;
    else if (op1 === '-') result = num1 - step1;
  }
  // Если обе операции одинакового приоритета, вычисляем слева направо
  else {
    let step1;
    if (op1 === '+') step1 = num1 + num2;
    else if (op1 === '-') step1 = num1 - num2;
    else if (op1 === '*') step1 = num1 * num2;
    else if (op1 === '/') {
      if (num2 === 0) return null; // Деление на ноль
      step1 = num1 / num2;
    }
    
    if (op2 === '+') result = step1 + num3;
    else if (op2 === '-') result = step1 - num3;
    else if (op2 === '*') result = step1 * num3;
    else if (op2 === '/') {
      if (num3 === 0) return null; // Деление на ноль
      result = step1 / num3;
    }
  }
  
  return Math.round(result * 100) / 100; // Округляем до 2 знаков
}

// Функция для форматирования выражения со скобками (если нужно)
function formatExpression(num1, op1, num2, op2, num3) {
  const isHighPriority = (op) => op === '*' || op === '/';
  const isLowPriority = (op) => op === '+' || op === '-';
  
  // Если первая операция высокого приоритета, а вторая низкого
  if (isHighPriority(op1) && isLowPriority(op2)) {
    return `${num1} ${op1} ${num2} ${op2} ${num3}`;
  }
  // Если вторая операция высокого приоритета, а первая низкого
  else if (isLowPriority(op1) && isHighPriority(op2)) {
    return `${num1} ${op1} (${num2} ${op2} ${num3})`;
  }
  // Если обе операции одинакового приоритета
  else {
    return `${num1} ${op1} ${num2} ${op2} ${num3}`;
  }
}

function generateExpressionTask() {
  // Получаем диапазоны чисел в зависимости от сложности
  const maxNum = state.difficulty ? difficulties[state.difficulty].maxNumber : 60;
  let minNum, maxNumRange, allowDivision;
  
  if (state.difficulty === 'easy') {
    minNum = 1;
    maxNumRange = 12; // Легкий: числа от 1 до 12
    allowDivision = false; // На легком уровне без деления
  } else if (state.difficulty === 'medium') {
    minNum = 1;
    maxNumRange = 25; // Средний: числа от 1 до 25
    allowDivision = true; // На среднем уровне с делением
  } else if (state.difficulty === 'hard') {
    minNum = 5;
    maxNumRange = 50; // Сложный: числа от 5 до 50
    allowDivision = true; // На сложном уровне с делением
  } else {
    // По умолчанию (если сложность не выбрана)
    minNum = 1;
    maxNumRange = 12;
    allowDivision = false;
  }

  // Генерируем решаемое выражение
  let a, b, c, op1, op2, target;
  let attempts = 0;
  const maxAttempts = 50;

  do {
    // Выбираем операции
    if (allowDivision) {
      op1 = ['+', '-', '*', '/'][Utils.randomInt(0, 3)];
      op2 = ['+', '-', '*', '/'][Utils.randomInt(0, 3)];
    } else {
      // Без деления на легком уровне
      op1 = ['+', '-', '*'][Utils.randomInt(0, 2)];
      op2 = ['+', '-', '*'][Utils.randomInt(0, 2)];
    }

    // Генерируем числа с учетом операций
    a = Utils.randomInt(minNum, maxNumRange);
    
    if (op1 === '/') {
      // Для деления: b должно быть делителем a, чтобы результат был целым
      const divisors = [];
      for (let i = 1; i <= a; i++) {
        if (a % i === 0 && i >= minNum && i <= maxNumRange) {
          divisors.push(i);
        }
      }
      if (divisors.length === 0) {
        b = Utils.randomInt(minNum, Math.min(a, maxNumRange));
      } else {
        b = divisors[Utils.randomInt(0, divisors.length - 1)];
      }
    } else {
      b = Utils.randomInt(minNum, maxNumRange);
    }

    // Генерируем c
    c = Utils.randomInt(minNum, maxNumRange);
    
    // Вычисляем результат с учетом приоритета операций
    target = evaluateExpression(a, op1, b, op2, c);
    
    // Проверяем на деление на ноль
    if (target === null) {
      attempts++;
      continue;
    }
    
    // Если есть деление, проверяем, что результат разумен
    if (op1 === '/' || op2 === '/') {
      // Для деления стараемся получить целые результаты
      if (!Number.isInteger(target) && target % 1 > 0.01) {
        attempts++;
        continue;
      }
    }

    // Проверяем, что результат разумен и не слишком сложный
    if (target < 0 || target > maxNumRange * 3) {
      attempts++;
      continue;
    }

    // Округляем до 2 знаков после запятой
    target = Math.round(target * 100) / 100;

    // Проверяем, что результат не слишком сложная дробь (максимум 2 знака)
    if (target % 1 !== 0 && (target * 100) % 1 !== 0) {
      attempts++;
      continue;
    }

    break;
  } while (attempts < maxAttempts);

  // Если не удалось сгенерировать за maxAttempts попыток, используем простой вариант
  if (attempts >= maxAttempts) {
    a = Utils.randomInt(2, 10);
    b = Utils.randomInt(1, 9);
    c = Utils.randomInt(1, 9);
    op1 = ['+', '-'][Utils.randomInt(0, 1)];
    op2 = ['+', '-'][Utils.randomInt(0, 1)];
    target = evaluateExpression(a, op1, b, op2, c);
    if (target === null) {
      // Если все равно деление на ноль, используем только сложение
      op1 = '+';
      op2 = '+';
      target = a + b + c;
    }
  }

  // Гарантируем, что a, b, c всегда в пуле чисел
  // Добавляем несколько случайных чисел для отвлечения
  const extraNumbers = [];
  const numExtra = state.difficulty === 'hard' ? 3 : 2;
  for (let i = 0; i < numExtra; i++) {
    let extra;
    do {
      extra = Utils.randomInt(minNum, maxNumRange);
    } while (extra === a || extra === b || extra === c || extraNumbers.includes(extra));
    extraNumbers.push(extra);
  }

  const numbers = Utils.shuffle([a, b, c, ...extraNumbers]);
  
  // Добавляем лишние операции
  const allOps = ['+', '-', '*'];
  if (allowDivision) allOps.push('/');
  const extraOps = [];
  for (let i = 0; i < 2; i++) {
    const op = allOps[Utils.randomInt(0, allOps.length - 1)];
    if (op !== op1 && op !== op2 && !extraOps.includes(op)) {
      extraOps.push(op);
    }
  }
  const ops = Utils.shuffle([op1, op2, ...extraOps]);

  return {
    target,
    numbers,
    ops,
    solution: { a, b, c, op1, op2 },
    ruleText: `Составьте выражение = ${target}`,
  };
}

function renderLevel3() {
  const task = generateExpressionTask();
  state.currentRuleHint = 'Перетащите числа и операции в слоты, ПКМ — меню';
  elements.ruleTitle.textContent = task.ruleText;
  clearArea();

  const numbersRow = Utils.createEl('div', 'grid');
  const opsRow = Utils.createEl('div', 'grid');
  const slots = Utils.createEl('div', 'slots');
  const contextMenu = Utils.createEl('div', 'context-menu');
  contextMenu.innerHTML = `
    <button data-action="clear">Очистить слот</button>
    <button data-action="hint">Подсказка</button>
  `;
  elements.gameArea.appendChild(contextMenu);

  const slotItems = [
    { type: 'number', label: 'Число 1' },
    { type: 'op', label: 'Операция 1' },
    { type: 'number', label: 'Число 2' },
    { type: 'op', label: 'Операция 2' },
    { type: 'number', label: 'Число 3' },
  ];

  const cardRegistry = {};

  function createCard(type, value) {
    const card = Utils.createEl('div', 'draggable', value);
    card.draggable = true;
    card.dataset.type = type;
    const id = `${type}-${Math.random().toString(16).slice(2)}`;
    card.dataset.id = id;
    cardRegistry[id] = card;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ id, type, value }));
    });
    card.addEventListener('mouseover', () => card.classList.add('hover'));
    card.addEventListener('mouseout', () => card.classList.remove('hover'));
    return card;
  }

  task.numbers.forEach((n) => numbersRow.appendChild(createCard('number', n)));
  task.ops.forEach((o) => opsRow.appendChild(createCard('op', o)));

  // Функция для возврата элемента в исходную область
  function returnCardToSource(cardId) {
    const card = cardRegistry[cardId];
    if (!card) return;
    
    // Убираем disabled класс и восстанавливаем draggable
    card.classList.remove('disabled');
    card.draggable = true;
    
    // Возвращаем карточку в соответствующую исходную область
    if (card.dataset.type === 'number') {
      numbersRow.appendChild(card);
    } else if (card.dataset.type === 'op') {
      opsRow.appendChild(card);
    }
  }

  // Делаем исходные области зонами drop для возврата элементов
  function setupReturnZone(container) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('highlight');
    });
    container.addEventListener('dragleave', () => {
      container.classList.remove('highlight');
    });
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('highlight');
      let data;
      try {
        data = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch (err) {
        console.error('Ошибка парсинга данных drag & drop:', err);
        return;
      }
      const card = cardRegistry[data.id];
      
      // Проверяем, что элемент действительно был в слоте
      if (card && card.classList.contains('disabled')) {
        // Находим слот, в котором был этот элемент, и очищаем его
        slotElements.forEach(slot => {
          if (slot.dataset.cardId === data.id) {
            slot.textContent = slotItems[slotElements.indexOf(slot)].label;
            delete slot.dataset.cardId;
            delete slot.dataset.value;
          }
        });
        
        // Возвращаем элемент в исходную область
        returnCardToSource(data.id);
      }
    });
  }

  setupReturnZone(numbersRow);
  setupReturnZone(opsRow);

  const slotElements = slotItems.map((item) => {
    const slot = Utils.createEl('div', 'slot', item.label);
    slot.dataset.type = item.type;
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('highlight');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('highlight'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('highlight');
      let data;
      try {
        data = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch (err) {
        console.error('Ошибка парсинга данных drag & drop:', err);
        return;
      }
      if (data.type !== item.type) {
        slot.classList.add('error');
        setTimeout(() => slot.classList.remove('error'), 400);
        return;
      }
      
      // Если в слоте уже был элемент, возвращаем его обратно
      if (slot.dataset.cardId) {
        returnCardToSource(slot.dataset.cardId);
      }
      
      // Помещаем новый элемент в слот
      slot.textContent = data.value;
      slot.dataset.cardId = data.id;
      slot.dataset.value = data.value;
      const card = cardRegistry[data.id];
      card.classList.add('disabled');
      card.draggable = false;
    });

    // Обработчик клика для возврата элемента в исходную область
    slot.addEventListener('click', (e) => {
      // Проверяем, что клик был по самому слоту, а не по дочерним элементам
      if (e.target === slot && slot.dataset.cardId) {
        const cardId = slot.dataset.cardId;
        returnCardToSource(cardId);
        slot.textContent = item.label;
        delete slot.dataset.cardId;
        delete slot.dataset.value;
      }
    });

    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenu.style.left = `${e.clientX}px`;
      contextMenu.style.top = `${e.clientY}px`;
      contextMenu.classList.add('open');
      contextMenu.dataset.slotId = slotItems.indexOf(item);
    });
    return slot;
  });

  slotElements.forEach((s) => slots.appendChild(s));

  // Создаем контейнер для кнопки с отступом
  const checkBtnContainer = Utils.createEl('div', 'check-btn-container');
  const checkBtn = Utils.createEl('button', 'btn btn--primary', 'Проверить выражение');
  checkBtnContainer.appendChild(checkBtn);
  checkBtn.addEventListener('click', () => {
    const values = slotElements.map((slot) => slot.dataset.value);
    if (values.some((v) => v === undefined || v === '')) {
      setMessage('Заполните все слоты', 'error');
      return;
    }
    const [v1, op1, v2, op2, v3] = values.map(v => String(v).trim());
    
    // Безопасное вычисление выражения
    let result;
    try {
      const num1 = parseFloat(v1);
      const num2 = parseFloat(v2);
      const num3 = parseFloat(v3);
      
      if (isNaN(num1) || isNaN(num2) || isNaN(num3)) {
        setMessage('Некорректные числа', 'error');
        return;
      }
      
      // Вычисляем выражение с учетом приоритета операций
      result = evaluateExpression(num1, op1, num2, op2, num3);
      
      if (result === null) {
        setMessage('Деление на ноль!', 'error');
        return;
      }
    } catch (e) {
      setMessage('Ошибка вычисления: ' + e.message, 'error');
      return;
    }
    
    if (Math.abs(result - task.target) < 0.01) {
      addScore(BASE_POINTS);
      setMessage(`Подуровень ${state.sublevel} пройден!`, 'success');
      setTimeout(() => completeSublevel(true), 500);
    } else {
      applyPenalty();
      // Формируем правильное решение для показа (со скобками, если нужно)
      const solution = task.solution;
      const correctExpression = formatExpression(solution.a, solution.op1, solution.b, solution.op2, solution.c);
      setMessage(`Неверно, получилось ${result}, нужно ${task.target}. Правильное решение: ${correctExpression} = ${task.target}`, 'error');
    }
  });

  contextMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const slotIndex = Number(contextMenu.dataset.slotId);
    const slot = slotElements[slotIndex];
    if (btn.dataset.action === 'clear') {
      const cardId = slot.dataset.cardId;
      if (cardId) {
        returnCardToSource(cardId);
      }
      slot.textContent = slotItems[slotIndex].label;
      delete slot.dataset.cardId;
      delete slot.dataset.value;
    }
    if (btn.dataset.action === 'hint') {
      alert(slot.dataset.type === 'number' ? 'Здесь должно быть число' : 'Здесь должна быть операция');
    }
    contextMenu.classList.remove('open');
  });

  const closeMenu = (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.classList.remove('open');
    }
  };
  document.addEventListener('click', closeMenu);

  elements.gameArea.appendChild(numbersRow);
  elements.gameArea.appendChild(opsRow);
  elements.gameArea.appendChild(slots);
  elements.gameArea.appendChild(checkBtnContainer);

  elements.gameArea.cleanup = () => document.removeEventListener('click', closeMenu);
}

// -------- Управление прогрессом ----------
function completeSublevel(success) {
  resetTimers();
  if (elements.gameArea.cleanup) {
    elements.gameArea.cleanup();
    delete elements.gameArea.cleanup;
  }
  // Сбрасываем состояние для следующего подуровня
  state.expectedIndex = 0;
  state.expectedSequence = [];
  
  if (!success) {
    setMessage('Подуровень провален. Попробуйте снова', 'error');
    setTimeout(() => startSublevel(state.level, state.sublevel), 1500);
    return;
  }
  const diff = difficulties[state.difficulty] || difficulties.easy;
  const timeBonus = Math.max(0, Math.round(state.timeLeft * diff.multiplier));
  if (timeBonus) {
    addScore(timeBonus);
    setMessage(`Бонус за время: +${timeBonus}`, 'success');
  }
  if (state.sublevel < SUBLEVELS_PER_LEVEL) {
    state.sublevel += 1;
    setTimeout(() => startSublevel(state.level, state.sublevel), 1500);
  } else if (state.level < 3) {
    state.allowLevels = Math.max(state.allowLevels, state.level + 1);
    state.level += 1;
    state.sublevel = 1;
    setTimeout(() => startSublevel(state.level, state.sublevel), 1500);
  } else {
    setTimeout(() => finishGame('win'), 1500);
  }
}

function startSublevel(level, sublevel) {
  if (level > state.allowLevels) {
    setMessage('Сначала завершите предыдущий уровень', 'error');
    return;
  }
  // Сбрасываем состояние перед началом подуровня
  state.level = level;
  state.sublevel = sublevel;
  state.expectedIndex = 0;
  state.expectedSequence = [];
  resetTimers();
  clearArea();
  
  if (!state.difficulty) state.difficulty = 'easy';
  const diff = difficulties[state.difficulty] || difficulties.easy;
  const time = Math.max(25, diff.time - (level - 1) * 5);
  startTimer(time, () => {
    setMessage('Время вышло!', 'error');
    completeSublevel(false);
  });

  if (level === 1) renderLevel1();
  else if (level === 2) renderLevel2();
  else if (level === 3) renderLevel3();
  updateHUD();
}

function selectDifficulty(diff) {
  state.difficulty = diff;
  state.score = 0;
  state.level = 1;
  state.sublevel = 1;
  state.allowLevels = 1;
  elements.ruleTitle.textContent = 'Приготовьтесь! Начинаем с уровня 1';
  // Скрываем панель выбора сложности
  elements.difficultyPanel.classList.add('hidden');
  // Скрываем весь блок-карточку с выбором сложности
  const difficultyCard = elements.difficultyPanel.closest('.card');
  if (difficultyCard) {
    difficultyCard.classList.add('hidden');
  }
  setTimeout(() => startSublevel(1, 1), 500);
  updateHUD();
}

function bindUI() {
  if (elements.difficultyPanel) {
    elements.difficultyPanel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-diff]');
      if (!btn) return;
      selectDifficulty(btn.dataset.diff);
    });
  }

  if (elements.hintBtn) {
    elements.hintBtn.addEventListener('dblclick', () => {
      if (state.currentRuleHint) {
        alert(state.currentRuleHint);
      }
    });
  }

  if (elements.devSkip) {
    elements.devSkip.addEventListener('change', (e) => {
      const targetLevel = Number(e.target.value);
      if (!state.difficulty) state.difficulty = 'easy';
      state.allowLevels = 3;
      startSublevel(targetLevel, 1);
    });
  }

  if (elements.exitBtn) {
    elements.exitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Подтверждение выхода, если игра начата
      if (state.difficulty && state.score > 0) {
        if (confirm('Вы уверены, что хотите выйти? Результат не будет сохранен.')) {
          exitToMenu();
        }
      } else {
        exitToMenu();
      }
    });
  }
  
  if (elements.finishBtn) {
    elements.finishBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Завершение игры');
      finishGame('manual');
    });
  }
}

function init() {
  guardPlayer();
  bindUI();
  updateHUD();
}

document.addEventListener('DOMContentLoaded', init);

