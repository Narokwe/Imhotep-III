let USER_ID = localStorage.getItem('imhotep_user_id');
if (!USER_ID) {
  USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('imhotep_user_id', USER_ID);
}

document.addEventListener('DOMContentLoaded', function () {
  console.log('Imhotep-III App initialized for user:', USER_ID);
  updateWalletDisplay();
  setupEventListeners();
});

function setupEventListeners() {
  const recordUpload = document.getElementById('recordUpload');
  if (recordUpload) {
    recordUpload.addEventListener('change', handleFileUpload);
  }

  
  const userInput = document.getElementById('userInput');
  if (userInput) {
    
    userInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    
    userInput.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadResultEl = document.getElementById('uploadResult');
  if (uploadResultEl) {
    uploadResultEl.style.display = 'block';
    uploadResultEl.innerHTML = `
      <div style="color: var(--accent); font-weight:bold;">
        📤 Uploading "${file.name}"... Please wait
      </div>`;
  }

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
      const txInfo = result.anchored
        ? `<div style="margin-top:.5rem;color:#444">
             Anchored on XRPL — tx: ${result.xrpl?.txHash ?? result.xrpl?.result?.id ?? 'n/a'}
           </div>
           <div style="margin-top:.25rem;font-size:.8rem;color:#666;">
             Record hash: ${result.recordHash ?? ''}
           </div>`
        : '';

      uploadResultEl.innerHTML = `
        <div style="color: var(--primary); font-weight:bold;">
          ✅ ${result.message}<br>
          <small>Extracted: ${result.extractedText || ''}</small>
          ${txInfo}
        </div>`;
      updateWalletDisplay();
    } else {
      uploadResultEl.innerHTML = `
        <div style="color:red; font-weight:bold;">
          ❌ ${result.error || 'Upload failed'}
        </div>`;
    }
  } catch (err) {
    console.error('upload error', err);
    if (uploadResultEl) {
      uploadResultEl.innerHTML = `
        <div style="color:red; font-weight:bold;">
          ❌ Network error: ${err.message}
        </div>`;
    }
  }

  event.target.value = '';
}

async function addHealthRecord() {
  const recordTextEl = document.getElementById('recordText');
  const uploadResultEl = document.getElementById('uploadResult');
  if (!recordTextEl) return;

  const recordText = recordTextEl.value.trim();
  if (!recordText) {
    alert('Please enter some health record information');
    return;
  }

  if (uploadResultEl) {
    uploadResultEl.style.display = 'block';
    uploadResultEl.innerHTML = `
      <div style="color:var(--accent); font-weight:bold;">
        📤 Processing health record... Please wait
      </div>`;
  }

  try {
    const response = await fetch('/api/add-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, recordText })
    });
    const result = await response.json();
    if (result.success) {
      const txInfo = result.anchored
        ? `<div style="margin-top:.5rem;color:#444">
             Anchored on XRPL — tx: ${result.xrpl?.txHash ?? result.xrpl?.result?.id ?? 'n/a'}
           </div>
           <div style="margin-top:.25rem;font-size:.8rem;color:#666;">
             Record hash: ${result.recordHash ?? ''}
           </div>`
        : '';

      if (uploadResultEl) {
        uploadResultEl.innerHTML = `
          <div style="color:var(--primary); font-weight:bold;">
            ✅ ${result.message}
            ${txInfo}
          </div>`;
      }
      recordTextEl.value = '';
      updateWalletDisplay();
    } else {
      if (uploadResultEl) {
        uploadResultEl.innerHTML = `
          <div style="color:red; font-weight:bold;">
            ❌ ${result.error}
          </div>`;
      }
    }
  } catch (err) {
    console.error('add record error', err);
    if (uploadResultEl) {
      uploadResultEl.innerHTML = `
        <div style="color:red; font-weight:bold;">
          ❌ Network error: ${err.message}
        </div>`;
    }
  }
}

async function updateWalletDisplay() {
  try {
    const response = await fetch(`/api/wallet/${USER_ID}`);
    const wallet = await response.json();
    const balanceEl = document.getElementById('tokenBalance');
    const stakedEl = document.getElementById('stakedAmount');
    const claimBtn = document.getElementById('claimStakedBtn');

    if (balanceEl) {
      balanceEl.textContent = `${wallet.balance ?? 0} IMT`;
    }
    if (stakedEl) {
      stakedEl.textContent = `Currently Staked: ${wallet.staked ?? 0} IMT`;
    }
    if (claimBtn) {
      claimBtn.disabled = !(wallet.staked > 0);
    }
  } catch (err) {
    console.error('wallet fetch error', err);
    const balanceEl = document.getElementById('tokenBalance');
    const stakedEl = document.getElementById('stakedAmount');
    if (balanceEl) balanceEl.textContent = '0 IMT';
    if (stakedEl) stakedEl.textContent = 'Currently Staked: 0 IMT';
  }
}

async function stakeTokens() {
  const stakeAmountEl = document.getElementById('stakeAmount');
  if (!stakeAmountEl) return;

  const amount = parseInt(stakeAmountEl.value);
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
      stakeAmountEl.value = '';
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



function showSpinner(show = true) {
  const spinner = document.getElementById('chatSpinner');
  const sendBtn = document.getElementById('sendBtn');
  if (!spinner || !sendBtn) return;
  spinner.style.display = show ? 'inline-block' : 'none';
  sendBtn.disabled = show;
}

async function sendMessage() {
  const userInput = document.getElementById('userInput');
  if (!userInput) return;

  const message = userInput.value.trim();
  if (!message) return;

  
  addMessageToChat(message, 'user');
  userInput.value = '';

  showSpinner(true);

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
      showSpinner(false);
      return;
    }

    console.log('Chat API raw result:', result);

    
    let botText = '';

    if (
      result &&
      result.success === true &&
      typeof result.response === 'string' &&
      result.response.trim().length > 0
    ) {
      botText = result.response.trim();
    } else if (result && typeof result.error === 'string' && result.error.trim().length > 0) {
      botText = `AI error: ${result.error}`;
    } else if (result && result.success === false && result.error) {
      botText = `AI error: ${result.error}`;
    } else {
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
  } finally {
    showSpinner(false);
  }
}

function addMessageToChat(message, sender) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  // preserve newlines
  messageDiv.textContent = message;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


window.handleFileUpload = handleFileUpload;
window.addHealthRecord = addHealthRecord;
window.stakeTokens = stakeTokens;
window.claimStakedTokens = claimStakedTokens;
window.sendMessage = sendMessage;