# Cursor Helper

A local server that helps send text from your web application to the Cursor IDE.

## Setup

1. Make sure you have Node.js installed on your system
2. Navigate to this directory in your terminal
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Server

Start the helper server:
```bash
npm start
```

The server will run on port 3001 and handle requests to send text to Cursor.

## How it Works

The helper server:
1. Listens for POST requests on http://localhost:3001/insert
2. When it receives text, it:
   - Activates the Cursor application
   - Simulates the keyboard shortcut to open Cursor's composer (Cmd+Shift+L on Mac, Ctrl+Shift+L on Windows)
   - Sets the clipboard to the received text
   - Simulates pasting the text (Cmd+V on Mac, Ctrl+V on Windows)

## Requirements

- Mac OS X or Windows
- Node.js 16 or higher
- Cursor IDE installed
- Required permissions for:
  - Mac: AppleScript automation
  - Windows: PowerShell execution 