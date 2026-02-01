import { safeText, setQs } from "./utils.js";
import { saveState, incrementView, getViews } from "./storage.js";
import { CONFIG } from "./config.js";

export function createPlayer({
  videoEl,
  titleEl,
  descEl,
  tagEl,
  yearEl,
  mapEl,
  statusEl
}) {
  let countedView = false;
  let currentVideoId = null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = safeText(msg);
  }

  function loadVideo(video) {
    countedView = false;
    currentVideoId = video.id;

    titleEl.textContent = `${safeText(video.title)} | loading views…`;

    // 🔹 GLOBAL views from Worker (authoritative)
    if (CONFIG.workerUrl) {
      fetch(`${CONFIG.workerUrl}/video/${video.id}`)
        .then(res => res.json())
        .then(data => {
          if (typeof data.views === "number") {
            titleEl.textContent = `${safeText(video.title)} | ${data.views} views`;
          } else {
            throw new Error("Invalid worker response");
          }
        })
        .catch(() => {
          const localViews = getViews(video.id);
          titleEl.textContent = `${safeText(video.title)} | ${localViews} views`;
        });
    } else {
      const localViews = getViews(video.id);
      titleEl.textContent = `${safeText(video.title)} | ${localViews} views`;
    }

    descEl.textContent = safeText(video.description);

    tagEl.innerHTML = "";
    if (Array.isArray(video.tags) && video.tags.length) {
      for (const t of video.tags) {
        const pill = document.createElement("span");
        pill.className = "tag";
        pill.textContent = safeText(t);
        tagEl.appendChild(pill);
      }
    }

    if (yearEl) {
      if (video.year) {
        yearEl.textContent = safeText(video.year);
        yearEl.style.display = "";
      } else {
        yearEl.textContent = "";
        yearEl.style.display = "none";
      }
    }

    if (mapEl) {
      if (video.map) {
        mapEl.textContent = safeText(video.map);
        mapEl.style.display = "";
      } else {
        mapEl.textContent = "";
        mapEl.style.display = "none";
      }
    }

    setQs("v", safeText(video.id));

    videoEl.src = safeText(video.src);
    videoEl.load();
    saveState({ lastId: video.id });
  }

  function bindProgressPersistence() {
    videoEl.addEventListener("timeupdate", () => {
      if (!countedView && currentVideoId && videoEl.currentTime >= 5) {
        countedView = true;
        incrementView(currentVideoId);
        if (CONFIG.workerUrl) {
          fetch(`${CONFIG.workerUrl}/view`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ id: currentVideoId })
          })
            .then(res => res.json())
            .then(data => {
              if (typeof data.views === "number") {
                titleEl.textContent =
                  `${safeText(titleEl.textContent.split(" | ")[0])} | ${data.views} views`;
              }
            })
            .catch(() => {
            });
        }
      }

      // ---- SAVE PROGRESS ----
      if (Math.floor(videoEl.currentTime) % 5 === 0) {
        saveState({ t: Math.floor(videoEl.currentTime) });
      }
    });
  }

  return { loadVideo, setStatus, bindProgressPersistence };
}
