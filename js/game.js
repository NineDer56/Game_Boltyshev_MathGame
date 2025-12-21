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
  platform: null,
  platformPosition: 50,
  keys: { left: false, right: false },
};

function resetTimers() {
  if (state.timerId) clearInterval(state.timerId);
  if (state.spawnId) clearInterval(state.spawnId);
  if (state.collisionId) clearInterval(state.collisionId);
  state.timerId = null;
  state.spawnId = null;
  state.collisionId = null;
  state.platform = null;
  state.platformPosition = 50;
  state.keys.left = false;
  state.keys.right = false;
}

function setMessage(text, type = 'info') {
  const el = Utils.createEl('div', `message ${type === 'success' ? 'message--success' : type === 'error' ? 'message--error' : ''}`, text);
  elements.messages.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

function updateHUD() {
  if (hud.player) hud.player.textContent = state.player || '---';
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
  if (elements.playerNameTitle) {
    elements.playerNameTitle.textContent = player;
  }
  if (hud.player) {
    hud.player.textContent = player;
  }
}

function generateLevel1Task() {
  const maxNum = state.difficulty ? difficulties[state.difficulty].maxNumber : 60;
  const minNum = 2;
  const maxGuaranteed = Math.floor(maxNum * 0.7);
  
  const rules = [
    {
      make: () => {
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        const sortFn = ascending ? (a, b) => a - b : (a, b) => b - a;
        
        const guaranteed = Array.from({ length: 6 }, () => {
          const num = Utils.randomInt(minNum, maxGuaranteed);
          return num % 2 === 0 ? num : num + 1;
        });
        const pool = Array.from({ length: 18 }, () => Utils.randomInt(minNum, maxNum));
        const allNumbers = [...new Set([...guaranteed, ...pool])];
        const allEvens = allNumbers.filter(n => n % 2 === 0).sort(sortFn);
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
        const multiplier = Utils.randomInt(2, 9);
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        const sortFn = ascending ? (a, b) => a - b : (a, b) => b - a;
        
        const maxFactor = Math.floor(maxNum / multiplier);
        const guaranteed = Array.from({ length: 6 }, () => {
          const factor = Utils.randomInt(2, Math.min(15, maxFactor));
          return factor * multiplier;
        });
        const pool = Array.from({ length: 18 }, () => Utils.randomInt(5, maxNum));
        const allNumbers = [...new Set([...guaranteed, ...pool])];
        const allMultiples = allNumbers.filter(n => n % multiplier === 0).sort(sortFn);
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
        const maxStart = Math.max(1, Math.floor((maxNum - 8) / 2));
        const start = Utils.randomInt(1, Math.min(8, maxStart));
        let seq = [start, start + 2, start + 4, start + 6, start + 8];
        
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        
        if (!ascending) {
          seq = seq.reverse();
        }
        
        const maxInSeq = Math.max(...seq);
        
        const noiseRange = Math.min(25, Math.floor(maxNum * 0.2));
        const noise = Array.from({ length: 15 }, () => {
          return Utils.randomInt(maxInSeq + 1, maxNum);
        });
        
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
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастанию' : 'убыванию';
        const sortFn = ascending ? (a, b) => a - b : (a, b) => b - a;
        
        const basePrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        const extendedPrimes = maxNum > 60 ? [...basePrimes, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97] : basePrimes;
        const veryExtendedPrimes = maxNum > 100 ? [...extendedPrimes, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149] : extendedPrimes;
        const guaranteed = veryExtendedPrimes.filter(p => p <= maxNum);
        const selectedPrimes = Utils.shuffle(guaranteed).slice(0, 5);
        const pool = Array.from({ length: 20 }, () => Utils.randomInt(minNum, maxNum));
        const allNumbers = [...new Set([...selectedPrimes, ...pool])];
        const allPrimes = allNumbers.filter((n) => Utils.isPrime(n)).sort(sortFn);
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
  if (elements.ruleTitle) {
    elements.ruleTitle.textContent = task.ruleText;
  }

  clearArea();
  const grid = Utils.createEl('div', 'grid');
  task.numbers.forEach((num) => {
    const card = Utils.createEl('div', 'card-number', num);
    card.dataset.value = num;
    card.addEventListener('click', () => {
      if (card.classList.contains('correct')) {
        return;
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

function generateLevel2Task() {
  const rules = [
    {
      make: () => {
        const start = Utils.randomInt(2, 5);
        const seq = [start, start * 2, start * 4, start * 8].filter(n => n <= 100);
        const extras = Array.from({ length: 12 }, () => {
          let num = Utils.randomInt(1, 50);
          while (seq.includes(num)) {
            num = Utils.randomInt(1, 50);
          }
          return num;
        });
        const allNumbers = [...new Set([...seq, ...extras])];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: seq,
          text: `Поймайте числа геометрической прогрессии (знаменатель 2) по возрастанию, начиная с ${start}`
        };
      },
    },
    {
      make: () => {
        const start = Utils.randomInt(3, 15);
        const seq = [start, start + 1, start + 2, start + 3];
        const extras = Array.from({ length: 12 }, () => {
          let num = Utils.randomInt(2, 30);
          while (seq.includes(num)) {
            num = Utils.randomInt(2, 30);
          }
          return num;
        });
        const allNumbers = [...new Set([...seq, ...extras])];
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: seq,
          text: `Поймайте подряд идущие числа по возрастанию, начиная с ${start}`
        };
      },
    },
    {
      make: () => {
        const multiplier = Utils.randomInt(2, 9);
        const ascending = Math.random() < 0.5;
        const direction = ascending ? 'возрастания' : 'убывания';
        
        const startFactor = Utils.randomInt(1, 8);
        const seqLength = 4;
        const seq = [];
        for (let i = 0; i < seqLength; i++) {
          seq.push((startFactor + i) * multiplier);
        }
        
        const sortedSeq = ascending ? [...seq] : [...seq].reverse();
        
        const extras = Array.from({ length: 12 }, () => {
          let num = Utils.randomInt(2, 60);
          while (seq.includes(num)) {
            num = Utils.randomInt(2, 60);
          }
          return num;
        });
        
        const allNumbers = [...new Set([...seq, ...extras])];
        const firstNumber = sortedSeq[0];
        
        return { 
          numbers: Utils.shuffle(allNumbers), 
          sequence: sortedSeq,
          text: `Поймайте числа, кратные ${multiplier}, в порядке ${direction}, начиная с ${firstNumber}`
        };
      },
    },
  ];
  const rule = rules[Utils.randomInt(0, rules.length - 1)];
  const result = rule.make();
  const text = result.text || rule.text;
  return { ruleText: text, numbers: result.numbers, sequence: result.sequence };
}

function findFreePosition(area, minDistance = 18) {
  const existingNumbers = area.querySelectorAll('.falling-number');
  const occupiedPositions = [];
  
  existingNumbers.forEach(num => {
    const leftPercent = parseFloat(num.style.left);
    if (!isNaN(leftPercent)) {
      occupiedPositions.push(leftPercent);
    }
  });
  
  if (occupiedPositions.length === 0) {
    return Utils.randomInt(2, 88);
  }
  
  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = Utils.randomInt(2, 88);
    let isFree = true;
    
    for (const occupied of occupiedPositions) {
      if (Math.abs(candidate - occupied) < minDistance) {
        isFree = false;
        break;
      }
    }
    
    if (isFree) {
      return candidate;
    }
  }
  
  let bestPosition = 2;
  let maxMinDistance = 0;
  
  for (let pos = 2; pos <= 88; pos += 2) {
    let minDistanceToOthers = Infinity;
    for (const occupied of occupiedPositions) {
      const distance = Math.abs(pos - occupied);
      if (distance < minDistanceToOthers) {
        minDistanceToOthers = distance;
      }
    }
    if (minDistanceToOthers > maxMinDistance) {
      maxMinDistance = minDistanceToOthers;
      bestPosition = pos;
    }
  }
  
  return bestPosition;
}

function spawnFallingNumber(area, value, needed) {
  const node = Utils.createEl('div', 'falling-number', value);
  const diff = difficulties[state.difficulty] || difficulties.easy;
  const baseDuration = Utils.clamp(diff.fallDuration - state.level * 0.5, 3.8, diff.fallDuration);
  
  const speedVariation = 1 + (Math.random() * 0.6 - 0.3); 
  const duration = baseDuration * speedVariation;
  
  const minDuration = Math.max(2.5, baseDuration * 0.7);
  const maxDuration = Math.min(12, baseDuration * 1.3);
  const finalDuration = Utils.clamp(duration, minDuration, maxDuration);
  
  const leftPosition = findFreePosition(area, 18);
  
  node.style.left = `${leftPosition}%`;
  node.style.animationDuration = `${finalDuration}s`;
  node.dataset.value = value;
  node.dataset.needed = needed ? '1' : '0';
  node.dataset.expectedValue = state.expectedSequence[state.expectedIndex] || '';
  node.addEventListener('animationend', () => {
    if (node.dataset.needed === '1' && node.dataset.expectedValue === String(value)) {
      setMessage('Упущено нужное число', 'error');
      applyPenalty();
    }
    node.remove();
  });
  area.appendChild(node);
}

function handleFallingHit(node) {
  if (node.dataset.processed === '1') return;
  node.dataset.processed = '1';
  
  const value = Number(node.dataset.value);
  const expectedValue = state.expectedSequence[state.expectedIndex];
  if (expectedValue === value) {
    moveNumberToAnswersRow(node, value, state.expectedIndex);
    
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
    if (state.expectedSequence.includes(value)) {
      setMessage(`Это число правильное, но нужно выбрать ${expectedValue}`, 'error');
    } else {
      setMessage(`Неправильно. Следующее: ${expectedValue}`, 'error');
    }
    setTimeout(() => {
      if (node.parentNode) node.remove();
    }, 500);
  }
}

function createPlatform(area) {
  const platform = Utils.createEl('div', 'platform');
  platform.style.left = `${state.platformPosition}%`;
  area.appendChild(platform);
  state.platform = platform;
  return platform;
}

function handleKeyDown(e) {
  if (state.level !== 2 || !state.platform) return;
  
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    state.keys.left = true;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    state.keys.right = true;
  }
}

function handleKeyUp(e) {
  if (state.level !== 2 || !state.platform) return;
  
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    state.keys.left = false;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    state.keys.right = false;
  }
}

function updatePlatform() {
  if (!state.platform || state.level !== 2) return;
  
  const speed = 2;
  if (state.keys.left) {
    state.platformPosition = Math.max(5, state.platformPosition - speed);
  }
  if (state.keys.right) {
    state.platformPosition = Math.min(95, state.platformPosition + speed);
  }
  
  state.platform.style.left = `${state.platformPosition}%`;
}

function checkCollisions(area) {
  if (!state.platform || state.level !== 2) return;
  
  const platformRect = state.platform.getBoundingClientRect();
  const fallingNumbers = area.querySelectorAll('.falling-number:not([data-processed="1"])');
  
  fallingNumbers.forEach(node => {
    const nodeRect = node.getBoundingClientRect();
    
    if (
      nodeRect.bottom >= platformRect.top &&
      nodeRect.top <= platformRect.bottom &&
      nodeRect.right >= platformRect.left &&
      nodeRect.left <= platformRect.right
    ) {
      handleFallingHit(node);
    }
  });
}

function moveNumberToAnswersRow(node, value, index) {
  const answersRow = elements.gameArea.querySelector('.answers-row');
  if (!answersRow) return;
  
  const answerSlot = answersRow.querySelector(`[data-index="${index}"]`);
  if (!answerSlot) return;
  
  if (!node.parentNode) return;
  
  const nodeRect = node.getBoundingClientRect();
  const slotRect = answerSlot.getBoundingClientRect();
  
  const deltaX = slotRect.left + slotRect.width / 2 - (nodeRect.left + nodeRect.width / 2);
  const deltaY = slotRect.top + slotRect.height / 2 - (nodeRect.top + nodeRect.height / 2);
  
  const clone = node.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.left = `${nodeRect.left}px`;
  clone.style.top = `${nodeRect.top}px`;
  clone.style.width = `${nodeRect.width}px`;
  clone.style.height = `${nodeRect.height}px`;
  clone.style.zIndex = '1000';
  clone.style.pointerEvents = 'none';
  clone.style.animation = 'none';
  clone.style.transition = 'all 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  document.body.appendChild(clone);
  
  node.remove();
  
  requestAnimationFrame(() => {
    clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.9)`;
    clone.style.opacity = '0.9';
  });
  
  setTimeout(() => {
    answerSlot.textContent = value;
    answerSlot.classList.add('filled');
    clone.remove();
  }, 500);
}

function renderLevel2() {
  const task = generateLevel2Task();
  state.expectedSequence = task.sequence;
  state.expectedIndex = 0;
  state.currentRuleHint = task.ruleText;
  if (elements.ruleTitle) {
    elements.ruleTitle.textContent = task.ruleText;
  }
  clearArea();

  const answersRow = Utils.createEl('div', 'answers-row visible');
  for (let i = 0; i < task.sequence.length; i++) {
    const answerSlot = Utils.createEl('div', 'answer-slot', '');
    answerSlot.dataset.index = i;
    answersRow.appendChild(answerSlot);
  }
  elements.gameArea.appendChild(answersRow);

  const area = Utils.createEl('div', 'falling-area');
  elements.gameArea.appendChild(area);

  createPlatform(area);
  state.platformPosition = 50;

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  elements.gameArea.cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    if (state.collisionId) {
      clearInterval(state.collisionId);
      state.collisionId = null;
    }
  };

  const gameLoop = () => {
    if (state.level !== 2 || !state.platform) return;
    updatePlatform();
    checkCollisions(area);
  };
  state.collisionId = setInterval(gameLoop, 16);

  const spawnedNeeded = new Set();
  let spawnCount = 0;
  const maxSpawns = 100;
  const maxFallingAtOnce = 6;

  const neededQueue = [...task.sequence];
  let neededSpawnIndex = 0;
  let lastNeededSpawn = 0;

  state.spawnId = setInterval(() => {
    spawnCount++;
    
    const currentlyFalling = area.querySelectorAll('.falling-number').length;
    if (currentlyFalling >= maxFallingAtOnce) {
      return;
    }

    let value;
    let needed = false;
    
    if (neededSpawnIndex < neededQueue.length && (lastNeededSpawn >= 3 || spawnCount % 5 === 0)) {
      value = neededQueue[neededSpawnIndex];
      needed = true;
      spawnedNeeded.add(value);
      neededSpawnIndex++;
      lastNeededSpawn = 0;
    } else {
      lastNeededSpawn++;
      const nextNeeded = state.expectedSequence[state.expectedIndex];
      const allNeededSpawned = state.expectedSequence.every(num => spawnedNeeded.has(num));
      
      if (!allNeededSpawned && nextNeeded && !spawnedNeeded.has(nextNeeded) && Math.random() < 0.6) {
        value = nextNeeded;
        needed = true;
        spawnedNeeded.add(value);
        lastNeededSpawn = 0;
      } else if (!allNeededSpawned && state.expectedSequence.some(num => !spawnedNeeded.has(num)) && Math.random() < 0.3) {
        const notSpawned = state.expectedSequence.filter(num => !spawnedNeeded.has(num));
        if (notSpawned.length > 0) {
          value = notSpawned[Utils.randomInt(0, notSpawned.length - 1)];
          needed = true;
          spawnedNeeded.add(value);
          lastNeededSpawn = 0;
        } else {
          value = task.numbers[Utils.randomInt(0, task.numbers.length - 1)];
          if (task.sequence.includes(value) && !spawnedNeeded.has(value)) {
            needed = true;
            spawnedNeeded.add(value);
            lastNeededSpawn = 0;
          }
        }
      } else {
        value = task.numbers[Utils.randomInt(0, task.numbers.length - 1)];
        if (task.sequence.includes(value) && !spawnedNeeded.has(value)) {
          needed = true;
          spawnedNeeded.add(value);
          lastNeededSpawn = 0;
        }
      }
    }
    
    spawnFallingNumber(area, value, needed);
    
    if (spawnCount >= maxSpawns && state.expectedSequence.every(num => spawnedNeeded.has(num))) {
      clearInterval(state.spawnId);
      state.spawnId = null;
    }
  }, (difficulties[state.difficulty] || difficulties.easy).spawn);
}

function evaluateExpression(num1, op1, num2, op2, num3) {
  const validOps = ['+', '-', '*', '/'];
  if (!validOps.includes(op1) || !validOps.includes(op2)) {
    console.error('Некорректная операция:', op1, op2);
    return null;
  }
  
  const isHighPriority = (op) => op === '*' || op === '/';
  const isLowPriority = (op) => op === '+' || op === '-';
  
  let result;
  
  if (isHighPriority(op1) && isLowPriority(op2)) {
    let step1;
    if (op1 === '*') step1 = num1 * num2;
    else if (op1 === '/') {
      if (num2 === 0) return null;
      step1 = num1 / num2;
    }
    
    if (op2 === '+') result = step1 + num3;
    else if (op2 === '-') result = step1 - num3;
  }
  else if (isLowPriority(op1) && isHighPriority(op2)) {
    let step1;
    if (op2 === '*') step1 = num2 * num3;
    else if (op2 === '/') {
      if (num3 === 0) return null;
      step1 = num2 / num3;
    }
    
    if (op1 === '+') result = num1 + step1;
    else if (op1 === '-') result = num1 - step1;
  }
  else {
    let step1;
    if (op1 === '+') step1 = num1 + num2;
    else if (op1 === '-') step1 = num1 - num2;
    else if (op1 === '*') step1 = num1 * num2;
    else if (op1 === '/') {
      if (num2 === 0) return null;
      step1 = num1 / num2;
    }
    
    if (op2 === '+') result = step1 + num3;
    else if (op2 === '-') result = step1 - num3;
    else if (op2 === '*') result = step1 * num3;
    else if (op2 === '/') {
      if (num3 === 0) return null;
      result = step1 / num3;
    }
  }
  
  if (result === undefined || isNaN(result)) {
    console.error('Ошибка вычисления выражения:', num1, op1, num2, op2, num3);
    return null;
  }
  
  return Math.round(result * 100) / 100;
}

function formatExpression(num1, op1, num2, op2, num3) {
  const isHighPriority = (op) => op === '*' || op === '/';
  const isLowPriority = (op) => op === '+' || op === '-';
  
  if (isHighPriority(op1) && isLowPriority(op2)) {
    return `${num1} ${op1} ${num2} ${op2} ${num3}`;
  }
  else if (isLowPriority(op1) && isHighPriority(op2)) {
    return `${num1} ${op1} (${num2} ${op2} ${num3})`;
  }
  else {
    return `${num1} ${op1} ${num2} ${op2} ${num3}`;
  }
}

function generateExpressionTask() {
  const maxNum = state.difficulty ? difficulties[state.difficulty].maxNumber : 60;
  let minNum, maxNumRange, allowDivision;
  
  if (state.difficulty === 'easy') {
    minNum = 1;
    maxNumRange = 12;
    allowDivision = false;
  } else if (state.difficulty === 'medium') {
    minNum = 1;
    maxNumRange = 25;
    allowDivision = true;
  } else if (state.difficulty === 'hard') {
    minNum = 5;
    maxNumRange = 50;
    allowDivision = true;
  } else {
    minNum = 1;
    maxNumRange = 12;
    allowDivision = false;
  }

  let a, b, c, op1, op2, target;
  let attempts = 0;
  const maxAttempts = 50;

  do {
    if (allowDivision) {
      op1 = ['+', '-', '*', '/'][Utils.randomInt(0, 3)];
      op2 = ['+', '-', '*', '/'][Utils.randomInt(0, 3)];
    } else {
      op1 = ['+', '-', '*'][Utils.randomInt(0, 2)];
      op2 = ['+', '-', '*'][Utils.randomInt(0, 2)];
    }

    a = Utils.randomInt(minNum, maxNumRange);
    
    if (op1 === '/') {
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

    c = Utils.randomInt(minNum, maxNumRange);
    
    target = evaluateExpression(a, op1, b, op2, c);
    
    if (target === null) {
      attempts++;
      continue;
    }
    
    if (op1 === '/' || op2 === '/') {
      if (!Number.isInteger(target) && target % 1 > 0.01) {
        attempts++;
        continue;
      }
    }

    if (target < 0 || target > maxNumRange * 3) {
      attempts++;
      continue;
    }

    target = Math.round(target * 100) / 100;

    if (target % 1 !== 0 && (target * 100) % 1 !== 0) {
      attempts++;
      continue;
    }

    break;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    a = Utils.randomInt(2, 10);
    b = Utils.randomInt(1, 9);
    c = Utils.randomInt(1, 9);
    op1 = ['+', '-'][Utils.randomInt(0, 1)];
    op2 = ['+', '-'][Utils.randomInt(0, 1)];
    target = evaluateExpression(a, op1, b, op2, c);
    if (target === null) {
      op1 = '+';
      op2 = '+';
      target = a + b + c;
    }
  }

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
  if (elements.ruleTitle) {
    elements.ruleTitle.textContent = task.ruleText;
  }
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

  function returnCardToSource(cardId) {
    const card = cardRegistry[cardId];
    if (!card) return;
    
    card.classList.remove('disabled');
    card.draggable = true;
    
    if (card.dataset.type === 'number') {
      numbersRow.appendChild(card);
    } else if (card.dataset.type === 'op') {
      opsRow.appendChild(card);
    }
  }

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
      
      if (card && card.classList.contains('disabled')) {
        slotElements.forEach(slot => {
          if (slot.dataset.cardId === data.id) {
            const slotIndex = slotElements.indexOf(slot);
            if (slotIndex >= 0 && slotIndex < slotItems.length) {
              slot.textContent = slotItems[slotIndex].label;
            }
            delete slot.dataset.cardId;
            delete slot.dataset.value;
          }
        });
        
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
      
      if (slot.dataset.cardId) {
        returnCardToSource(slot.dataset.cardId);
      }
      
      slot.textContent = data.value;
      slot.dataset.cardId = data.id;
      slot.dataset.value = data.value;
      const card = cardRegistry[data.id];
      card.classList.add('disabled');
      card.draggable = false;
    });

    slot.addEventListener('click', (e) => {
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
    
    let result;
    try {
      const num1 = parseFloat(v1);
      const num2 = parseFloat(v2);
      const num3 = parseFloat(v3);
      
      if (isNaN(num1) || isNaN(num2) || isNaN(num3)) {
        setMessage('Некорректные числа', 'error');
        return;
      }
      
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
      const solution = task.solution;
      const correctExpression = formatExpression(solution.a, solution.op1, solution.b, solution.op2, solution.c);
      setMessage(`Неверно, получилось ${result}, нужно ${task.target}. Правильное решение: ${correctExpression} = ${task.target}`, 'error');
    }
  });

  contextMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const slotIndex = Number(contextMenu.dataset.slotId);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= slotElements.length) {
      contextMenu.classList.remove('open');
      return;
    }
    const slot = slotElements[slotIndex];
    if (!slot) {
      contextMenu.classList.remove('open');
      return;
    }
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

function completeSublevel(success) {
  resetTimers();
  if (elements.gameArea.cleanup) {
    elements.gameArea.cleanup();
    delete elements.gameArea.cleanup;
  }
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
  if (elements.ruleTitle) {
    elements.ruleTitle.textContent = 'Приготовьтесь! Начинаем с уровня 1';
  }
  if (elements.difficultyPanel) {
    elements.difficultyPanel.classList.add('hidden');
    const difficultyCard = elements.difficultyPanel.closest('.card');
    if (difficultyCard) {
      difficultyCard.classList.add('hidden');
    }
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

