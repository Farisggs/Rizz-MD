// index.js - WhatsApp Bot MD Premium (Pairing Code Only)
const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys')
const chalk = require('chalk')
const moment = require('moment')
const fs = require('fs')
const axios = require('axios')
const { imageToSticker } = require('./lib/sticker')
const { Gempa, IGDownloader } = require('./lib/downloader')
const { ChatGPT } = require('./lib/ai')
const Database = require('./lib/database')

// Config
const config = {
    name: "🤖 Giska MD",
    prefix: "#",
    owner: "6285803412962@s.whatsapp.net",
    openai_key: "sk-xxx", // Dapatkan di platform.openai.com
    db_path: "./database.json"
}

// [1] FITUR DATABASE
const db = new Database(config.db_path)

// [2] PAIRING CODE VALIDATION
if (!process.argv[2]) {
    console.log(chalk.red(`Gunakan: node index.js <pairing-code>`))
    process.exit(1)
}

// Main Bot
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')

    const sock = makeWASocket({
        auth: state,
        mobile: false,
        printQRInTerminal: false,
        browser: ['MegaBot', 'Chrome', '3.0']
    })

    // [3] FITUR AUTO-SAVE SESSION
    sock.ev.on('creds.update', saveCreds)

    // [4] FITUR CONNECTION HANDLER
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            console.log(chalk.green('✅ Bot aktif via Pairing Code'))
            sock.sendMessage(config.owner, { 
                text: `*${config.name} Active!*\nMode: Pairing Code\nLast Login: ${moment().format('LLLL')}` 
            })
        }
    })

    // [5] FITUR MESSAGE HANDLER (LENGKAP)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return

        const text = getMessageText(m)
        const sender = m.key.remoteJid
        const pushName = m.pushName || 'User'
        const isOwner = sender === config.owner

        // [6] FITUR COMMAND HANDLER
        if (text.startsWith(config.prefix)) {
            const cmd = text.slice(config.prefix.length).trim().split(/ +/).shift().toLowerCase()
            const args = text.split(' ').slice(1)

            try {
                switch(cmd) {
                    // [7] FITUR AI CHATGPT
                    case 'ai':
                        if (!args[0]) return reply(m, "Tanya apa? Contoh: #ai jelaskan teori relativitas")
                        const aiResponse = await ChatGPT(args.join(' '), config.openai_key)
                        await reply(m, `🤖 AI Response:\n\n${aiResponse}`)
                        break

                    // [8] FITUR DOWNLOADER
                    case 'igdl':
                        if (!args[0]) return reply(m, "Masukkan URL Instagram! Contoh: #igdl https://www.instagram.com/p/xxx")
                        const igData = await IGDownloader(args[0])
                        await sock.sendMessage(sender, { 
                            video: { url: igData.url }, 
                            caption: `Downloaded from: ${args[0]}`
                        })
                        break

                    // [9] FITUR DATABASE
                    case 'simpan':
                        if (!isOwner) return reply(m, "Owner only!")
                        db.set(args[0], args.slice(1).join(' '))
                        await reply(m, `Data tersimpan dengan key: ${args[0]}`)
                        break

                    case 'ambil':
                        const data = db.get(args[0])
                        await reply(m, data || "Data tidak ditemukan")
                        break

                    // [10] FITUR ADMIN TOOLS
                    case 'bc': // Broadcast
                        if (!isOwner) return reply(m, "Owner only!")
                        const allChats = await sock.groupFetchAllParticipating()
                        for (const group in allChats) {
                            await sock.sendMessage(group, { text: args.join(' ') })
                            await delay(2000)
                        }
                        break

                    // [11] FITUR UTILITAS
                    case 'gempa':
                        const gempaInfo = await Gempa()
                        await reply(m, `⚠️ *Info Gempa Terkini*:\n${gempaInfo}`)
                        break

                    // [12] FITUR STICKER CREATOR
                    case 'sticker':
                        if (m.message.imageMessage) {
                            const stickerBuffer = await imageToSticker(m, sock)
                            await sock.sendMessage(sender, { sticker: stickerBuffer })
                        } else {
                            await reply(m, "Kirim gambar dengan caption #sticker")
                        }
                        break

                    // [13] FITUR GRUP MANAGEMENT
                    case 'kick':
                        if (!m.key.remoteJid.endsWith('@g.us')) return reply(m, "Hanya untuk grup!")
                        if (!isOwner) return reply(m, "Owner only!")
                        await sock.groupParticipantsUpdate(m.key.remoteJid, [args[0]], 'remove')
                        await reply(m, `User ${args[0]} telah dikick`)
                        break

                    default:
                        await reply(m, `Perintah tidak dikenal. Ketik #menu untuk bantuan`)
                }
            } catch (err) {
                console.error(chalk.red('[ERROR]', err))
                await reply(m, "Terjadi error saat memproses perintah")
            }
        }
    })

    // Helper functions
    async function reply(msg, text) {
        await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg })
    }

    function getMessageText(msg) {
        return msg.message.conversation || 
               msg.message.extendedTextMessage?.text || 
               msg.message.imageMessage?.caption || ''
    }
}

startBot().catch(console.error)

// ============ LIBRARY ============ 
// Simpan di folder ./lib/
// File: ./lib/ai.js
class ChatGPT {
    static async query(prompt, apiKey) {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [{role: "user", content: prompt}]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        return response.data.choices[0].message.content
    }
}

// File: ./lib/database.js
class Database {
    constructor(path) {
        this.path = path
        this.data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {}
    }

    set(key, value) {
        this.data[key] = value
        this.save()
    }

    get(key) {
        return this.data[key]
    }

    save() {
        fs.writeFileSync(this.path, JSON.stringify(this.data))
    }
}
