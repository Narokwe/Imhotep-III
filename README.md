# Imhotep-III: Maternal & Child Health Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deployed on Render](https://img.shields.io/badge/Deployed-Render-blue)](https://imhotep-iii.onrender.com)

## 🩺 Problem Statement
Maternal and child health in Africa faces three critical challenges:
1. **Fragmented health records** leading to repeated tests and missed vaccinations
2. **Late health-seeking behavior** -Reactive healthcare approach rather than Proactive approach
3. **Limited financial access** to cater for healthcare costs

## 🚀 Solution
Imhotep-III combines Blockchain, AI, and DeFi to create a comprehensive health platform:
- **AI Health Assistant**: Gemini-powered virtual health advisor
- **Digital Health Wallet**: Secure, blockchain-based health records
- **Token Incentives**: Reward system for preventive healthcare actions
- **DeFi Health Pools**: Savings mechanism for healthcare expenses

## 🛠 Technologies Used
- **Google Genkit & Gemini 2.5 Flash** - AI assistant and RAG system
- **Vertex AI** - Machine learning capabilities
- **Node.js & Express** - Backend server
- **Modern Web Technologies** - Frontend interface
- **Blockchain Principles** - Data integrity and token economy

## 🎯 Primary Use Case
**Customer Service/Virtual Assistant** - Providing AI-powered health guidance and support for mothers and families.

## 📥 Installation & Local Development

### Prerequisites
- Node.js 16+ 
- Google AI API Key (Gemini)
- Modern web browser

### Quick Start
1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/imhotep-iii.git
   cd imhotep-iii


Install dependencies


npm install



Set up environment variables


Create .env file:



GEMINI_API_KEY=your_google_ai_api_key_here
PORT=3000



Start the development server


npm run dev


Access the application


Open http://localhost:3000 in your browser


🎮 How to Test the Application


Option 1: Use Live Deployment


Visit: Live Deployment Link - https://imhotep-iii.onrender.com/ 



Option 2: Local Testing
Follow the installation steps above

Step-by-Step Testing Guide:
1. Upload Health Records & Earn Tokens
Method A: Upload Text File

Create a new file called health-record.txt with this content:

Child Name: Baby Janet
Mother: Mary A.
Date of Birth: 25 March 2023
Place of Birth: Pumwani Maternity Hospital, Nairobi, Kenya
Mode of Delivery: Normal vaginal delivery
Birth Weight: 3.1 kg

Immunization History:
- At birth:
  - BCG: Given
  - OPV 0: Given
  - Hepatitis B birth dose: Not available at facility

- 6 weeks:
  - OPV 1: Given
  - Pentavalent 1 (DPT-HepB-Hib): Given
  - PCV 1: Given
  - Rotavirus 1: Given

- 10 weeks:
  - OPV 2: Given
  - Pentavalent 2: Given
  - PCV 2: Given
  - Rotavirus 2: Given

- 14 weeks:
  - OPV 3: Missed (caregiver could not afford transport)
  - Pentavalent 3: Given
  - PCV 3: Given
  - Rotavirus 3: Not available in facility

- 9 months:
  - Measles/Rubella 1: Given

- 18 months:
  - Measles/Rubella 2: Not yet received
  - Vitamin A: Given at 6, 12, and 18 months

Growth Monitoring:
- 6 months: 7.0 kg
- 9 months: 8.1 kg
- 12 months: 8.7 kg
- 18 months: 9.2 kg
- 20 months (current): 9.4 kg

Feeding History:
- Exclusive breastfeeding for 5 months, then mixed feeding started.
- Complementary foods started at 5 months: uji, mashed potatoes, bananas, vegetables.
- Currently: Eats 3 main meals and 2 snacks, drinks cow’s milk, family diet.
- Sometimes refuses food when sick.

Recent Illness:
- Two episodes of diarrhoea in the last 3 months, treated at local clinic.
- No hospital admission.

Development:
- Walks without support
- Says a few words (mama, baba, bye)
- Can feed herself with help
- Plays with other children

Plan:
- Return to clinic to check if OPV 3 can still be given or if alternative schedule is advised.
- Measles/Rubella 2 still pending – advise mother to take child to immunization clinic.
- Continue Vitamin A as per national schedule.
- Counselling on nutrition, handwashing, and use of safe drinking water.
Click "Choose File" and select your health-record.txt file

Expected Result: You should earn 6 IMT tokens for uploading health records containing ANC, immunization, and growth data

Method B: Paste Text Directly

Copy the health record text above

Paste it into the textarea under "Paste your medical records here as text"

Click "Add Health Record as Text"

Expected Result: Earn 6 IMT tokens

2. Chat with AI Assistant
In the AI Assistant section, type this exact question:

Hi Imhotep-III, How are you today? Now, based on the available health records, can you give me a personalized health insights for proactive healthcare
Expected Result: The AI will analyze the uploaded health records and provide personalized insights including:

Immunization status and recommendations

Growth and development analysis

Nutritional advice

Proactive health recommendations

3. Test Token System
Check Wallet Balance: Verify you have earned tokens from uploading records

Stake Tokens: Enter an amount (e.g., 5) in the staking field and click "Stake Tokens"

View Staked Amount: Check the "Currently Staked" display updates

Simulate Interest: Wait a moment and check if staking information updates

Sample Test Scenarios:
Scenario 1: Pregnancy Consultation
Ask: "I'm 6 months pregnant and experiencing back pain, is this normal?"

Expected: AI provides pregnancy-related advice and when to seek medical care

Scenario 2: Child Health Follow-up
Ask: "What vaccinations is Baby Janet missing based on her records?"

Expected: AI identifies OPV 3 and Measles/Rubella 2 as pending

Scenario 3: Financial Features
Stake: 100 IMT tokens

Check: Wallet balance decreases, staked amount increases

Note: Tokens are locked for 6 months in simulation

📁 Project Structure
text
imhotep-iii/
├── public/
│   ├── index.html          # Main application interface
│   ├── main.css           # Styling and responsive design
│   └── app.js            # Frontend functionality
├── server/
│   ├── index.js          # Express server and API routes
│   ├── genkit-setup.js   # Google AI configuration
│   ├── rag-system.js     # Retrieval-Augmented Generation
│   ├── token-system.js   # Token economy logic
│   └── vector-store.json # Health data storage
├── package.json          # Dependencies and scripts
├── LICENSE              # MIT License
├── .gitignore          # Git ignore rules
└── README.md           # This file

🔧 API Endpoints
POST /api/upload-record - Upload health records (+ token rewards)

POST /api/chat - AI health assistant

POST /api/stake - Token staking

GET /api/wallet/:userId - Wallet balance

GET /api/test-ai - AI connectivity test

🌟 Key Features Demonstrated

✅ Google Genkit & Gemini AI integration

✅ RAG (Retrieval-Augmented Generation) system

✅ Token-based incentive mechanism

✅ Health record processing and analysis

✅ Responsive web interface

✅ Real-time AI consultations

✅ Automated token rewards for health actions

📊 Expected Impact
30% reduction in missed antenatal care visits

25% increase in child immunization rates

Financial empowerment for 50,000+ families

Improved health outcomes across African communities

We welcome contributions!! 

📄 License

This project is licensed under the MIT License - see the LICENSE file for details.