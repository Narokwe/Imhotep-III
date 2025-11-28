[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deployed on Google Cloud Run](https://img.shields.io/badge/Deployed-GCP%20Cloud%20Run-blue)](https://imhotep-iii-684748583012.us-central1.run.app)

# Imhotep-III: AI, Blockchain & DeFi for Maternal and Child Health

Imhotep-III is an AI-powered web application that helps mothers and caregivers in Africa understand, track, and protect maternal and child health records. It combines **Genkit + Gemini 2.5 Flash + RAG**, **Firestore**, and **XRPL anchoring**, with a future vision of **DeFi/IMT token incentives** for healthier families.

> ⚠️ **Important:** This is a prototype built for the Unstacked Labs BwAI capstone. It is **not** a medical device. All AI outputs are for informational purposes only and must not replace professional medical advice.

---

## 🌍 Problem It Tackles

Imhotep-III focuses on three key challenges in maternal and child healthcare across Africa:

1. **Scattered health records**  
   - Paper-based cards and clinic books are easily lost or damaged.  
   - Imhotep-III stores records digitally in Firestore and anchors hashes to the XRPL testnet for tamper-evident integrity.

2. **Reactive rather than proactive care**  
   - Families often seek help only when problems are severe.  
   - The AI health assistant (Genkit + Gemini 2.5 Flash + RAG) generates contextual insights, risks, and recommendations to support proactive decisions.

3. **Affordability and financial barriers**  
   - Poverty and high healthcare costs limit access to good nutrition and services.  
   - Imhotep-III’s roadmap includes an **IMT token** to reward positive health behaviours and help mothers pay for food and healthcare (future phase).

---

## ✨ Key Features

- **Upload & store maternal/child health records**  
  - Visit notes, pregnancy information, test results, immunisation history.

- **AI health assistant (Genkit + Gemini 2.5 Flash + RAG)**  
  - Ask: _"What are the key issues in my pregnancy records?"_  
  - Receives understandable summaries, risks, and suggestions for follow-up discussions with a health worker.

- **Blockchain anchoring (XRPL testnet)**  
  - Cryptographic hashes of records are anchored on XRPL.  
  - No raw health data on-chain — only anchors for integrity and transparency.

- **Pseudonymous identity**  
  - Users are identified by a random `USER_ID` stored in `localStorage`.  
  - No real names or IDs required in this prototype.

- **Future DeFi incentives**  
  - IMT token (future) to reward positive health practices and support affordability of nutrition and healthcare.

---

## 🏗️ Architecture Overview

- **Frontend**
  - Vanilla JavaScript web app (`public/app.js`).
  - Handles:
    - Session and `USER_ID` creation.  
    - Record upload/paste.  
    - Wallet/anchor display.  
    - Chat UI for AI assistant.

- **Backend**
  - Node.js / Express API.  
  - Deployed on **Google Cloud Run**.

- **Core Integrations**
  - **Firestore** (via Firebase Admin SDK) for storing:
    - Health records  
    - AI interaction history  
  - **Genkit + Gemini 2.5 Flash + RAG** for:
    - Retrieving relevant records from Firestore  
    - Summarising health data  
    - Answering user questions with context  
  - **XRPL JavaScript SDK** for:
    - Connecting to XRPL testnet  
    - Anchoring cryptographic hashes of records as transactions

---

## 🔧 Technologies Used

- **Google Cloud**
  - Cloud Run  
  - Firestore (Firebase)

- **AI**
  - Genkit  
  - Gemini 2.5 Flash  
  - Retrieval-Augmented Generation (RAG) over Firestore data

- **Blockchain**
  - XRPL Testnet

- **Backend & Frontend**
  - Node.js, Express  
  - HTML, CSS, JavaScript

---


## 📁 Project Assets (for Capstone Submission)
The following files are included in this repository:

📄 **Project Proposal (PDF)**: `https://drive.google.com/file/d/1SP2AuoG_VRxf58PSgjXvXC3RhjsqdFxV/view?usp=sharing`

📊 **Project Slides (PDF)**: `https://drive.google.com/file/d/1V_iHz8BXtEH0bJDtyuQ4SHRvxlpfvoK1/view?usp=sharing`

🎥 **Demo Video (< 3 min)**: [Download from Google Drive] (https://drive.google.com/drive/folders/1YVMY5L8iFUGMaoI1piKGZ10wCdEqxMwZ?usp=sharing)

🧩 **BwAI Codelabs Screenshot**: `https://drive.google.com/file/d/1rc0SWPL3P9TA-jowYA5GGqSwAzlQIRkm/view?usp=sharing`




## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js (LTS)  
- Yarn or npm  
- A Google Cloud project with Firestore enabled  
- XRPL testnet account/credentials (or faucet)  
- Genkit + Gemini 2.5 Flash configured (API key / credentials)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/imhotep-iii.git
cd imhotep-iii


2. Install Dependencies


npm install
# or
yarn install



3. Configure Environment Variables
Create a .env file in the project root (adjust variable names to match your actual code):



XRPL_WSS_URL=wss://testnet.xrpl-labs.com
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
GENKIT_API_KEY=your-genkit-or-gemini-key-here
PORT=8080
service-account.json should have access to Firestore.

Ensure your Genkit/Gemini configuration is properly set up in code.

4. Run Locally


npm run dev
# or
npm start
Visit http://localhost:3000 in your browser.

☁️ Deployment to Google Cloud Run

gcloud config set project YOUR_GCP_PROJECT_ID
gcloud config set run/region us-central1

gcloud run deploy imhotep-iii \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --allow-unauthenticated \
  --set-env-vars XRPL_WSS_URL=wss://testnet.xrpl-labs.com,GOOGLE_CLOUD_PROJECT=YOUR_GCP_PROJECT_ID
After deployment, update the badge at the top of this README with the new Cloud Run URL.

📁 Project Assets (for Capstone Submission)
The following files are included in this repository:

📄 Project Proposal (PDF): docs/imhotep-iii-project-proposal.pdf

📊 Project Slides (PDF): docs/imhotep-iii-project-slides.pdf

🎥 Demo Video (< 3 min): demo/imhotep-iii-demo.mp4

🧩 BwAI Codelabs Screenshot: assets/codelabs-screenshot.png





🧪 Example Usage Flow
Open the deployed app.

A new USER_ID is generated (stored locally).

Upload or paste maternal/child health record text.

Submit to save → record stored in Firestore and anchored on XRPL testnet.

Ask the AI assistant: “Give me some insights about my health records.”

Receive a contextual response based on your stored records (RAG).


⚠️ Disclaimer
This prototype does not provide medical diagnosis or treatment.

All AI outputs are informational and must be confirmed with a qualified healthcare professional.

Do not use this system for real patient care without regulatory approvals, clinical validation, and security hardening.



📚 License
This project is licensed under the MIT License.