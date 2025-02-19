const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { platform } = require('os');

const app = express();
const PORT = 3001;

// Enable CORS for our web app
app.use(cors());
app.use(express.json());

// Helper function to execute shell commands
const executeCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error}`);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
};

// Helper function to properly escape text for shell scripts
const escapeText = (text, isWindows = false) => {
  if (isWindows) {
    // Escape for PowerShell
    return text.replace(/[`"$]/g, '`$&').replace(/'/g, "''");
  } else {
    // Escape for AppleScript
    return text.replace(/[\\"]/g, '\\$&').replace(/'/g, "'\\''");
  }
};

// Helper function to chunk text into smaller pieces
const chunkText = (text, maxLength = 1000) => {
  const chunks = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

// Handle text insertion
app.post('/insert', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const chunks = chunkText(text);
    const isWindows = platform() === 'win32';
    
    // First, activate Cursor and open composer
    if (isWindows) {
      const activateScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("^+i")
        Start-Sleep -Milliseconds 500
      `;
      await executeCommand(`powershell -Command "${activateScript}"`);
    } else {
      const activateScript = `
        tell application "Cursor"
          activate
          delay 0.5
          tell application "System Events"
            keystroke "i" using {command down, shift down}
            delay 0.5
          end tell
        end tell
      `;
      await executeCommand(`osascript -e '${activateScript}'`);
    }

    // Then insert each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const escapedChunk = escapeText(chunk, isWindows);

      if (isWindows) {
        const script = `
          Set-Clipboard -Value '${escapedChunk}'
          Start-Sleep -Milliseconds 100
          [System.Windows.Forms.SendKeys]::SendWait("^v")
          Start-Sleep -Milliseconds 100
          ${i < chunks.length - 1 ? '[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")' : ''}
        `;
        await executeCommand(`powershell -Command "${script}"`);
      } else {
        const script = `
          tell application "System Events"
            set the clipboard to "${escapedChunk}"
            delay 0.1
            keystroke "v" using {command down}
            delay 0.1
            ${i < chunks.length - 1 ? 'keystroke return' : ''}
          end tell
        `;
        await executeCommand(`osascript -e '${script}'`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling insert:', error);
    res.status(500).json({ error: 'Failed to insert text into Cursor' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Cursor Helper server running on port ${PORT}`);
}); 