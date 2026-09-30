const STORAGE_KEY = "selmas-clock-practice-v1";
const MIN_LEVEL = 1;
const MAX_LEVEL = 8;
const MAX_HISTORY = 8;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const levelSettings = {
  1: { minuteStep: 60, initialDistance: 2, useTwentyFourHours: false },
  2: { minuteStep: 30, initialDistance: 3, useTwentyFourHours: false },
  3: { minuteStep: 15, initialDistance: 4, useTwentyFourHours: false },
  4: { minuteStep: 5, initialDistance: 3, useTwentyFourHours: false },
  5: { minuteStep: 5, initialDistance: null, useTwentyFourHours: false },
  6: { minuteStep: 1, initialDistance: 3, useTwentyFourHours: false },
  7: { minuteStep: 1, initialDistance: null, useTwentyFourHours: false },
  8: { minuteStep: 1, initialDistance: null, useTwentyFourHours: true }
};

const createDefaultProgress = () => ({
  level: 1,
  totalAttempts: 0,
  totalProblems: 0,
  correctProblems: 0,
  streak: 0,
  bestStreak: 0,
  questionsAtLevel: 0,
  recentResults: []
});

const elements = {
  clock: document.querySelector("#clock"),
  minuteMarks: document.querySelector("#minute-marks"),
  hourNumbers: document.querySelector("#hour-numbers"),
  hourHand: document.querySelector("#hour-hand"),
  minuteHand: document.querySelector("#minute-hand"),
  hourHitArea: document.querySelector("#hour-hit-area"),
  minuteHitArea: document.querySelector("#minute-hit-area"),
  targetTime: document.querySelector("#target-time"),
  selectedHour: document.querySelector("#selected-hour"),
  selectedMinute: document.querySelector("#selected-minute"),
  adjustButtons: document.querySelectorAll("[data-adjust]"),
  checkButton: document.querySelector("#check-button"),
  nextButton: document.querySelector("#next-button"),
  feedback: document.querySelector("#feedback"),
  encouragement: document.querySelector("#encouragement-text"),
  gameCard: document.querySelector(".game-card"),
  starCount: document.querySelector("#star-count"),
  streakCount: document.querySelector("#streak-count"),
  levelCount: document.querySelector("#level-count"),
  resetButton: document.querySelector("#reset-button"),
  resetDialog: document.querySelector("#reset-dialog")
};

let progress = loadProgress();
let target = { hour: 0, displayHour: 12, minute: 0 };
let selected = { hour: 0, minute: 0 };
let wrongAttempts = 0;
let problemFinished = false;
let activeHand = null;

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidProgress(value) {
  return (
    value &&
    typeof value === "object" &&
    Number.isInteger(value.level) &&
    value.level >= MIN_LEVEL &&
    value.level <= MAX_LEVEL &&
    isNonNegativeInteger(value.totalAttempts) &&
    isNonNegativeInteger(value.totalProblems) &&
    isNonNegativeInteger(value.correctProblems) &&
    value.correctProblems <= value.totalProblems &&
    isNonNegativeInteger(value.streak) &&
    isNonNegativeInteger(value.bestStreak) &&
    value.streak <= value.bestStreak &&
    isNonNegativeInteger(value.questionsAtLevel) &&
    Array.isArray(value.recentResults) &&
    value.recentResults.length <= MAX_HISTORY &&
    value.recentResults.every((result) => typeof result === "boolean")
  );
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isValidProgress(saved) ? saved : createDefaultProgress();
  } catch {
    return createDefaultProgress();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    elements.encouragement.textContent = "Du kan stadig øve videre her.";
  }
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeTotalMinutes(totalMinutes) {
  return ((totalMinutes % 720) + 720) % 720;
}

function timeFromTotalMinutes(totalMinutes) {
  const normalized = normalizeTotalMinutes(totalMinutes);
  return {
    hour: Math.floor(normalized / 60),
    minute: normalized % 60
  };
}

function createClockFace() {
  for (let index = 0; index < 60; index += 1) {
    const angle = (index * Math.PI) / 30;
    const isMajor = index % 5 === 0;
    const innerRadius = isMajor ? 132 : 140;
    const outerRadius = 147;
    const line = document.createElementNS(SVG_NAMESPACE, "line");
    line.setAttribute("x1", String(180 + Math.sin(angle) * innerRadius));
    line.setAttribute("y1", String(180 - Math.cos(angle) * innerRadius));
    line.setAttribute("x2", String(180 + Math.sin(angle) * outerRadius));
    line.setAttribute("y2", String(180 - Math.cos(angle) * outerRadius));
    line.setAttribute("stroke-width", isMajor ? "4" : "2");
    line.setAttribute("class", isMajor ? "minute-mark major" : "minute-mark");
    elements.minuteMarks.append(line);
  }

  for (let number = 1; number <= 12; number += 1) {
    const angle = (number * Math.PI) / 6;
    const text = document.createElementNS(SVG_NAMESPACE, "text");
    text.setAttribute("x", String(180 + Math.sin(angle) * 112));
    text.setAttribute("y", String(180 - Math.cos(angle) * 112));
    text.setAttribute("class", "hour-number");
    text.textContent = String(number);
    elements.hourNumbers.append(text);
  }
}

function renderStats() {
  elements.starCount.textContent = progress.correctProblems;
  elements.streakCount.textContent = progress.streak;
  elements.levelCount.textContent = progress.level;
}

function renderSelectedTime() {
  const hourAngle = selected.hour * 30 + selected.minute * 0.5;
  const minuteAngle = selected.minute * 6;
  const displayHour = selected.hour === 0 ? 12 : selected.hour;
  elements.hourHand.setAttribute("transform", `rotate(${hourAngle} 180 180)`);
  elements.hourHitArea.setAttribute("transform", `rotate(${hourAngle} 180 180)`);
  elements.minuteHand.setAttribute("transform", `rotate(${minuteAngle} 180 180)`);
  elements.minuteHitArea.setAttribute("transform", `rotate(${minuteAngle} 180 180)`);
  elements.selectedHour.textContent = String(displayHour);
  elements.selectedMinute.textContent = String(selected.minute).padStart(2, "0");
}

function getAllowedMinutes(settings) {
  if (settings.minuteStep === 60) {
    return [0];
  }

  const minutes = [];
  for (let minute = 0; minute < 60; minute += settings.minuteStep) {
    minutes.push(minute);
  }
  return minutes;
}

function generateTarget() {
  const settings = levelSettings[progress.level];
  const displayHour = settings.useTwentyFourHours
    ? randomInteger(0, 23)
    : randomInteger(1, 12);
  const allowedMinutes = getAllowedMinutes(settings);
  const minute = allowedMinutes[randomInteger(0, allowedMinutes.length - 1)];

  return {
    hour: displayHour % 12,
    displayHour,
    minute
  };
}

function generateStartingTime() {
  const settings = levelSettings[progress.level];
  const targetTotal = target.hour * 60 + target.minute;
  const step = settings.minuteStep === 60 ? 60 : settings.minuteStep;
  let nextTime;

  do {
    if (settings.initialDistance === null) {
      const randomHour = randomInteger(0, 11);
      const allowedMinutes = getAllowedMinutes(settings);
      nextTime = {
        hour: randomHour,
        minute: allowedMinutes[randomInteger(0, allowedMinutes.length - 1)]
      };
    } else {
      let offset = randomInteger(-settings.initialDistance, settings.initialDistance);
      if (offset === 0) {
        offset = 1;
      }
      nextTime = timeFromTotalMinutes(targetTotal + offset * step);
    }
  } while (nextTime.hour === target.hour && nextTime.minute === target.minute);

  return nextTime;
}

function setControlsDisabled(disabled) {
  elements.adjustButtons.forEach((button) => {
    button.disabled = disabled;
  });
  elements.checkButton.disabled = disabled;
  elements.clock.classList.toggle("disabled", disabled);
}

function showChallenge() {
  const settings = levelSettings[progress.level];
  target = generateTarget();
  selected = generateStartingTime();
  wrongAttempts = 0;
  problemFinished = false;
  const targetHour = settings.useTwentyFourHours
    ? String(target.displayHour).padStart(2, "0")
    : String(target.displayHour);
  elements.targetTime.textContent = `${targetHour}:${String(target.minute).padStart(2, "0")}`;
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.nextButton.hidden = true;
  elements.gameCard.classList.remove("celebrate");
  elements.encouragement.textContent =
    settings.minuteStep === 60
      ? "På niveau 1 øver vi hele timer."
      : `Minutknapperne flytter ${settings.minuteStep} ${settings.minuteStep === 1 ? "minut" : "minutter"}.`;
  setControlsDisabled(false);
  if (settings.minuteStep === 60) {
    elements.adjustButtons.forEach((button) => {
      if (button.dataset.adjust.startsWith("minute")) {
        button.disabled = true;
      }
    });
  }
  renderSelectedTime();
}

function addRecentResult(result) {
  progress.recentResults.push(result);
  if (progress.recentResults.length > MAX_HISTORY) {
    progress.recentResults.shift();
  }
}

function adaptLevel() {
  const recentSix = progress.recentResults.slice(-6);
  const recentFive = progress.recentResults.slice(-5);
  const correctInSix = recentSix.filter(Boolean).length;
  const correctInFive = recentFive.filter(Boolean).length;

  if (
    progress.level < MAX_LEVEL &&
    progress.questionsAtLevel >= 6 &&
    recentSix.length === 6 &&
    correctInSix >= 5
  ) {
    progress.level += 1;
    progress.questionsAtLevel = 0;
    progress.recentResults = [];
    return "up";
  }

  if (
    progress.level > MIN_LEVEL &&
    progress.questionsAtLevel >= 5 &&
    recentFive.length === 5 &&
    correctInFive <= 2
  ) {
    progress.level -= 1;
    progress.questionsAtLevel = 0;
    progress.recentResults = [];
    return "down";
  }

  return "same";
}

function finishProblem(wasCorrect) {
  const firstTry = wasCorrect && wrongAttempts === 0;
  progress.totalProblems += 1;
  progress.questionsAtLevel += 1;

  if (wasCorrect) {
    progress.correctProblems += 1;
  }

  if (firstTry) {
    progress.streak += 1;
    progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
  } else {
    progress.streak = 0;
  }

  addRecentResult(firstTry);
  const levelChange = adaptLevel();
  saveProgress();
  renderStats();
  return levelChange;
}

function setFinishedState() {
  problemFinished = true;
  setControlsDisabled(true);
  elements.nextButton.hidden = false;
  elements.nextButton.focus();
}

function isCorrectTime() {
  return selected.hour === target.hour && selected.minute === target.minute;
}

function checkTime() {
  if (problemFinished) {
    return;
  }

  progress.totalAttempts += 1;
  saveProgress();

  if (isCorrectTime()) {
    const levelChange = finishProblem(true);
    const messages = ["Flot klaret!", "Du har helt styr på tiden!", "Juhuu, uret passer!", "Præcis rigtigt!"];
    elements.feedback.textContent =
      levelChange === "up"
        ? `★ Fantastisk! Du er nu på niveau ${progress.level}!`
        : `★ ${messages[randomInteger(0, messages.length - 1)]}`;
    elements.feedback.className = "feedback correct";
    elements.encouragement.textContent =
      progress.streak >= 3 ? `${progress.streak} rigtige i træk — sikke en serie!` : "Godt gået! Du lærer hele tiden.";
    elements.gameCard.classList.add("celebrate");
    setFinishedState();
    return;
  }

  wrongAttempts += 1;
  if (wrongAttempts >= 3) {
    const levelChange = finishProblem(false);
    selected = { hour: target.hour, minute: target.minute };
    renderSelectedTime();
    const extraMessage =
      levelChange === "down" ? ` Vi øver lidt på niveau ${progress.level}.` : "";
    elements.feedback.textContent = `Sådan skal viserne stå.${extraMessage}`;
    elements.feedback.className = "feedback incorrect";
    elements.encouragement.textContent = "Det er helt okay — næste klokkeslæt er en ny chance.";
    setFinishedState();
    return;
  }

  elements.feedback.textContent =
    wrongAttempts === 1 ? "Ikke helt endnu. Prøv én gang til." : "Du er tæt på — prøv igen.";
  elements.feedback.className = "feedback incorrect";
}

function adjustHour(amount) {
  if (problemFinished) {
    return;
  }
  selected.hour = (selected.hour + amount + 12) % 12;
  renderSelectedTime();
}

function adjustMinute(direction) {
  if (problemFinished) {
    return;
  }
  const settings = levelSettings[progress.level];
  const step = settings.minuteStep === 60 ? 60 : settings.minuteStep;
  const total = selected.hour * 60 + selected.minute + direction * step;
  selected = timeFromTotalMinutes(total);
  renderSelectedTime();
}

function getClockAngle(event) {
  const rect = elements.clock.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 360 - 180;
  const y = ((event.clientY - rect.top) / rect.height) * 360 - 180;
  return (Math.atan2(x, -y) * 180) / Math.PI + 360;
}

function dragActiveHand(event) {
  if (!activeHand || problemFinished) {
    return;
  }

  const angle = getClockAngle(event) % 360;
  if (activeHand === "hour") {
    selected.hour = Math.round((angle - selected.minute * 0.5) / 30 + 12) % 12;
  } else {
    const settings = levelSettings[progress.level];
    const step = settings.minuteStep === 60 ? 60 : settings.minuteStep;
    const rawMinute = Math.round(angle / 6);
    selected.minute = (Math.round(rawMinute / step) * step) % 60;
  }
  renderSelectedTime();
}

function startDragging(hand, event) {
  if (problemFinished) {
    return;
  }
  event.preventDefault();
  activeHand = hand;
  elements.clock.setPointerCapture(event.pointerId);
  dragActiveHand(event);
}

function stopDragging(event) {
  if (activeHand && elements.clock.hasPointerCapture(event.pointerId)) {
    elements.clock.releasePointerCapture(event.pointerId);
  }
  activeHand = null;
}

function resetProgress() {
  progress = createDefaultProgress();
  saveProgress();
  renderStats();
  showChallenge();
  elements.encouragement.textContent = "En frisk start — du kan godt!";
}

elements.adjustButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.adjust;
    if (action === "hour-down") {
      adjustHour(-1);
    } else if (action === "hour-up") {
      adjustHour(1);
    } else if (action === "minute-down") {
      adjustMinute(-1);
    } else if (action === "minute-up") {
      adjustMinute(1);
    }
  });
});

elements.hourHitArea.addEventListener("pointerdown", (event) => startDragging("hour", event));
elements.minuteHitArea.addEventListener("pointerdown", (event) => startDragging("minute", event));
elements.clock.addEventListener("pointermove", dragActiveHand);
elements.clock.addEventListener("pointerup", stopDragging);
elements.clock.addEventListener("pointercancel", stopDragging);
elements.checkButton.addEventListener("click", checkTime);
elements.nextButton.addEventListener("click", showChallenge);
elements.resetButton.addEventListener("click", () => {
  elements.resetDialog.returnValue = "";
  elements.resetDialog.showModal();
});
elements.resetDialog.addEventListener("close", () => {
  if (elements.resetDialog.returnValue === "confirm") {
    resetProgress();
  }
});

createClockFace();
renderStats();
showChallenge();
