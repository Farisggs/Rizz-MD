                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       // index.js - WhatsApp Bot MD with Pairing Code
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const chalk = require('chalk')
const moment = require('moment')
const fs = require('fs')
const axios = require('axios')

// Configuration
const config = {
    name: "🤖 MyBot-MD",
    prefix: "!",
    owner: "62812xxxxxx@s.whatsapp.net", // Ganti dengan nomor Anda
    pairingCode: process.argv[2] || null // Ambil pairing code dari argument
}

// Main Function
async function startBot() {
    console.log(chalk.yellow(`[ ${moment().format('HH:mm:ss')} ] Starting bot...`))
    
    // Load session
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')

    // Create connection
    const sock = makeWASocket({
        printQRInTerminal: !config.pairingCode, // Nonaktifkan QR jika pakai pairing
        auth: state,
        mobile: false, // Required for pairing
        browser: ['BOT-MD', 'Chrome', '3.0'],
        generateHighQualityLink: true
    })

    // Connection update handler
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, isNewLogin, pairingCode } = update
        
        // QR Code Handler
        if (qr && !config.pairingCode) {
            console.log(chalk.green('\nScan QR ini dengan WhatsApp:'))
            qrcode.generate(qr, { small: true })
        }

        // Pairing Code Handler
        if (pairingCode && !config.pairingCode) {
            console.log(chalk.blue('\nPairing Code:'), chalk.yellow(pairingCode))
            fs.writeFileSync('pairing_code.txt', pairingCode)
        }

        // Connection status
        if (connection === 'open') {
            console.log(chalk.green('\nBot berhasil terhubung!'))
            notifyOwner(sock, `*${config.name} aktif!* 🚀\nJam: ${moment().format('LLLL')}`)
            
            // Cleanup pairing file
            if (fs.existsSync('pairing_code.txt')) {
                fs.unlinkSync('pairing_code.txt')
            }
        }

        // Auto reconnect
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log(chalk.red('\nConnection lost, reconnecting...'))
            if (shouldReconnect) setTimeout(startBot, 5000)
        }
    })

    // Save session
    sock.ev.on('creds.update', saveCreds)

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        
        const text = getMessageText(m)
        const sender = m.key.remoteJid
        const pushName = m.pushName || 'User'
        
        // Command handler
        if (text.startsWith(config.prefix)) {
            const cmd = text.slice(config.prefix.length).trim().split(/ +/).shift().toLowerCase()
            const args = text.split(' ').slice(1)
            
            console.log(chalk.cyan(`[CMD] ${pushName}: ${cmd}`))
            
            try {
                switch(cmd) {
                    case 'ping':
                        await reply(sock, m, `🏓 Pong! | ${Date.now() - m.messageTimestamp * 1000}ms`)
                        break
                        
                    case 'help':
                        const helpMsg = `*${config.name} Commands*\n\n`
                            + `${config.prefix}ping - Test bot\n`
                            + `${config.prefix}help - Show menu\n`
                            + `${config.prefix}owner - Bot owner\n`
                            + `${config.prefix}time - Current time\n`
                            + `${config.prefix}quote - Random quote\n`
                            + `${config.prefix}sticker - Create sticker`
                        await reply(sock, m, helpMsg)
                        break
                        
                    case 'time':
                        await reply(sock, m, `⏰ ${moment().format('dddd, DD MMMM YYYY HH:mm:ss')}`)
                        break
                        
                    case 'owner':
                        await reply(sock, m, `👑 Owner: wa.me/${config.owner.split('@')[0]}`)
                        break
                        
                    case 'quote':
                        const quote = await getQuote()
                        await reply(sock, m, `💬 "${quote.content}"\n- ${quote.author}`)
                        break
                        
                    case 'sticker':
                        if (m.message.imageMessage) {
                            await createSticker(sock, m)
                        } else {
                            await reply(sock, m, 'Kirim gambar dengan caption !sticker')
                        }
                        break
                        
                    default:
                        await reply(sock, m, `Invalid command! Ketik ${config.prefix}help untuk menu`)
                }
            } catch (err) {
                console.error(chalk.red('[ERROR]', err))
                await reply(sock, m, '⚠️ Error processing command')
            }
        }
    })
}

// Helper Functions
function getMessageText(msg) {
    return msg.message.conversation || 
           msg.message.extendedTextMessage?.text || 
           msg.message.imageMessage?.caption || ''
}

async function reply(sock, msg, text) {
    await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg })
}

async function notifyOwner(sock, text) {
    if (config.owner) await sock.sendMessage(config.owner, { text })
}

async function getQuote() {
    try {
        const res = await axios.get('https://api.quotable.io/random')
        return { content: res.data.content, author: res.data.author }
    } catch {
        return { 
            content: "The best way to predict the future is to create it.",
            author: "Abraham Lincoln" 
        }
    }
}

async function createSticker(sock, msg) {
    try {
        const media = await sock.downloadMediaMessage(msg)
        await sock.sendMessage(msg.key.remoteJid, {
            sticker: Buffer.from(media, 'base64')
        }, { quoted: msg })
    } catch (err) {
        console.error(chalk.red('[STICKER ERROR]', err))
        await reply(sock, msg, 'Failed to create sticker')
    }
}

// Start bot with pairing code if provided
startBot().catch(err => console.log(chalk.red('[START ERROR]', err)))                                                   
