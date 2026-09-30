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
  skippedProblems: 0,
  recentResults: [],
  mode: "set"
});

const elements = {
  clock: document.querySelector("#clock"),
  minuteMarks: document.querySelector("#minute-marks"),
  hourNumbers: document.querySelector("#hour-numbers"),
  hourHand: document.querySelector("#hour-hand"),
  minuteHand: document.querySelector("#minute-hand"),
  hourHitArea: document.querySelector("#hour-hit-area"),
  minuteHitArea: document.querySelector("#minute-hit-area"),
  clockLayout: document.querySelector(".clock-layout"),
  taskIcon: document.querySelector("#task-icon"),
  taskText: document.querySelector("#task-text"),
  targetTime: document.querySelector("#target-time"),
  resolutionIcon: document.querySelector("#resolution-icon"),
  resolutionText: document.querySelector("#resolution-text"),
  hourSelect: document.querySelector("#hour-select"),
  minuteSelect: document.querySelector("#minute-select"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  difficultyButtons: document.querySelectorAll("[data-difficulty]"),
  skipControls: document.querySelector("#skip-controls"),
  skipCount: document.querySelector("#skip-count"),
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
let answer = { hour: 0, minute: 0 };
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
    (value.skippedProblems === undefined || isNonNegativeInteger(value.skippedProblems)) &&
    Array.isArray(value.recentResults) &&
    value.recentResults.length <= MAX_HISTORY &&
    value.recentResults.every((result) => typeof result === "boolean")
  );
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidProgress(saved)) {
      return {
        ...saved,
        skippedProblems: saved.skippedProblems ?? 0,
        mode: saved.mode === "read" ? "read" : "set"
      };
    }
    return createDefaultProgress();
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
  elements.skipCount.textContent = progress.skippedProblems;
}

function renderSelectedTime() {
  const hourAngle = selected.hour * 30 + selected.minute * 0.5;
  const minuteAngle = selected.minute * 6;
  const setHandPosition = (hand, hitArea, angle, length) => {
    const radians = (angle * Math.PI) / 180;
    const x = 180 + Math.sin(radians) * length;
    const y = 180 - Math.cos(radians) * length;
    hand.setAttribute("x2", String(x));
    hand.setAttribute("y2", String(y));
    hitArea.setAttribute("x1", "180");
    hitArea.setAttribute("y1", "180");
    hitArea.setAttribute("x2", String(x));
    hitArea.setAttribute("y2", String(y));
  };

  setHandPosition(elements.hourHand, elements.hourHitArea, hourAngle, 81);
  setHandPosition(elements.minuteHand, elements.minuteHitArea, minuteAngle, 117);
  if (progress.mode === "read") {
    elements.hourSelect.value = String(answer.hour);
    elements.minuteSelect.value = String(answer.minute);
  }
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

function getResolutionDetails(settings) {
  if (settings.minuteStep === 60) {
    return { icon: "●", label: "Hele timer" };
  }
  if (settings.minuteStep === 30) {
    return { icon: "◐", label: "Halve timer" };
  }
  if (settings.minuteStep === 15) {
    return { icon: "◔", label: "Kvarter" };
  }
  if (settings.minuteStep === 5) {
    return { icon: "5′", label: "5 minutter" };
  }
  return { icon: "◷", label: "Alle minutter" };
}

function populateSelectors(settings) {
  elements.hourSelect.replaceChildren();
  for (let displayHour = 1; displayHour <= 12; displayHour += 1) {
    const option = document.createElement("option");
    option.value = String(displayHour % 12);
    option.textContent = String(displayHour);
    elements.hourSelect.append(option);
  }

  elements.minuteSelect.replaceChildren();
  getAllowedMinutes(settings).forEach((minute) => {
    const option = document.createElement("option");
    option.value = String(minute);
    option.textContent = String(minute).padStart(2, "0");
    elements.minuteSelect.append(option);
  });
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
  elements.hourSelect.disabled = disabled;
  elements.minuteSelect.disabled = disabled;
  elements.checkButton.disabled = disabled;
  elements.clock.classList.toggle("disabled", disabled);
}

function showChallenge() {
  const settings = levelSettings[progress.level];
  target = generateTarget();
  populateSelectors(settings);
  if (progress.mode === "read") {
    selected = { hour: target.hour, minute: target.minute };
    answer = generateStartingTime();
  } else {
    selected = generateStartingTime();
  }
  wrongAttempts = 0;
  problemFinished = false;
  const targetHour = settings.useTwentyFourHours
    ? String(target.displayHour).padStart(2, "0")
    : String(target.displayHour);
  elements.targetTime.textContent = `${targetHour}:${String(target.minute).padStart(2, "0")}`;
  elements.targetTime.hidden = progress.mode === "read";
  const resolution = getResolutionDetails(settings);
  const minuteHandLocked = progress.mode === "set" && settings.minuteStep === 60;
  elements.resolutionIcon.textContent = resolution.icon;
  elements.resolutionText.textContent = resolution.label;
  elements.taskIcon.textContent = progress.mode === "read" ? "◉" : "☝";
  elements.taskText.textContent = progress.mode === "read" ? "Hvad er klokken?" : "Stil uret til";
  elements.clockLayout.classList.toggle("set-mode", progress.mode === "set");
  elements.clock.classList.toggle("fixed", progress.mode === "read");
  elements.clock.classList.toggle(
    "minute-locked",
    progress.mode === "set" && settings.minuteStep === 60
  );
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === progress.mode);
  });
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.nextButton.hidden = true;
  elements.skipControls.hidden = false;
  elements.gameCard.classList.remove("celebrate");
  if (progress.mode === "read") {
    elements.encouragement.textContent =
      settings.minuteStep === 60
        ? "Aflæs timeviseren og vælg den rigtige time."
        : "Se på viserne og vælg klokkeslættet.";
  } else {
    elements.encouragement.textContent =
      settings.minuteStep === 60
        ? "Træk timeviseren hen på den rigtige time."
        : "Træk direkte i time- og minutviseren.";
  }
  setControlsDisabled(false);
  if (settings.minuteStep === 60 && progress.mode === "read") {
    elements.minuteSelect.disabled = true;
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
  elements.skipControls.hidden = true;
  elements.nextButton.focus();
}

function isCorrectTime() {
  const response = progress.mode === "read" ? answer : selected;
  return response.hour === target.hour && response.minute === target.minute;
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
    if (progress.mode === "read") {
      answer = { hour: target.hour, minute: target.minute };
    } else {
      selected = { hour: target.hour, minute: target.minute };
    }
    renderSelectedTime();
    const extraMessage =
      levelChange === "down" ? ` Vi øver lidt på niveau ${progress.level}.` : "";
    const correctTime = `${target.hour === 0 ? 12 : target.hour}:${String(target.minute).padStart(2, "0")}`;
    elements.feedback.textContent =
      progress.mode === "read"
        ? `Det rigtige svar er ${correctTime}.${extraMessage}`
        : `Sådan skal viserne stå.${extraMessage}`;
    elements.feedback.className = "feedback incorrect";
    elements.encouragement.textContent = "Det er helt okay — næste klokkeslæt er en ny chance.";
    setFinishedState();
    return;
  }

  elements.feedback.textContent =
    wrongAttempts === 1 ? "Ikke helt endnu. Prøv én gang til." : "Du er tæt på — prøv igen.";
  elements.feedback.className = "feedback incorrect";
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
  if (
    problemFinished ||
    progress.mode !== "set" ||
    (hand === "minute" && levelSettings[progress.level].minuteStep === 60)
  ) {
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

function skipChallenge(direction) {
  progress.skippedProblems += 1;
  progress.level = Math.max(
    MIN_LEVEL,
    Math.min(MAX_LEVEL, progress.level + (direction === "up" ? 1 : -1))
  );
  progress.questionsAtLevel = 0;
  progress.recentResults = [];
  saveProgress();
  renderStats();
  showChallenge();
  elements.encouragement.textContent =
    direction === "up"
      ? `Så prøver vi niveau ${progress.level}.`
      : `Vi gør det lidt lettere på niveau ${progress.level}.`;
}

elements.hourSelect.addEventListener("change", () => {
  answer.hour = Number(elements.hourSelect.value);
  renderSelectedTime();
});
elements.minuteSelect.addEventListener("change", () => {
  answer.minute = Number(elements.minuteSelect.value);
  renderSelectedTime();
});
elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.mode !== progress.mode) {
      progress.mode = button.dataset.mode;
      saveProgress();
      showChallenge();
    }
  });
});
elements.difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => skipChallenge(button.dataset.difficulty));
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
