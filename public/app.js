// public/app.js
const USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);

document.addEventListener('DOMContentLoaded', function () {
  console.log('Imhotep-III App initialized for user:', USER_ID);
  updateWalletDisplay();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('recordUpload').addEventListener('change', handleFileUpload);
  document.getElementById('userInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('uploadResult').style.display = 'block';
  document.getElementById('uploadResult').innerHTML = `
    <div style="color: var(--accent); font-weight:bold;">
      📤 Uploading "${file.name}"... Please wait
    </div>`;

  const formData = new FormData();
  formData.append('record', file);
  formData.append('userId', USER_ID);

  try {
    const response = await fetch('/api/upload-record', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (result.success) {
      document.getElementById('uploadResult').innerHTML = `
        <div style="color: var(--primary); font-weight:bold;">
          ✅ ${result.message}<br>
          <small>Extracted: ${result.extractedText || ''}</small>
        </div>`;
      updateWalletDisplay();
    } else {
      document.getElementById('uploadResult').innerHTML = `
        <div style="color:red; font-weight:bold;">
          ❌ ${result.error || 'Upload failed'}
        </div>`;
    }
  } catch (err) {
    console.error('upload error', err);
    document.getElementById('uploadResult').innerHTML = `
      <div style="color:red; font-weight:bold;">
        ❌ Network error: ${err.message}
      </div>`;
  }

  event.target.value = '';
}

async function addHealthRecord() {
  const recordText = document.getElementById('recordText').value.trim();
  if (!recordText) {
    alert('Please enter some health record information');
    return;
  }

  document.getElementById('uploadResult').style.display = 'block';
  document.getElementById('uploadResult').innerHTML = `
    <div style="color:var(--accent); font-weight:bold;">
      📤 Processing health record... Please wait
    </div>`;

  try {
    const response = await fetch('/api/add-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, recordText })
    });
    const result = await response.json();
    if (result.success) {
      document.getElementById('uploadResult').innerHTML = `
        <div style="color:var(--primary); font-weight:bold;">
          ✅ ${result.message}
        </div>`;
      document.getElementById('recordText').value = '';
      updateWalletDisplay();
    } else {
      document.getElementById('uploadResult').innerHTML = `
        <div style="color:red; font-weight:bold;">
          ❌ ${result.error}
        </div>`;
    }
  } catch (err) {
    console.error('add record error', err);
    document.getElementById('uploadResult').innerHTML = `
      <div style="color:red; font-weight:bold;">
        ❌ Network error: ${err.message}
      </div>`;
  }
}

async function updateWalletDisplay() {
  try {
    const response = await fetch(`/api/wallet/${USER_ID}`);
    const wallet = await response.json();
    document.getElementById('tokenBalance').textContent = `${wallet.balance ?? 0} IMT`;
    document.getElementById('stakedAmount').textContent = `Currently Staked: ${wallet.staked ?? 0} IMT`;
    const claimBtn = document.getElementById('claimStakedBtn');
    claimBtn.disabled = !(wallet.staked > 0);
  } catch (err) {
    console.error('wallet fetch error', err);
    document.getElementById('tokenBalance').textContent = '0 IMT';
    document.getElementById('stakedAmount').textContent = 'Currently Staked: 0 IMT';
  }
}

async function stakeTokens() {
  const amount = parseInt(document.getElementById('stakeAmount').value);
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  try {
    const res = await fetch('/api/stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, amount })
    });
    const result = await res.json();
    if (result.success) {
      alert(`Successfully staked ${amount} IMT!`);
      document.getElementById('stakeAmount').value = '';
      updateWalletDisplay();
    } else {
      alert(result.error || 'Stake failed');
    }
  } catch (err) {
    console.error('staking error', err);
    alert('Staking network error: ' + err.message);
  }
}

async function claimStakedTokens() {
  try {
    const res = await fetch('/api/claim-staked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID })
    });
    const result = await res.json();
    if (result.success) {
      alert(`Successfully claimed ${result.totalClaimed} IMT tokens!`);
      updateWalletDisplay();
    } else {
      alert(result.error || 'Claim failed');
    }
  } catch (err) {
    console.error('claim error', err);
    alert('Claim network error: ' + err.message);
  }
}

// ✅ UPDATED sendMessage (robust to weird shapes & always shows something)
async function sendMessage() {
  const userInput = document.getElementById('userInput');
  const message = userInput.value.trim();
  if (!message) return;

  // Show user message
  addMessageToChat(message, 'user');
  userInput.value = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, message })
    });

    let result;
    try {
      result = await res.json();
    } catch (e) {
      console.error('Failed to parse JSON from /api/chat:', e);
      addMessageToChat('Sorry, I could not understand the server response.', 'bot');
      return;
    }

    console.log('Chat API raw result:', result);

    // Safely extract text
    let botText = '';

    if (result && typeof result.response === 'string' && result.response.trim().length > 0) {
      // Normal, expected case
      botText = result.response.trim();
    } else if (result && typeof result.error === 'string' && result.error.trim().length > 0) {
      // In case backend sends an explicit error
      botText = `AI error: ${result.error}`;
    } else {
      // Last-resort fallback: stringify whatever we got
      botText =
        'AI returned an unexpected response shape: ' +
        JSON.stringify(result).slice(0, 400) +
        '...';
    }

    addMessageToChat(botText, 'bot');
  } catch (err) {
    console.error('chat error', err);
    addMessageToChat(
      'Sorry, I encountered a network or server error while contacting the AI.',
      'bot'
    );
  }
}

function addMessageToChat(message, sender) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  messageDiv.textContent = message;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Expose functions globally
window.handleFileUpload = handleFileUpload;
window.addHealthRecord = addHealthRecord;
window.stakeTokens = stakeTokens;
window.claimStakedTokens = claimStakedTokens;
window.sendMessage = sendMessage;