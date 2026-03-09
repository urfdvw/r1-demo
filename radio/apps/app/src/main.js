// Web Radio Player for R1 Device
// Supports streaming audio with dynamic playback controls

// Check if running as R1 plugin
if (typeof PluginMessageHandler !== 'undefined') {
  console.log('Running as R1 Creation');
} else {
  console.log('Running in browser mode');
}

// ===========================================
// Audio Player State
// ===========================================

const DEFAULT_STREAM_URL = 'https://radio.gotanno.love/;?type=http&nocache=2997';
const DEFAULT_MIME_TYPE = 'audio/mpeg';

let audioElement = null;
let isPlaying = false;
let currentUrl = '';

// ===========================================
// DOM Elements
// ===========================================

let urlInput;
let playStopBtn;
let statusDisplay;
let trackInfoDisplay;

// ===========================================
// Audio Player Functions
// ===========================================

function initAudioElement() {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = 'none';
    audioElement.crossOrigin = 'anonymous';
    
    // Handle audio events
    audioElement.addEventListener('play', handleAudioPlay);
    audioElement.addEventListener('pause', handleAudioPause);
    audioElement.addEventListener('ended', handleAudioEnded);
    audioElement.addEventListener('error', handleAudioError);
    audioElement.addEventListener('loadstart', handleLoadStart);
    audioElement.addEventListener('canplay', handleCanPlay);
    
    // Try to extract metadata
    audioElement.addEventListener('loadedmetadata', handleMetadata);
  }
}

function handleAudioPlay() {
  isPlaying = true;
  updateUI();
  console.log('Audio started playing');
}

function handleAudioPause() {
  isPlaying = false;
  updateUI();
  console.log('Audio paused');
}

function handleAudioEnded() {
  isPlaying = false;
  updateUI();
  console.log('Audio ended');
}

function handleAudioError(e) {
  console.error('Audio error:', e);
  isPlaying = false;
  statusDisplay.textContent = 'Error';
  trackInfoDisplay.textContent = 'Failed to load stream. Check URL and try again.';
  playStopBtn.textContent = 'Play';
  playStopBtn.classList.remove('playing');
  playStopBtn.classList.add('stopped');
}

function handleLoadStart() {
  statusDisplay.textContent = 'Loading...';
  trackInfoDisplay.textContent = 'Connecting to stream...';
}

function handleCanPlay() {
  if (isPlaying) {
    statusDisplay.textContent = 'Playing';
    trackInfoDisplay.textContent = currentUrl;
  }
}

function handleMetadata() {
  console.log('Metadata loaded');
  // Basic metadata from audio element (limited for streams)
  if (audioElement.duration && !isNaN(audioElement.duration) && audioElement.duration !== Infinity) {
    trackInfoDisplay.textContent = `Duration: ${Math.floor(audioElement.duration)}s`;
  }
}

async function playStream(url) {
  if (!url || url.trim() === '') {
    trackInfoDisplay.textContent = 'Please enter a valid URL';
    return;
  }
  
  initAudioElement();
  
  try {
    currentUrl = url;
    
    // Set the source with proper MIME type handling
    audioElement.src = url;
    audioElement.type = DEFAULT_MIME_TYPE;
    
    // Force load the audio
    audioElement.load();
    
    // Attempt to play
    const playPromise = audioElement.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Playback started successfully');
          isPlaying = true;
          updateUI();
        })
        .catch(error => {
          console.error('Playback failed:', error);
          statusDisplay.textContent = 'Error';
          trackInfoDisplay.textContent = 'Playback failed. Check URL format.';
        });
    }
  } catch (error) {
    console.error('Error playing stream:', error);
    statusDisplay.textContent = 'Error';
    trackInfoDisplay.textContent = 'Failed to play stream';
  }
}

function stopStream() {
  if (audioElement) {
    audioElement.pause();
    isPlaying = false;
    updateUI();
  }
}

function resumeStream() {
  if (audioElement && currentUrl) {
    audioElement.play()
      .then(() => {
        isPlaying = true;
        updateUI();
      })
      .catch(error => {
        console.error('Resume failed:', error);
        statusDisplay.textContent = 'Error';
        trackInfoDisplay.textContent = 'Failed to resume playback';
      });
  }
}

// ===========================================
// UI Update Functions
// ===========================================

function updateUI() {
  if (isPlaying) {
    playStopBtn.textContent = 'Stop';
    playStopBtn.classList.add('playing');
    playStopBtn.classList.remove('stopped');
    statusDisplay.textContent = 'Playing';
    if (!trackInfoDisplay.textContent || trackInfoDisplay.textContent === 'Stopped') {
      trackInfoDisplay.textContent = currentUrl;
    }
  } else {
    if (currentUrl) {
      playStopBtn.textContent = 'Resume';
    } else {
      playStopBtn.textContent = 'Play';
    }
    playStopBtn.classList.remove('playing');
    playStopBtn.classList.add('stopped');
    statusDisplay.textContent = 'Stopped';
  }
}

// ===========================================
// Button Handler
// ===========================================

function handlePlayStopClick() {
  const url = urlInput.value.trim();
  
  if (isPlaying) {
    // Stop playback
    stopStream();
  } else {
    if (currentUrl && audioElement && audioElement.src) {
      // Resume existing stream
      resumeStream();
    } else if (url) {
      // Start new stream
      playStream(url);
    } else {
      // No URL entered
      statusDisplay.textContent = 'Error';
      trackInfoDisplay.textContent = 'Please enter a stream URL';
    }
  }
}

// ===========================================
// Persistent Storage
// ===========================================

async function saveLastUrl(url) {
  if (window.creationStorage) {
    try {
      const encoded = btoa(JSON.stringify({ lastUrl: url }));
      await window.creationStorage.plain.setItem('radio_data', encoded);
    } catch (e) {
      console.error('Error saving URL:', e);
    }
  } else {
    localStorage.setItem('radio_data', JSON.stringify({ lastUrl: url }));
  }
}

async function loadLastUrl() {
  if (window.creationStorage) {
    try {
      const stored = await window.creationStorage.plain.getItem('radio_data');
      if (stored) {
        const data = JSON.parse(atob(stored));
        return data.lastUrl;
      }
    } catch (e) {
      console.error('Error loading URL:', e);
    }
  } else {
    const stored = localStorage.getItem('radio_data');
    if (stored) {
      const data = JSON.parse(stored);
      return data.lastUrl;
    }
  }
  return null;
}

// ===========================================
// Hardware Event Handlers
// ===========================================

window.addEventListener('sideClick', () => {
  console.log('Side button clicked');
  handlePlayStopClick();
});

window.addEventListener('scrollUp', () => {
  console.log('Scroll up detected');
});

window.addEventListener('scrollDown', () => {
  console.log('Scroll down detected');
});

// ===========================================
// Initialization
// ===========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Web Radio Player initialized!');
  
  // Get DOM elements
  urlInput = document.getElementById('urlInput');
  playStopBtn = document.getElementById('playStopBtn');
  statusDisplay = document.getElementById('status');
  trackInfoDisplay = document.getElementById('trackInfo');
  
  // Load last used URL or set default
  const lastUrl = await loadLastUrl();
  if (lastUrl) {
    urlInput.value = lastUrl;
    currentUrl = lastUrl;
  } else {
    // Set default stream URL
    urlInput.value = DEFAULT_STREAM_URL;
    currentUrl = DEFAULT_STREAM_URL;
    await saveLastUrl(DEFAULT_STREAM_URL);
  }
  
  // Button click handler
  playStopBtn.addEventListener('click', handlePlayStopClick);
  
  // Save URL when it changes
  urlInput.addEventListener('change', () => {
    const url = urlInput.value.trim();
    if (url) {
      saveLastUrl(url);
    }
  });
  
  // Keyboard fallback for development (Space = side button)
  if (typeof PluginMessageHandler === 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('sideClick'));
      }
    });
  }
  
  // Initialize UI
  updateUI();
  
  console.log('Web Radio Player ready!');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }
});
