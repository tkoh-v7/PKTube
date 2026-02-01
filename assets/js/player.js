import { safeText, setQs } from "./utils.js";
import { saveState } from "./storage.js";
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

  /* -----------------------------
     Local vote memory (NOT metrics)
     ----------------------------- */
  function getLocalVote(id) {
    return localStorage.getItem(`vote:${id}`);
  }

  function setLocalVote(id, vote) {
    localStorage.setItem(`vote:${id}`, vote);
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = safeText(msg);
  }

  /* -----------------------------
     Voting (single visible control)
     ----------------------------- */
  function bindVoting(videoId) {
    const likeEl = document.getElementById("likeCount");
    const dislikeEl = document.getElementById("dislikeCount");

    if (!likeEl || !dislikeEl) return;

    function applyActive(vote) {
      likeEl.classList.toggle("active", vote === "up");
      dislikeEl.classList.toggle("active", vote === "down");
    }

    function handleVote(vote) {
      const previous = getLocalVote(videoId);
      if (previous === vote) return;

      fetch(`${CONFIG.workerUrl}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: videoId,
          vote,
          previous
        })
      })
        .then(r => r.json())
        .then(data => {
          setLocalVote(videoId, vote);

          likeEl.textContent = `👍 ${data.likes}`;
          dislikeEl.textContent = `👎 ${data.dislikes}`;
          applyActive(vote);
        })
        .catch(() => {});
    }

    likeEl.onclick = () => handleVote("up");
    dislikeEl.onclick = () => handleVote("down");

    likeEl.onkeydown = e => e.key === "Enter" && handleVote("up");
    dislikeEl.onkeydown = e => e.key === "Enter" && handleVote("down");

    applyActive(getLocalVote(videoId));
  }

  /* -----------------------------
     Load video + global stats
     ----------------------------- */
  function loadVideo(video) {
    countedView = false;
    currentVideoId = video.id;

    titleEl.textContent = `${safeText(video.title)} | loading…`;

    // Fetch GLOBAL stats only
    fetch(`${CONFIG.workerUrl}/video/${video.id}`)
      .then(r => r.json())
      .then(stats => {
        titleEl.textContent =
          `${safeText(video.title)} | ${stats.views} views`;

        const likeEl = document.getElementById("likeCount");
        const dislikeEl = document.getElementById("dislikeCount");

        if (likeEl) likeEl.textContent = `👍 ${stats.likes}`;
        if (dislikeEl) dislikeEl.textContent = `👎 ${stats.dislikes}`;

        bindVoting(video.id);
      })
      .catch(() => {
        // Per your requirement: no local fallback
        titleEl.textContent = `${safeText(video.title)} | unavailable`;
      });

    /* ---- Metadata (UNCHANGED) ---- */
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

  /* -----------------------------
     Progress + GLOBAL view count
     ----------------------------- */
  function bindProgressPersistence() {
    videoEl.addEventListener("timeupdate", () => {
      if (!countedView && currentVideoId && videoEl.currentTime >= 5) {
        countedView = true;

        fetch(`${CONFIG.workerUrl}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentVideoId })
        })
          .then(r => r.json())
          .then(data => {
            const baseTitle = titleEl.textContent.split(" | ")[0];
            titleEl.textContent = `${safeText(baseTitle)} | ${data.views} views`;
          })
          .catch(() => {});
      }

      if (Math.floor(videoEl.currentTime) % 5 === 0) {
        saveState({ t: Math.floor(videoEl.currentTime) });
      }
    });
  }

  return {
    loadVideo,
    setStatus,
    bindProgressPersistence
  };
}
