// api/edge-tts.js — Microsoft Edge TTS (مجاني، أصوات عربية طبيعية)
import WebSocket from 'ws';
import crypto from 'crypto';

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const { text, voice = 'ar-SA-HamedNeural', rate = '0%', pitch = '0Hz' } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });
  
  const clean = text.substring(0, 500);
  const connectionId = crypto.randomUUID().replace(/-/g, '');
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}&ConnectionId=${connectionId}`;
  
  const audioChunks = [];
  let responded = false;
  
  const finish = (error) => {
    if (responded) return;
    responded = true;
    if (error) {
      console.error('Edge TTS error:', error);
      return res.status(500).json({ error: String(error) });
    }
    const audioBuffer = Buffer.concat(audioChunks);
    if (audioBuffer.length === 0) return res.status(500).json({ error: 'No audio' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(audioBuffer);
  };
  
  try {
    const ws = new WebSocket(url, {
      headers: {
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      finish('Timeout');
    }, 15000);
    
    ws.on('open', () => {
      const config = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws.send(config);
      
      const escapedText = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-SA'><voice name='${voice}'><prosody rate='${rate}' pitch='${pitch}'>${escapedText}</prosody></voice></speak>`;
      const msg = `X-RequestId:${connectionId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(msg);
    });
    
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const headerLength = data.readUInt16BE(0);
        const audioData = data.slice(2 + headerLength);
        if (audioData.length > 0) audioChunks.push(audioData);
      } else {
        const message = data.toString();
        if (message.includes('Path:turn.end')) {
          clearTimeout(timeout);
          ws.close();
        }
      }
    });
    
    ws.on('close', () => { clearTimeout(timeout); finish(null); });
    ws.on('error', (err) => { clearTimeout(timeout); finish(err.message); });
  } catch (err) {
    finish(err.message);
  }
}