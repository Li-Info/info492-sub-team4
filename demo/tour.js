const dialog = document.querySelector("#tour");
const card = document.querySelector("#tour-card");
const highlight = document.querySelector("#tour-highlight");
const nextButton = document.querySelector("#tour-next");
const steps = [
  { target: "#question-form", title: "Ask your project question", description: "Type a specific question here, then select Ask AI. Use example fills in a question you can try." },
  { target: "#answer-panel", title: "Read the answer and its evidence", description: "Your answer will appear here after a search. Open the cited passages to check what each source says. Look for source differences and missing information." },
  { target: "#review-panel", title: "Save your own review", description: "After an answer appears, check its supporting passages here and record your decision. Your review is saved separately from the AI answer." },
];
let activeStep = 0;
let activeUser;
let previousFocus;
let previousOverflow;
let previousScroll;
let frame;

function positionTour() {
  if (!dialog.open) return;
  const target = document.querySelector(steps[activeStep].target);
  const rect = target.getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const height = window.visualViewport?.height || window.innerHeight;
  const tipHeight = card.getBoundingClientRect().height;
  const left = Math.max(12, rect.left - 8);
  const top = Math.max(12, rect.top - 8);
  const right = Math.min(width - 12, rect.right + 8);
  const bottom = Math.min(height - 12, top + Math.min(rect.height + 16, Math.max(80, height - tipHeight - 56)));
  Object.assign(highlight.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(1, right - left)}px`, height: `${Math.max(1, bottom - top)}px` });
  const tipWidth = card.getBoundingClientRect().width;
  const below = bottom + 16;
  const tipTop = below + tipHeight <= height - 12 ? below : Math.max(12, top - tipHeight - 16);
  Object.assign(card.style, { left: `${Math.max(12, Math.min(left, width - tipWidth - 12))}px`, top: `${tipTop}px` });
}

function schedulePosition() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(positionTour);
}

function showStep() {
  const step = steps[activeStep];
  document.querySelector("#tour-count").textContent = `Step ${activeStep + 1} of ${steps.length}`;
  document.querySelector("#tour-title").textContent = step.title;
  document.querySelector("#tour-description").textContent = step.description;
  document.querySelector("#tour-back").hidden = activeStep === 0;
  nextButton.textContent = activeStep === steps.length - 1 ? "Finish" : "Next";
  const target = document.querySelector(step.target);
  const tipHeight = card.getBoundingClientRect().height;
  const height = window.visualViewport?.height || window.innerHeight;
  const gap = Math.max(24, Math.floor((height - Math.min(target.offsetHeight, height / 2) - tipHeight - 24) / 2));
  window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - gap), behavior: "instant" });
  positionTour();
  nextButton.focus({ preventScroll: true });
}

function closeTour(finished) {
  if (!dialog.open) return;
  try {
    if (finished) localStorage.setItem(`info492-tour-v1-${activeUser}`, "done");
    else sessionStorage.setItem(`info492-tour-skipped-${activeUser}`, "yes");
  } catch {}
  dialog.close();
  document.documentElement.style.overflow = previousOverflow;
  cancelAnimationFrame(frame);
  window.scrollTo({ top: previousScroll, behavior: "instant" });
  if (previousFocus instanceof HTMLElement && previousFocus.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
  else document.querySelector("#question").focus({ preventScroll: true });
}

export function startTour(userId, force = false) {
  if (dialog.open) return;
  if (!force) {
    try { if (localStorage.getItem(`info492-tour-v1-${userId}`) === "done" || sessionStorage.getItem(`info492-tour-skipped-${userId}`) === "yes") return; } catch {}
  }
  activeUser = userId;
  activeStep = 0;
  previousFocus = document.activeElement;
  previousScroll = window.scrollY;
  previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  dialog.showModal();
  showStep();
}

nextButton.addEventListener("click", () => {
  if (activeStep === steps.length - 1) closeTour(true);
  else { activeStep += 1; showStep(); }
});
document.querySelector("#tour-back").addEventListener("click", () => { activeStep = Math.max(0, activeStep - 1); showStep(); });
document.querySelector("#tour-skip").addEventListener("click", () => closeTour(false));
dialog.addEventListener("cancel", event => { event.preventDefault(); closeTour(false); });
window.addEventListener("resize", schedulePosition);
window.addEventListener("scroll", schedulePosition, { passive: true });
window.visualViewport?.addEventListener("resize", schedulePosition);
