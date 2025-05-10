const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

const { state, saveState } = useSingleFileAuthState('./session/auth_info.json');

async function startSock() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: { level: 'debug' }
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('✅ QR Code generated — scan now:');
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed. Reconnecting...', lastDisconnect.error);
            if (shouldReconnect) {
                startSock();
            }
        } else if (connection === 'open') {
            console.log('✅ Connected successfully to WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const from = msg.key.remoteJid;

        try {
            const res = await axios.post("https://james-chatbot-2.onrender.com/ask", {
                question: text
            });

            const answer = res.data.answer || "Sorry, I'm not sure how to respond to that.";
            await sock.sendMessage(from, { text: answer });
        } catch (error) {
            console.error("Reply error:", error);
            await sock.sendMessage(from, { text: "There was an error processing your message." });
        }
    });
}

startSock();
app.get("/", (req, res) => res.send("James WhatsApp bot running."));
app.listen(port, () => console.log(`Bot server listening on port ${port}`));