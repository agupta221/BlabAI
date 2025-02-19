const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();

// Enable CORS for our web app
app.use(cors());
app.use(express.json());

// Endpoint to handle text insertion into Cursor
app.post('/insert', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  // On macOS, use osascript to simulate keyboard shortcuts
  const isMac = process.platform === 'darwin';
  
  if (isMac) {
    // AppleScript to activate Cursor, open composer, and paste text
    const script = `
      osascript -e 'tell application "Cursor" to activate' -e '
        delay 0.5
        tell application "System Events"
          keystroke "l" using {command down, shift down}
          delay 0.5
          set the clipboard to "${text.replace(/"/g, '\\"')}"
          keystroke "v" using {command down}
        end tell'
    `;
    
    exec(script, (error, stdout, stderr) => {
      if (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Failed to send to Cursor' });
      }
      res.json({ success: true });
    });
  } else {
    // For Windows, use PowerShell
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("^+l")
      Start-Sleep -Milliseconds 500
      Set-Clipboard -Value "${text.replace(/"/g, '""')}"
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    `;

    exec(`powershell -command "${script}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Failed to send to Cursor' });
      }
      res.json({ success: true });
    });
  }
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 