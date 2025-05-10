const { default: makeWASocket, useSingleFileAuthState } = require("@adiwajshing/baileys");
const express = require("express");
const axios = require("axios");
const { Boom } = require("@hapi/boom");
const app = express();
const port = process.env.PORT || 3000;

const { state, saveState } = useSingleFileAuthState("./session/auth_info.json");

async function startSocket() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on("creds.update", saveState);

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages || !m.messages[0].message) return;
        const msg = m.messages[0];
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        try {
            const res = await axios.post("https://james-chatbot-2.onrender.com/ask", {
                question: text
            });

            const reply = res.data.answer || "Sorry, I'm not sure how to respond to that.";
            await sock.sendMessage(from, { text: reply });
        } catch (err) {
            console.error("Error:", err.message);
            await sock.sendMessage(from, { text: "There was an error processing your message." });
        }
    });
}

startSocket();
app.get("/", (req, res) => res.send("James WhatsApp Bot is running."));
app.listen(port, () => console.log(`Server running on port ${port}`));