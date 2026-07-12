const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0; // Starts muted
masterGain.connect(audioCtx.destination);

// Base frequency (C4)
const baseFreq = 261.63;
let currentVolume = 0; // Starts at 0

function updateVolume(e) {
    if(audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const val = parseInt(e.target.value, 10); // 0 to 100
    currentVolume = val / 100.0;
    
    const maxGain = 0.6;
    masterGain.gain.setTargetAtTime(currentVolume * maxGain, audioCtx.currentTime, 0.05);

    // Update color based on volume level
    const palette = ['#aaaaaa', '#39FF14', '#00FFFF', '#FF00FF', '#FFA000', '#FFFF00', '#B200FF'];
    let colorIndex = 0;
    if (val > 0) {
        colorIndex = Math.ceil((val / 100) * 6);
        if(colorIndex > 6) colorIndex = 6;
    }
    
    const chosenColor = palette[colorIndex];
    e.target.style.setProperty('--fader-color', chosenColor);
}

// Function to play a tine note using FM Synthesis
function playTineNote(freq, isBass = false) {
    if(currentVolume === 0) return;

    const t = audioCtx.currentTime;
    
    // Create Carrier
    const carrier = audioCtx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, t);
    
    // Create Modulator (FM) for the metallic 'tine' hit
    const modulator = audioCtx.createOscillator();
    modulator.type = 'sine';
    // Ratio 14 is classic for DX7-style tines
    modulator.frequency.setValueAtTime(freq * 14, t);
    
    // Envelope for Carrier (Amplitude)
    const carrierGain = audioCtx.createGain();
    carrierGain.gain.setValueAtTime(0, t);
    
    // Envelope for Modulator (Index / Timbre)
    const modGain = audioCtx.createGain();
    modGain.gain.setValueAtTime(0, t);
    
    // Connect Modulator -> ModGain -> Carrier.frequency
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    
    // Connect Carrier -> CarrierGain -> MasterGain
    carrier.connect(carrierGain);
    carrierGain.connect(masterGain);
    
    // Set envelopes
    const attackTime = 0.01;
    // Bass notes get double decay
    const decayTime = isBass ? 4.0 : 2.0; 
    
    // Carrier Envelope (Volume)
    // Bass notes can be slightly louder to compensate for human hearing at low freq
    const peakVolume = isBass ? 0.9 : 0.5;
    carrierGain.gain.linearRampToValueAtTime(peakVolume, t + attackTime);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, t + attackTime + decayTime);
    
    // Modulator Envelope (Timbre brightness)
    // High modulation index at attack, drops very quickly to create a percussive hit
    modGain.gain.linearRampToValueAtTime(freq * 3, t + attackTime);
    modGain.gain.exponentialRampToValueAtTime(0.001, t + attackTime + 0.3);
    
    // Start and Stop
    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + attackTime + decayTime);
    modulator.stop(t + attackTime + decayTime);
}

document.addEventListener('DOMContentLoaded', () => {
    const fader = document.getElementById('volume-fader');
    if (fader) {
        fader.addEventListener('input', updateVolume);
        // Initialize color
        fader.style.setProperty('--fader-color', '#aaaaaa');
    }

    const dorianSteps = [0, 2, 4, 6, 8, 11, 12, 14, 16, 18, 20, 22, 25, 26];

    const credoItems = document.querySelectorAll('.credo-item');
    credoItems.forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
            // Calculate 14-TET frequency using the dorian scale mapped to 2 octaves
            const step = dorianSteps[index] || 0;
            const freq = baseFreq * Math.pow(2, step / 14);
            playTineNote(freq, false);
        });
    });

    const credoTitle = document.getElementById('credo-title');
    if(credoTitle) {
        credoTitle.addEventListener('mouseenter', () => {
            // Bass note base frequency (C3 = 130.81Hz)
            // C3 is readable on laptops while still acting as a bass foundation to C4
            const baseBassFreq = 130.81;
            
            // Randomly pick root(0), fifth(8), or seventh(11 or 12)
            // 11 is closer to the harmonic seventh, 12 is closer to a minor seventh. Let's include both.
            const options = [0, 8, 11, 12];
            const chosenIndex = options[Math.floor(Math.random() * options.length)];
            
            const bassFreq = baseBassFreq * Math.pow(2, chosenIndex / 14);
            playTineNote(bassFreq, true);
        });
    }
});
