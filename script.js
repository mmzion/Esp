// =======================================================================================
// IMPORTANT: REPLACE THIS firebaseConfig OBJECT WITH YOUR ACTUAL FIREBASE PROJECT CONFIG
// You can find this in your Firebase project settings -> Project settings -> Your apps -> Web App (</>)
// =======================================================================================
const firebaseConfig = {
   apiKey: "AIzaSyBx5fYrM_mVwn9pfgf5fjSxRIOvB8ViTko",
  authDomain: "esp-test-ff3e3.firebaseapp.com",
  databaseURL: "https://esp-test-ff3e3-default-rtdb.firebaseio.com",
  projectId: "esp-test-ff3e3",
  storageBucket: "esp-test-ff3e3.firebasestorage.app",
  messagingSenderId: "431926409160",
  appId: "1:431926409160:web:534274240d408acecbf2fd" // Optional
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Get DOM elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginStatus = document.getElementById('login-status');
const userEmailDisplay = document.getElementById('user-email');

// Map relay names to their corresponding IDs in HTML
// (Based on your ESP8266 code's relayNames: "Living Room", "Kitchen", "Bedroom", "Garden")
const relayNames = ["Living Room", "Kitchen", "Bedroom", "Garden"];

const relayElements = [];
for (let i = 1; i <= 4; i++) {
    relayElements[i] = {
        statusText: document.getElementById(`relay${i}-status`),
        card: document.getElementById(`relay${i}-card`)
    };
    // Update relay card titles with actual names
    const relayCardTitle = relayElements[i].card.querySelector('h3');
    if (relayCardTitle) {
        relayCardTitle.textContent = relayNames[i - 1];
    }
}

const wifiStatus = document.getElementById('wifi-status');
const firebaseStatus = document.getElementById('firebase-status');
const uptimeDisplay = document.getElementById('uptime-display');
const heartbeatDisplay = document.getElementById('heartbeat-display');

// --- Authentication Logic ---

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    loginStatus.textContent = 'Logging in...';
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("Logged in:", user.email);
            loginStatus.textContent = 'Login successful!';
            // UI will be updated by onAuthStateChanged listener
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error("Login Error:", errorCode, errorMessage);
            loginStatus.textContent = `Login failed: ${errorMessage}`;
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("Signed out");
        // UI will be updated by onAuthStateChanged listener
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
});

// Listener for authentication state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        userEmailDisplay.textContent = user.email;
        startRealtimeListeners(); // Start listening to Firebase DB
    } else {
        // User is signed out
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        userEmailDisplay.textContent = '';
        stopRealtimeListeners(); // Stop listening to Firebase DB
    }
});

// --- Firebase Realtime Database Logic ---

let relayRefs = [];
let systemRef;

function startRealtimeListeners() {
    // Listen for Relay States
    for (let i = 1; i <= 4; i++) {
        relayRefs[i] = database.ref(`/relays/relay${i}`);
        relayRefs[i].on('value', (snapshot) => {
            const state = snapshot.val();
            updateRelayUI(i, state);
        });
    }

    // Listen for System Status
    systemRef = database.ref('/system');
    systemRef.on('value', (snapshot) => {
        const systemData = snapshot.val();
        updateSystemStatusUI(systemData);
    });
}

function stopRealtimeListeners() {
    // Detach listeners to prevent memory leaks if user logs out
    for (let i = 1; i <= 4; i++) {
        if (relayRefs[i]) {
            relayRefs[i].off('value'); // Removes the 'value' listener
        }
    }
    if (systemRef) {
        systemRef.off('value'); // Removes the 'value' listener
    }
    // Reset UI when logged out
    updateRelayUI(1, null); updateRelayUI(2, null); updateRelayUI(3, null); updateRelayUI(4, null);
    updateSystemStatusUI(null);
}

function updateRelayUI(relayNum, state) {
    const statusEl = relayElements[relayNum].statusText;
    const cardEl = relayElements[relayNum].card;

    // Handle initial state or null (before data loads or after logout)
    if (state === null) {
        statusEl.textContent = "UNKNOWN";
        statusEl.classList.remove('on', 'off');
        statusEl.classList.add('unknown');
        cardEl.classList.remove('on', 'off');
        return;
    }

    statusEl.textContent = state ? "ON" : "OFF";
    statusEl.classList.remove('on', 'off', 'unknown');
    statusEl.classList.add(state ? 'on' : 'off');

    cardEl.classList.remove('on', 'off'); // Remove previous state class
    cardEl.classList.add(state ? 'on' : 'off'); // Add current state class to card for styling if needed
}

function updateSystemStatusUI(data) {
    // WiFi Status
    if (data && data.status) {
        wifiStatus.textContent = data.status === 'online' ? 'Connected' : 'Disconnected';
        wifiStatus.classList.remove('online', 'offline', 'unknown');
        wifiStatus.classList.add(data.status === 'online' ? 'online' : 'offline');
    } else {
        wifiStatus.textContent = 'UNKNOWN';
        wifiStatus.classList.remove('online', 'offline');
        wifiStatus.classList.add('unknown');
    }

    // Firebase Status (assuming if system data exists, Firebase is active on ESP)
    // This is more about ESP's internal Firebase connection status reported via its heartbeat.
    if (data && data.status) { // If the ESP is sending heartbeats, it implies it's connected to Firebase
        firebaseStatus.textContent = 'Ready';
        firebaseStatus.classList.remove('offline', 'unknown');
        firebaseStatus.classList.add('online');
    } else {
        firebaseStatus.textContent = 'Not Ready';
        firebaseStatus.classList.remove('online', 'unknown');
        firebaseStatus.classList.add('offline');
    }

    // Last Heartbeat
    if (data && data.last_heartbeat) {
        const date = new Date(data.last_heartbeat);
        heartbeatDisplay.textContent = date.toLocaleString();
    } else {
        heartbeatDisplay.textContent = 'N/A';
    }

    // Uptime - Your current ESP8266 code tracks uptime with millis() but doesn't send it to Firebase.
    // So, this will remain "N/A" unless you add `Firebase.RTDB.setLong(&fbdo, "/system/uptime", millis());`
    // in your ESP code and update this JS to display it.
    uptimeDisplay.textContent = 'N/A';
}

// --- Relay Control Logic ---
document.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        const relayNum = parseInt(event.target.dataset.relay);
        const currentRef = database.ref(`/relays/relay${relayNum}`);

        currentRef.once('value').then(snapshot => {
            const currentState = snapshot.val();
            // Toggle the state (true -> false, false -> true)
            const newState = !currentState;
            currentRef.set(newState)
                .then(() => console.log(`Relay ${relayNum} toggled to ${newState}`))
                .catch(error => console.error(`Error toggling relay ${relayNum}:`, error));
        }).catch(error => console.error(`Error reading current state for relay ${relayNum}:`, error));
    });
});
