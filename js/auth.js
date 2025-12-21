let nameInput;
let nameError;
let startBtn;
let playLink;
let continueBtn;
let continueName;
let rulesModal;
let rulesOverlay;
let openRulesBtn;
let closeRulesBtns;

function showError(message) {
  if (nameError) nameError.textContent = message;
  if (nameInput) {
    nameInput.classList.add('shake');
    setTimeout(() => nameInput.classList.remove('shake'), 400);
  }
}

function validateName(value) {
  if (!value.trim()) return 'Имя не должно быть пустым';
  if (value.trim().length < 2) return 'Минимум 2 символа';
  if (value.trim().length > 15) return 'Не больше 15 символов';
  const trimmed = value.trim();
  const simplePattern = /^[A-Za-z0-9А-Яа-яЁё\s]+$/;
  if (!simplePattern.test(trimmed)) return 'Только буквы или цифры';
  return '';
}

function proceedToGame(name) {
  try {
    Storage.setCurrentPlayerName(name.trim());
    console.log('Переход на game.html...');
    window.location.href = 'game.html';
  } catch (error) {
    console.error('Ошибка при переходе на game.html:', error);
    alert('Ошибка: ' + error.message);
  }
}

function handleStart() {
  console.log('handleStart вызван');
  if (!nameInput) {
    console.error('nameInput не найден');
    return;
  }
  const value = nameInput.value;
  console.log('Введенное имя:', value);
  const error = validateName(value);
  if (error) {
    console.log('Ошибка валидации:', error);
    showError(error);
    return;
  }
  console.log('Валидация прошла, переход к игре...');
  proceedToGame(value);
}

function initPrefill() {
  if (!nameInput || !continueBtn || !continueName) return;
  const stored = Storage.getCurrentPlayerName();
  if (stored) {
    nameInput.value = stored;
    continueBtn.hidden = false;
    continueName.textContent = stored;
  }
}

function toggleModal(open) {
  if (!rulesModal) return;
  rulesModal.classList.toggle('open', open);
  rulesModal.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function initEvents() {
  if (startBtn) {
    console.log('Обработчик события добавлен на startBtn');
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Клик по startBtn зарегистрирован');
      handleStart();
    });
  } else {
    console.error('startBtn не найден при инициализации событий');
  }
  if (playLink) {
    playLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleStart();
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      if (nameInput && nameInput.value.trim()) {
        proceedToGame(nameInput.value);
      }
    });
  }
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleStart();
    });
  }

  if (openRulesBtn) {
    openRulesBtn.addEventListener('click', () => toggleModal(true));
  }
  if (rulesOverlay) {
    rulesOverlay.addEventListener('click', () => toggleModal(false));
  }
  if (closeRulesBtns && closeRulesBtns.length > 0) {
    closeRulesBtns.forEach((btn) => {
      if (btn) btn.addEventListener('click', () => toggleModal(false));
    });
  }
}

function cacheDom() {
  nameInput = document.getElementById('playerName');
  nameError = document.getElementById('nameError');
  startBtn = document.getElementById('startGameBtn');
  playLink = document.getElementById('playLink');
  continueBtn = document.getElementById('continueBtn');
  continueName = document.getElementById('continueName');
  rulesModal = document.getElementById('rulesModal');
  rulesOverlay = document.getElementById('rulesOverlay');
  openRulesBtn = document.getElementById('openRulesBtn');
  closeRulesBtns = [document.getElementById('closeRulesBtn'), document.getElementById('closeRulesFooterBtn')];
}

function hideSplashScreen() {
  const splashScreen = document.getElementById('splashScreen');
  if (splashScreen) {
    splashScreen.classList.add('hidden');
    document.body.classList.remove('splash-active');
    setTimeout(() => {
      splashScreen.remove();
    }, 600);
  }
}

function initSplashScreen() {
  const splashScreen = document.getElementById('splashScreen');
  if (!splashScreen) return;

  document.body.classList.add('splash-active');

  splashScreen.addEventListener('click', hideSplashScreen);

  let hideTimer = setTimeout(() => {
    if (document.readyState === 'complete') {
      hideSplashScreen();
    }
  }, 2500);

  window.addEventListener('load', () => {
    clearTimeout(hideTimer);
    setTimeout(hideSplashScreen, 1000);
  });

  setTimeout(() => {
    hideSplashScreen();
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    initSplashScreen();
    cacheDom();
    if (!startBtn || !nameInput) {
      console.error('Не найдены необходимые элементы на странице');
      return;
    }
    initPrefill();
    initEvents();
  } catch (error) {
    console.error('Ошибка инициализации auth.js:', error);
  }
});

