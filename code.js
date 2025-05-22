// script.js
const talkButton = document.getElementById('talk-button');
const chatBox = document.getElementById('chat-box');
const statusMessage = document.getElementById('status-message');

// --- Configuration ---
// IMPORTANT: Replace with your actual API key OR use a proxy server (recommended for production)
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; 
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// --- Speech Recognition Setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Process single utterances
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
} else {
    alert("Sorry, your browser does not support the Web Speech API. Try using Chrome or Edge.");
    talkButton.disabled = true;
    talkButton.textContent = "Speech API Not Supported";
}

// --- Speech Synthesis Setup ---
const synth = window.speechSynthesis;
if (!synth) {
    alert("Sorry, your browser does not support the Speech Synthesis API.");
}

// --- Chat History ---
let chatHistory = [
    {
        role: "system",
        content: "You are an AI English tutor. Your goal is to help the user practice their English conversation skills. Keep your responses concise, friendly, and engaging. Ask follow-up questions to encourage the user to speak more. Limit your responses to 1-2 sentences."
    }
];

// --- Helper Functions ---
function appendMessage(sender, messageContent) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    
    // Sanitize message content before inserting as HTML
    const textNode = document.createTextNode(messageContent);
    messageDiv.appendChild(textNode);
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom
}

function speak(text) {
    if (!synth || !text) return;
    // Wait for any previous utterance to finish
    if (synth.speaking) {
        console.warn("Speech synthesis is already active. Cancelling previous utterance.");
        synth.cancel(); // Cancel previous speech before starting new one
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        updateStatus("Error speaking response.");
        setButtonState("Start Talking", false);
    };
    utterance.onend = () => {
        setButtonState("Start Talking", false); // Re-enable button after speech
    };
    synth.speak(utterance);
}

function setButtonState(text, disabled, processing = false) {
    talkButton.textContent = text;
    talkButton.disabled = disabled;
    if (processing) {
        talkButton.classList.add('processing'); // Optional: for styling
    } else {
        talkButton.classList.remove('processing');
    }
}

function updateStatus(message) {
    statusMessage.textContent = message;
}

// --- Core Functions ---
async function getAIResponse() {
    if (OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
        const warningMsg = "OpenAI API key not configured. Please set it in script.js.";
        appendMessage('assistant', warningMsg);
        updateStatus(warningMsg);
        speak(warningMsg); // Speak the warning
        setButtonState("Start Talking", false);
        return;
    }

    setButtonState("Processing...", true, true);
    updateStatus("AI is thinking...");

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: chatHistory,
                max_tokens: 100 // Limit response length
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(`API Error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const assistantReply = data.choices[0]?.message?.content?.trim();

        if (assistantReply) {
            appendMessage('assistant', assistantReply);
            chatHistory.push({ role: "assistant", content: assistantReply });
            speak(assistantReply);
            updateStatus("AI responded. Click 'Start Talking' for your next turn.");
            // Button state will be reset by speak() onend or onerror
        } else {
            throw new Error("No response content from AI.");
        }

    } catch (error) {
        console.error("Error fetching AI response:", error);
        const errorMsg = `Error: ${error.message}. Please try again.`;
        appendMessage('assistant', errorMsg);
        speak(errorMsg);
        updateStatus(errorMsg);
        setButtonState("Start Talking", false);
    }
}

// --- Event Listeners ---
if (recognition) {
    talkButton.addEventListener('click', () => {
        if (synth.speaking) {
            synth.cancel(); // Stop AI speaking if user interrupts
        }
        try {
            recognition.start();
            setButtonState("Listening...", true);
            updateStatus("Listening... Please speak clearly.");
        } catch (error) {
            // Handle cases where recognition might already be active or other errors
            console.error("Error starting speech recognition:", error);
            setButtonState("Start Talking", false);
            updateStatus("Could not start listening. Please try again.");
        }
    });

    recognition.onstart = () => {
        // Already handled by button click UI update
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
            appendMessage('user', transcript);
            chatHistory.push({ role: "user", content: transcript });
            updateStatus(`You said: "${transcript}". Sending to AI...`);
            getAIResponse();
        } else {
            updateStatus("Could not understand. Try speaking again.");
            setButtonState("Start Talking", false);
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        let errorMessage = "Speech recognition error. ";
        if (event.error === 'no-speech') {
            errorMessage += "No speech detected. Please try again.";
        } else if (event.error === 'audio-capture') {
            errorMessage += "Audio capture failed. Check microphone permissions.";
        } else if (event.error === 'not-allowed') {
            errorMessage += "Microphone access denied. Please allow microphone access.";
        } else {
            errorMessage += "Please try again.";
        }
        updateStatus(errorMessage);
        setButtonState("Start Talking", false);
    };

    recognition.onend = () => {
        // Re-enable button if not already handled by AI response flow or error
        if (talkButton.textContent === "Listening...") {
            setButtonState("Start Talking", false);
            updateStatus("Click 'Start Talking' to speak.");
        }
    };
}

// --- Initial Setup ---
function initializeApp() {
    const initialSystemMessage = chatHistory.find(msg => msg.role === "system");
    if (initialSystemMessage) {
        const systemMessageDiv = document.createElement('div');
        systemMessageDiv.classList.add('message', 'system-message');
        systemMessageDiv.textContent = "System: " + initialSystemMessage.content; // Simple display
        // chatBox.appendChild(systemMessageDiv); // Optionally display system message
    }
    updateStatus("Click 'Start Talking' to begin your conversation.");
}

initializeApp();