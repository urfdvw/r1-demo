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
const DEFAULT_VOLUME = 0.7;
const VOLUME_STEP = 0.05;

let audioElement = null;
let isPlaying = false;
let currentUrl = '';
let currentVolume = DEFAULT_VOLUME;
let isScannerActive = false;

// ===========================================
// DOM Elements
// ===========================================

let playStopBtn;
let scanQrBtn;
let statusDisplay;
let trackInfoDisplay;
let volumeDisplay;
let scannerModal;
let scannerVideo;
let scannerStatus;
let closeScannerBtn;

let scannerStream = null;
let scannerFrameRequest = null;
let qrDetector = null;

// ===========================================
// Audio Player Functions
// ===========================================

function initAudioElement() {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = 'none';
    audioElement.crossOrigin = 'anonymous';
    audioElement.volume = currentVolume;
    
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
    saveSettings(currentUrl, currentVolume);
    
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

function clampVolume(volume) {
  return Math.min(1, Math.max(0, volume));
}

function updateVolumeDisplay() {
  if (volumeDisplay) {
    volumeDisplay.textContent = `Volume: ${Math.round(currentVolume * 100)}%`;
  }
}

function setVolume(volume) {
  currentVolume = clampVolume(volume);

  if (audioElement) {
    audioElement.volume = currentVolume;
  }

  updateVolumeDisplay();
}

function changeVolume(delta) {
  const previousVolume = currentVolume;
  setVolume(currentVolume + delta);

  if (previousVolume !== currentVolume) {
    console.log(`Volume changed: ${Math.round(currentVolume * 100)}%`);
    const urlToSave = currentUrl || DEFAULT_STREAM_URL;
    saveSettings(urlToSave, currentVolume);
  }
}

function isValidStationUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function setScannerButtonState(scanning) {
  if (!scanQrBtn) return;

  scanQrBtn.disabled = scanning;
  scanQrBtn.textContent = scanning ? 'Scanning...' : 'Scan Station QR';
}

function cleanupScannerResources() {
  if (scannerFrameRequest) {
    cancelAnimationFrame(scannerFrameRequest);
    scannerFrameRequest = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  if (scannerVideo) {
    scannerVideo.pause();
    scannerVideo.srcObject = null;
  }
}

function stopQrScanner() {
  isScannerActive = false;
  cleanupScannerResources();
  if (scannerModal) {
    scannerModal.classList.add('hidden');
  }
  if (scannerStatus) {
    scannerStatus.textContent = 'Point camera at station QR';
  }
  setScannerButtonState(false);
}

async function processDetectedQrValue(rawValue) {
  const value = rawValue?.trim();
  if (!value) return false;

  if (!isValidStationUrl(value)) {
    if (scannerStatus) {
      scannerStatus.textContent = 'QR is not a valid URL';
    }
    return false;
  }

  currentUrl = value;
  saveSettings(currentUrl, currentVolume);
  trackInfoDisplay.textContent = currentUrl;

  if (isPlaying) {
    await playStream(currentUrl);
  } else {
    updateUI();
  }

  stopQrScanner();
  return true;
}

async function scanQrFrame() {
  if (!isScannerActive || !qrDetector || !scannerVideo) return;

  try {
    const barcodes = await qrDetector.detect(scannerVideo);
    if (barcodes.length > 0) {
      const handled = await processDetectedQrValue(barcodes[0].rawValue);
      if (handled) return;
    }
  } catch (error) {
    // Detection can fail on intermediate frames while camera is warming up.
    console.debug('QR scan frame skipped:', error);
  }

  if (isScannerActive) {
    scannerFrameRequest = requestAnimationFrame(scanQrFrame);
  }
}

async function startQrScanner() {
  if (isScannerActive) return;

  if (!window.isSecureContext && location.hostname !== 'localhost') {
    trackInfoDisplay.textContent = 'Camera requires HTTPS';
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    trackInfoDisplay.textContent = 'Camera API not available';
    return;
  }

  if (typeof BarcodeDetector === 'undefined') {
    trackInfoDisplay.textContent = 'QR scan not supported on this WebView';
    return;
  }

  try {
    qrDetector = new BarcodeDetector({ formats: ['qr_code'] });
  } catch (error) {
    console.error('BarcodeDetector init failed:', error);
    trackInfoDisplay.textContent = 'QR scanner unavailable';
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }
      },
      audio: false
    });

    scannerVideo.srcObject = scannerStream;
    await scannerVideo.play();

    isScannerActive = true;
    scannerModal.classList.remove('hidden');
    scannerStatus.textContent = 'Point camera at station QR';
    setScannerButtonState(true);

    scannerFrameRequest = requestAnimationFrame(scanQrFrame);
  } catch (error) {
    console.error('Unable to start camera:', error);
    cleanupScannerResources();
    setScannerButtonState(false);
    trackInfoDisplay.textContent = 'Camera permission denied or unavailable';
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

  updateVolumeDisplay();
}

// ===========================================
// Button Handler
// ===========================================

function handlePlayStopClick() {
  if (isPlaying) {
    // Stop playback
    stopStream();
  } else {
    if (currentUrl && audioElement && audioElement.src) {
      // Resume existing stream
      resumeStream();
    } else if (currentUrl) {
      // Start new stream
      playStream(currentUrl);
    } else {
      // No station selected
      statusDisplay.textContent = 'Error';
      trackInfoDisplay.textContent = 'Scan a station QR first';
    }
  }
}

// ===========================================
// Persistent Storage
// ===========================================

async function saveSettings(url = currentUrl, volume = currentVolume) {
  const payload = {
    lastUrl: url,
    volume: clampVolume(volume)
  };

  if (window.creationStorage) {
    try {
      const encoded = btoa(JSON.stringify(payload));
      await window.creationStorage.plain.setItem('radio_data', encoded);
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  } else {
    localStorage.setItem('radio_data', JSON.stringify(payload));
  }
}

async function loadSettings() {
  let settings = null;

  if (window.creationStorage) {
    try {
      const stored = await window.creationStorage.plain.getItem('radio_data');
      if (stored) {
        settings = JSON.parse(atob(stored));
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  } else {
    const stored = localStorage.getItem('radio_data');
    if (stored) {
      settings = JSON.parse(stored);
    }
  }

  return {
    lastUrl: typeof settings?.lastUrl === 'string' ? settings.lastUrl : null,
    volume: typeof settings?.volume === 'number' ? clampVolume(settings.volume) : DEFAULT_VOLUME
  };
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
  changeVolume(VOLUME_STEP);
});

window.addEventListener('scrollDown', () => {
  console.log('Scroll down detected');
  changeVolume(-VOLUME_STEP);
});

// ===========================================
// Initialization
// ===========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Web Radio Player initialized!');
  
  // Get DOM elements
  playStopBtn = document.getElementById('playStopBtn');
  scanQrBtn = document.getElementById('scanQrBtn');
  statusDisplay = document.getElementById('status');
  trackInfoDisplay = document.getElementById('trackInfo');
  volumeDisplay = document.getElementById('volume');
  scannerModal = document.getElementById('scannerModal');
  scannerVideo = document.getElementById('scannerVideo');
  scannerStatus = document.getElementById('scannerStatus');
  closeScannerBtn = document.getElementById('closeScannerBtn');
  
  // Load last used settings
  const { lastUrl, volume } = await loadSettings();
  setVolume(volume);

  // Load last used URL or set default
  if (lastUrl) {
    currentUrl = lastUrl;
  } else {
    currentUrl = DEFAULT_STREAM_URL;
    await saveSettings(DEFAULT_STREAM_URL, currentVolume);
  }

  if (currentUrl) {
    trackInfoDisplay.textContent = currentUrl;
  }
  
  // Button click handler
  playStopBtn.addEventListener('click', handlePlayStopClick);

  scanQrBtn.addEventListener('click', startQrScanner);
  closeScannerBtn.addEventListener('click', stopQrScanner);
  scannerModal.addEventListener('click', (event) => {
    if (event.target === scannerModal) {
      stopQrScanner();
    }
  });
  
  // Keyboard + wheel fallback for development
  if (typeof PluginMessageHandler === 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('sideClick'));
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault();
        changeVolume(VOLUME_STEP);
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault();
        changeVolume(-VOLUME_STEP);
      }
    });

    window.addEventListener('wheel', (event) => {
      event.preventDefault();
      changeVolume(event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP);
    }, { passive: false });
  }
  
  // Initialize UI
  updateUI();
  
  console.log('Web Radio Player ready!');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopQrScanner();
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }
});
