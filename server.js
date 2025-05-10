const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore, DisconnectReason } = require("@adiwajshing/baileys");
const pino = require("pino");
const qrcode = require("qrcode");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 10000;

let qrCode = "";

const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        version,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCode = await qrcode.toDataURL(qr);
            console.log("✅ QR code generated.");
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Connection closed. Reconnecting:", shouldReconnect);
            if (shouldReconnect) {
                startSock();
            }
        } else if (connection === "open") {
            console.log("✅ Connected to WhatsApp.");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        const incomingText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        let reply = "Hi! I’m James, your AI assistant from Smarto.Space. How can I help you today?";
        if (incomingText.toLowerCase().includes("how are you")) {
            reply = "I'm great, thanks for asking! How are you?";
        } else if (incomingText.toLowerCase().includes("what is smarter.space")) {
            reply = "Smarto.Space is your go-to platform for powerful AI solutions, including 24/7 customer service bots and lead generation.";
        } else if (incomingText.toLowerCase().includes("help me") || incomingText.toLowerCase().includes("how can james help")) {
            reply = "James can assist with customer service, answer questions, and collect leads such as name, email, and phone number in real time.";
        } else if (incomingText.toLowerCase().includes("available")) {
            reply = "Yes, Smarto.Space is available 24/7 to support your business needs.";
        }

        await sock.sendMessage(sender, { text: reply });
    });
};

// Express route to show QR code on the browser
app.get("/qr", (req, res) => {
    if (!qrCode) {
        return res.send("<h2>QR Code not ready yet. Please refresh in a few seconds.</h2>");
    }
    res.setHeader("Content-Type", "text/html");
    res.send(`<html><body><h1>Scan this QR Code</h1><img src="${qrCode}" /></body></html>`);
});

app.listen(port, () => {
    console.log("Bot server listening on port " + port);
});

startSock();