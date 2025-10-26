document.addEventListener('DOMContentLoaded', () => {
    // We use a "null" config here to NOT use any STUN/TURN servers.
    // This forces WebRTC to rely on host (local/IPv6) candidates.
    const pcConfig = { iceServers: [] };
    
    let peerConnection;
    let dataChannel;

    // --- DOM Elements ---
    const createOfferBtn = document.getElementById('createOfferBtn');
    const createAnswerBtn = document.getElementById('createAnswerBtn');
    const startSessionBtn = document.getElementById('startSessionBtn');
    
    const offerSdpText = document.getElementById('offerSdp');
    const answerSdpText = document.getElementById('answerSdp');
    const offerSdpInText = document.getElementById('offerSdpIn');
    const answerSdpInText = document.getElementById('answerSdpIn');

    const chatBox = document.getElementById('chatBox');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    // --- Helper Function ---
    function addChatMessage(message, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);
        msgDiv.textContent = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function setupDataChannel(dc) {
        dc.onopen = () => {
            addChatMessage('Connection established! Chat is live.', 'system');
            messageInput.disabled = false;
            sendBtn.disabled = false;
        };
        
        dc.onmessage = (event) => {
            addChatMessage(event.data, 'received');
        };
        
        dc.onclose = () => {
            addChatMessage('Peer disconnected.', 'system');
            messageInput.disabled = true;
            sendBtn.disabled = true;
        };
    }

    // --- Peer 1 (Initiator) Workflow ---
    createOfferBtn.onclick = async () => {
        try {
            peerConnection = new RTCPeerConnection(pcConfig);
            
            // Set up the datachannel *before* creating the offer
            dataChannel = peerConnection.createDataChannel('chat');
            setupDataChannel(dataChannel);

            // This gathers ICE candidates (IP addresses)
            // In an IPv6 world, this will include the GUA
            peerConnection.onicecandidate = (event) => {
                if (event.candidate === null) {
                    offerSdpText.value = JSON.stringify(peerConnection.localDescription);
                }
            };
            
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            addChatMessage('Offer created. Copy it and send to Peer 2.', 'system');
        } catch (e) {
            console.error('Error creating offer:', e);
            addChatMessage(`Error: ${e}`, 'system');
        }
    };

    startSessionBtn.onclick = async () => {
        if (!answerSdpInText.value) {
            alert('Please paste the answer from Peer 2 first.');
            return;
        }
        
        try {
            const answer = JSON.parse(answerSdpInText.value);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            addChatMessage('Answer received. Attempting to connect...', 'system');
        } catch (e) {
            console.error('Error setting remote description:', e);
            addChatMessage(`Error: ${e}`, 'system');
        }
    };

    // --- Peer 2 (Receiver) Workflow ---
    createAnswerBtn.onclick = async () => {
        if (!offerSdpInText.value) {
            alert('Please paste the offer from Peer 1 first.');
            return;
        }

        try {
            peerConnection = new RTCPeerConnection(pcConfig);

            // Wait for the other peer to open a data channel
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                setupDataChannel(dataChannel);
            };

            // This gathers ICE candidates (IP addresses)
            peerConnection.onicecandidate = (event) => {
                if (event.candidate === null) {
                    answerSdpText.value = JSON.stringify(peerConnection.localDescription);
                }
            };

            const offer = JSON.parse(offerSdpInText.value);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            addChatMessage('Answer created. Copy it and send back to Peer 1.', 'system');
        } catch (e) {
            console.error('Error creating answer:', e);
            addChatMessage(`Error: ${e}`, 'system');
        }
    };

    // --- Chat Send Functionality ---
    function sendMessage() {
        const message = messageInput.value;
        if (message.trim() === '') return;
        
        try {
            dataChannel.send(message);
            addChatMessage(message, 'sent');
            messageInput.value = '';
        } catch (e) {
            console.error('Error sending message:', e);
            addChatMessage(`Error sending: ${e}`, 'system');
        }
    }

    sendBtn.onclick = sendMessage;
    messageInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    };
});