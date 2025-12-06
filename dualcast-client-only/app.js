/*
 * DualCast AI Studio Pro Max – Client Only Demo
 *
 * This script implements a simplified multi‑agent podcast studio entirely in
 * client‑side JavaScript. It avoids external dependencies and bundlers, so
 * the app can be opened directly from the file system without running
 * `npm install` or any build commands. It demonstrates key features of
 * the specification: two persistent AI hosts with distinct personalities,
 * episode generation with scripted dialogue and metadata, a live call‑in
 * interface, speech synthesis integration and rudimentary lip‑sync
 * animations. The conversation heuristics are intentionally simple; in
 * a production system these would be replaced with calls to an LLM or
 * a more sophisticated multi‑agent framework such as AutoGen【860940447890483†L90-L100】.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------ */

  // Host profiles with default settings. Additional properties like
  // `mouthInterval` and `voiceIndex` will be populated at runtime.
  const hosts = {
    nova: {
      id: 'nova',
      name: 'Nova',
      persona: {
        humor: 0.7,
        energy: 0.8,
        formality: 0.4,
        debate: 0.5,
        empathy: 0.7,
      },
      mouthEl: document.getElementById('mouth-nova'),
      avatarEl: document.getElementById('avatar-nova'),
      voiceIndex: null,
      mouthInterval: null,
    },
    atlas: {
      id: 'atlas',
      name: 'Atlas',
      persona: {
        humor: 0.4,
        energy: 0.3,
        formality: 0.7,
        debate: 0.6,
        empathy: 0.6,
      },
      mouthEl: document.getElementById('mouth-atlas'),
      avatarEl: document.getElementById('avatar-atlas'),
      voiceIndex: null,
      mouthInterval: null,
    },
  };

  // Episode storage
  let episodes = [];
  // Currently loaded episode (for studio playback)
  let currentEpisode = null;

  // Message queue for sequential speech
  const messageQueue = [];
  let speaking = false;
  let lastSpeaker = null;

  /* ------------------------------------------------------------------
   * DOM references
   * ------------------------------------------------------------------ */
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');
  const libraryList = document.getElementById('library-list');
  const emptyLibraryMsg = document.getElementById('empty-library');
  const createForm = document.getElementById('create-form');
  const statusMsg = document.getElementById('generate-status');
  const transcriptEl = document.getElementById('transcript');
  const callInInput = document.getElementById('callin-input');
  const callInSend = document.getElementById('callin-send');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-description');
  const modalNotes = document.getElementById('modal-notes');
  const modalQuotes = document.getElementById('modal-quotes');
  const modalTranscript = document.getElementById('modal-transcript');
  const modalNextTopics = document.getElementById('modal-next-topics');
  const modalClose = document.getElementById('modal-close');
  const novaVoiceSelect = document.getElementById('nova-voice-select');
  const atlasVoiceSelect = document.getElementById('atlas-voice-select');

  /* ------------------------------------------------------------------
   * Utility functions
   * ------------------------------------------------------------------ */

  /**
   * Save episodes array to localStorage
   */
  function saveEpisodes() {
    try {
      localStorage.setItem('dualcastEpisodes', JSON.stringify(episodes));
    } catch (err) {
      console.warn('Failed to persist episodes', err);
    }
  }

  /**
   * Load episodes from localStorage
   */
  function loadEpisodes() {
    const raw = localStorage.getItem('dualcastEpisodes');
    if (raw) {
      try {
        episodes = JSON.parse(raw) || [];
      } catch (err) {
        console.warn('Failed to parse episodes from storage', err);
      }
    }
  }

  /**
   * Render the episode cards in the library
   */
  function renderLibrary() {
    libraryList.innerHTML = '';
    if (episodes.length === 0) {
      emptyLibraryMsg.style.display = 'block';
      return;
    }
    emptyLibraryMsg.style.display = 'none';
    episodes.forEach((ep, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h4>${escapeHtml(ep.title)}</h4>
        <p class="meta">${escapeHtml(ep.date)}</p>
        <p class="desc">${escapeHtml(ep.descriptionShort)}</p>
      `;
      card.addEventListener('click', () => openEpisodeDetail(index));
      libraryList.appendChild(card);
    });
  }

  /**
   * Sanitize strings for HTML insertion
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Show a specific section by id
   */
  function showSection(id) {
    sections.forEach((sec) => {
      if (sec.id === `${id}-section`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });
    navButtons.forEach((btn) => {
      if (btn.dataset.section === id) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Create an episode using simplified heuristics
   * @param {string} topic
   * @param {string} tone
   * @param {string} length
   * @param {string} difficulty
   */
  function generateEpisode(topic, tone, length, difficulty) {
    // Helper arrays for generating conversation segments
    const openers = [
      () =>
        `Welcome to DualCast! I'm Nova and I'm here with Atlas to dive into ${topic}.`,
      () =>
        `Hey everyone, Nova and Atlas here with another episode of DualCast. We're excited to explore ${topic}.`,
    ];
    const atlasGreetings = [
      () => `Hi Nova, glad to be back. ${capitalizeFirst(topic)} is such an interesting subject.`,
      () => `Always a pleasure, Nova. I'm eager to unpack ${topic} and share some frameworks.`,
    ];
    const topicSetups = [
      () => `So Nova, how would you set the stage for a ${difficulty}-level discussion on ${topic}?`,
      () => `Let's start with the basics: what do listeners need to know about ${topic}?`,
      () => `To kick things off, what's your high‑level take on ${topic}?`,
    ];
    const novaDeepDives = [
      () =>
        `From my perspective, ${topic} touches everything from startups to culture. It's ${tone === 'fun' ? 'exciting' : tone === 'deep' ? 'fascinating' : 'important'}.`,
      () =>
        `${capitalizeFirst(topic)} reminds me of stories in the creator economy—it shapes how people build and share ideas.`,
      () =>
        `If we think about ${topic} through analogies, it's like a bridge between innovation and society, constantly evolving.`,
    ];
    const atlasDeepDives = [
      () =>
        `I like to map ${topic} into systems. Consider its inputs, outputs and feedback loops—it helps us understand long‑term impacts.`,
      () =>
        `When you analyse ${topic} with mental models, you realise it's not just a trend but a paradigm shift.`,
      () =>
        `Let's challenge our assumptions about ${topic}. What if the conventional wisdom is incomplete?`,
    ];
    const tensions = [
      () =>
        `Nova, I think you're focusing too much on the hype. We need to look at the unintended consequences of ${topic}.`,
      () =>
        `Atlas, don't you think you're over‑complicating it? Sometimes ${topic} just comes down to human stories.`,
    ];
    const closings = [
      () =>
        `That's a wrap on ${topic}. Thanks for joining us on DualCast and stay curious!`,
      () =>
        `We hope you enjoyed our conversation on ${topic}. Until next time, keep exploring.`,
    ];

    // Determine number of segments based on requested length
    const numSegments = length === 'short' ? 4 : length === 'long' ? 8 : 6;
    const transcript = [];
    // Cold open
    transcript.push({ speaker: 'nova', text: randomFrom(openers)() });
    transcript.push({ speaker: 'atlas', text: randomFrom(atlasGreetings)() });
    // Topic setup
    transcript.push({ speaker: 'nova', text: randomFrom(topicSetups)() });
    transcript.push({ speaker: 'atlas', text: randomFrom(topicSetups)() });
    // Deep dive / alternating commentary
    for (let i = 0; i < numSegments - 3; i++) {
      if (i % 2 === 0) {
        transcript.push({ speaker: 'nova', text: randomFrom(novaDeepDives)() });
      } else {
        transcript.push({ speaker: 'atlas', text: randomFrom(atlasDeepDives)() });
      }
      // Occasionally insert a tension exchange
      if (Math.random() < 0.25) {
        transcript.push({ speaker: 'atlas', text: tensions[0]() });
        transcript.push({ speaker: 'nova', text: tensions[1]() });
      }
    }
    // Closing
    transcript.push({ speaker: 'nova', text: randomFrom(closings)() });
    transcript.push({ speaker: 'atlas', text: randomFrom(closings)() });

    // Generate metadata
    const title = `${capitalizeFirst(topic)} with Nova & Atlas`;
    const descriptionShort = `A ${tone} ${difficulty}‑level chat about ${topic}.`;
    const showNotes = [
      `Introduction to ${topic}`,
      `Key perspectives from Nova and Atlas`,
      `Frameworks and analogies to understand ${topic}`,
      `Debates and different viewpoints`,
    ];
    const highlightQuotes = transcript
      .filter((_, idx) => idx < 6)
      .map((t) => `${hosts[t.speaker].name}: ${t.text}`);
    const nextTopics = [
      `Future of ${topic}`,
      `Ethics of ${topic}`,
      `How ${topic} impacts creativity`,
    ];
    return {
      title,
      descriptionShort,
      date: new Date().toLocaleString(),
      topic,
      tone,
      length,
      difficulty,
      transcript,
      showNotes,
      highlightQuotes,
      nextTopics,
    };
  }

  /**
   * Utility: pick a random element from an array
   */
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Capitalize first letter
   */
  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Append a message to the transcript UI
   */
  function appendToTranscript(who, text) {
    const p = document.createElement('p');
    const span = document.createElement('span');
    span.className = who === 'user' ? 'user' : 'host';
    span.textContent = who === 'user' ? 'You' : hosts[who].name;
    p.appendChild(span);
    p.appendChild(document.createTextNode(`: ${text}`));
    transcriptEl.appendChild(p);
    // Scroll to bottom
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  /**
   * Enqueue a host message for speech synthesis and display
   */
  function speakMessage(hostId, text) {
    messageQueue.push({ hostId, text });
    processQueue();
  }

  /**
   * Process message queue sequentially
   */
  function processQueue() {
    if (speaking) return;
    if (messageQueue.length === 0) return;
    const { hostId, text } = messageQueue.shift();
    speaking = true;
    lastSpeaker = hostId;
    appendToTranscript(hostId, text);
    const utter = new SpeechSynthesisUtterance(text);
    // Apply host voice if selected
    const voices = speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const index = hosts[hostId].voiceIndex;
      if (typeof index === 'number' && index >= 0 && voices[index]) {
        utter.voice = voices[index];
      }
    }
    // Adjust rate and pitch based on host energy and formality
    utter.rate = 1 + hosts[hostId].persona.energy * 0.4;
    utter.pitch = 1 + (0.5 - hosts[hostId].persona.formality) * 0.4;
    // Start lip sync animations
    startLipSync(hostId, utter);
    // Provide a timeout fallback in case the speech system fails to fire
    // the onend event (e.g. when running headless). We approximate
    // duration based on word count: roughly 2.5 words per second.
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedDuration = Math.max(800, (wordCount / 2.5) * 1000);
    let fallbackTimer;
    utter.onend = () => {
      clearTimeout(fallbackTimer);
      stopLipSync(hostId);
      speaking = false;
      setTimeout(processQueue, 200);
    };
    // Start speaking via Web Speech API if available
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speak) {
      speechSynthesis.speak(utter);
      // Set fallback timer
      fallbackTimer = setTimeout(() => {
        try {
          speechSynthesis.cancel();
        } catch (err) {
          /* ignore */
        }
        if (speaking) {
          stopLipSync(hostId);
          speaking = false;
          processQueue();
        }
      }, estimatedDuration + 300);
    } else {
      // No speech synthesis available: simulate duration
      setTimeout(() => {
        stopLipSync(hostId);
        speaking = false;
        processQueue();
      }, estimatedDuration);
    }
  }

  /**
   * Start lip sync animation for a host during speech
   */
  function startLipSync(hostId, utter) {
    const host = hosts[hostId];
    host.avatarEl.classList.add('speaking');
    // Animate mouth open/close at a frequency relative to speech rate
    const baseInterval = 120;
    const interval = baseInterval / utter.rate;
    host.mouthInterval = setInterval(() => {
      // Randomly scale the mouth height between 1 and 3 times its base size
      const scaleY = 1 + Math.random() * 2;
      host.mouthEl.style.transform = `scaleY(${scaleY})`;
    }, interval);
  }

  /**
   * Stop lip sync animation for a host
   */
  function stopLipSync(hostId) {
    const host = hosts[hostId];
    host.avatarEl.classList.remove('speaking');
    if (host.mouthInterval) {
      clearInterval(host.mouthInterval);
      host.mouthInterval = null;
    }
    host.mouthEl.style.transform = 'scaleY(1)';
  }

  /**
   * Handle user call‑in submission
   */
  function handleCallIn() {
    const text = callInInput.value.trim();
    if (!text) return;
    appendToTranscript('user', text);
    callInInput.value = '';
    // Simple response logic: alternate speakers and provide a generic reply
    const responder = lastSpeaker === 'nova' ? 'atlas' : 'nova';
    const replyOptions = [
      () => `Thanks for that insight. ${capitalizeFirst(text)} is a great point that ties back to our topic.`,
      () => `Interesting question! My take is that ${text.toLowerCase()} shows how this affects real people.`,
      () => `Appreciate your comment. It adds nuance to the ${currentEpisode ? currentEpisode.topic : 'discussion'}.`,
    ];
    const reply = randomFrom(replyOptions)();
    speakMessage(responder, reply);
  }

  /**
   * Populate voice dropdowns once voices are available
   */
  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    // Populate selects
    [novaVoiceSelect, atlasVoiceSelect].forEach((select) => {
      select.innerHTML = '';
      voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(option);
      });
    });
    // Choose default voices heuristically: first female for Nova, first male for Atlas
    const female = voices.findIndex((v) => /female|feminine/i.test(v.name));
    const male = voices.findIndex((v) => /male|masculine/i.test(v.name));
    hosts.nova.voiceIndex = female >= 0 ? female : 0;
    hosts.atlas.voiceIndex = male >= 0 ? male : 1;
    novaVoiceSelect.value = hosts.nova.voiceIndex;
    atlasVoiceSelect.value = hosts.atlas.voiceIndex;
  }

  /* ------------------------------------------------------------------
   * Event listeners
   * ------------------------------------------------------------------ */

  // Navigation
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.section);
    });
  });

  // Form submission
  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('topic-input').value.trim();
    const tone = document.getElementById('tone-select').value;
    const length = document.getElementById('length-select').value;
    const difficulty = document.getElementById('difficulty-select').value;
    if (!topic) return;
    statusMsg.textContent = 'Generating episode...';
    // Generate episode (synchronously since it's a simple function)
    const ep = generateEpisode(topic, tone, length, difficulty);
    episodes.unshift(ep);
    saveEpisodes();
    renderLibrary();
    statusMsg.textContent = 'Episode generated! You can find it in your library or head to the Live Studio.';
    currentEpisode = ep;
    // Reset form fields
    createForm.reset();
    // Navigate to library
    showSection('library');
  });

  // Voice selection
  novaVoiceSelect.addEventListener('change', (e) => {
    hosts.nova.voiceIndex = parseInt(e.target.value, 10);
  });
  atlasVoiceSelect.addEventListener('change', (e) => {
    hosts.atlas.voiceIndex = parseInt(e.target.value, 10);
  });

  // Host sliders
  document.querySelectorAll('#settings-section input[type="range"]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const [id, prop] = e.target.id.split('-');
      hosts[id].persona[prop] = parseFloat(e.target.value);
    });
  });

  // Call‑in send button
  callInSend.addEventListener('click', handleCallIn);
  // Call‑in enter key
  callInInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCallIn();
    }
  });

  // Modal close
  modalClose.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  /**
   * Open episode detail modal
   */
  function openEpisodeDetail(index) {
    const ep = episodes[index];
    if (!ep) return;
    modalTitle.textContent = ep.title;
    modalDesc.textContent = ep.descriptionShort;
    // Show notes
    modalNotes.innerHTML = '';
    ep.showNotes.forEach((note) => {
      const li = document.createElement('li');
      li.textContent = note;
      modalNotes.appendChild(li);
    });
    // Highlight quotes
    modalQuotes.innerHTML = '';
    ep.highlightQuotes.forEach((quote) => {
      const li = document.createElement('li');
      li.textContent = quote;
      modalQuotes.appendChild(li);
    });
    // Transcript
    modalTranscript.innerHTML = '';
    ep.transcript.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = `${hosts[line.speaker].name}: ${line.text}`;
      modalTranscript.appendChild(li);
    });
    // Next topics
    modalNextTopics.innerHTML = '';
    ep.nextTopics.forEach((nt) => {
      const li = document.createElement('li');
      li.textContent = nt;
      modalNextTopics.appendChild(li);
    });
    modal.classList.remove('hidden');
  }

  /**
   * Start playback of current episode in the live studio
   */
  function playCurrentEpisode() {
    if (!currentEpisode) return;
    // Clear existing transcript
    transcriptEl.innerHTML = '';
    // Enqueue all lines sequentially
    currentEpisode.transcript.forEach((line) => {
      speakMessage(line.speaker, line.text);
    });
  }

  /* ------------------------------------------------------------------
   * Initialization
   * ------------------------------------------------------------------ */
  loadEpisodes();
  renderLibrary();
  // Use the latest episode as the current one on load
  if (episodes.length > 0) {
    currentEpisode = episodes[0];
  }
  // Set initial section
  showSection('library');
  // Populate voices when available
  populateVoices();
  // Safari/Chrome may fire voiceschanged event when voices are loaded
  if (typeof speechSynthesis !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  // When user navigates to live studio, play current episode transcript
  document.querySelector('[data-section="studio"]').addEventListener('click', () => {
    playCurrentEpisode();
  });
});