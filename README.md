# Chlorine API

This Node.js application downloads Minecraft icons (assets) from the [mcicons.ccleaf.com](https://mcicons.ccleaf.com) API. It fetches a list of all available icons, saves metadata to a JSON file, and concurrently downloads the images to an organized directory structure.

## Overview

The script automates the retrieval and download of Minecraft-related icons, such as textures and assets, using an authenticated API. It handles token-based authentication, retries failed requests, and supports concurrent downloads to speed up the process. The output includes a metadata file (`data/assets.json`) and the actual image files in an `assets/` directory.

This tool is useful for developers, modders, or anyone needing a local copy of Minecraft icons for projects, documentation, or analysis.

## Features

- **Authenticated API Access**: Uses API key and bearer token for secure requests.
- **Concurrent Downloads**: Supports multiple simultaneous downloads (configurable, default 12) for efficiency.
- **Retry Logic**: Automatically retries failed requests up to 4 times, including token refresh on authentication errors.
- **Progress Logging**: Real-time console logs showing download progress, errors, and timing.
- **Metadata Export**: Saves a JSON file with asset details (name, category, subcategory, URL).
- **Resume Capability**: Skips already-existing files to avoid re-downloading.
- **Organized Output**: Images are saved in a category/subcategory hierarchy.

## Requirements

- Node.js (version 14+ recommended, due to ES modules and async/await usage).
- npm or yarn (for installing dependencies).
- Internet connection and a valid API key from mcicons.ccleaf.com.

## Installation

1. Clone or download the project to a directory (e.g., `mcicons/thumbnails`).
2. Open a terminal in the project root.
3. Install dependencies:

   ```bash
   npm install axios
   ```

   The script uses `axios` for HTTP requests, `fs` and `path` (Node.js built-ins).

## Configuration

Edit `client.js` to customize settings:

- **API Key**: Replace the placeholder `API_KEY` with your actual key from mcicons.ccleaf.com:

  ```javascript
  const API_KEY = "your-actual-api-key-here";
  ```

  Obtain your API key by signing up or accessing the mcicons.ccleaf.com dashboard. Keep it secure and do not commit it to version control.

- **Concurrency**: Adjust `CONCURRENCY` (default: 12) to control the number of parallel downloads. Higher values speed up downloads but may strain the API or your network.

  ```javascript
  const CONCURRENCY = 12; // Number of concurrent workers
  ```

- **Retries and Timeout**: `MAX_RETRIES = 4` and `TIMEOUT_MS = 25000` (25 seconds). Increase if dealing with unstable connections.

  ```javascript
  const MAX_RETRIES = 4;
  const TIMEOUT_MS = 25000;
  ```

## Usage

Run the script directly with Node.js:

```bash
node client.js
```

- The script will:
  1. Fetch an authentication token.
  2. Retrieve the list of all assets.
  3. Download images concurrently.
- Monitor the console for progress logs (e.g., "[ℹ️] [HH:MM:SS] downloading URL", progress updates).
- The process runs until completion or an unrecoverable error.

To run in a specific directory, navigate there first and execute the command.

## How It Works

### 1. Token Fetching
- The script requests a short-lived bearer token from `${BASE}/api/token` using your API key in the headers.
- Tokens expire after 15 minutes; the script automatically refreshes them if needed (with a 1-minute buffer).
- On 401/403 errors, it forces a token refresh and retries.

### 2. Asset Listing
- Uses the token to GET `${BASE}/api/assets/all`.
- Parses the response to extract file details: `name`, `category`, `subcategory` (optional), and constructs the full image URL.
- Saves the list as `data/assets.json` (array of objects with the above fields).

### 3. Concurrent Downloading
- Creates a shared queue of files from the asset list.
- Spawns `CONCURRENCY` worker functions, each processing queue items in a loop.
- For each file:
  - Builds the output path: `assets/<category>/<subcategory>/<name>` (or without subcategory if absent).
  - Streams the image from the URL using the current token.
  - Skips if the file already exists.
  - Logs timing and status (ok, exists, failed).
- Workers handle retries: exponential backoff for general errors, token refresh for auth issues.
- Progress is logged after each download, showing completed/total and remaining.

The entire process is wrapped in `downloadAll()`, which catches top-level errors and exits with code 1 on failure.

## Output Structure

After running:

- **`data/assets.json`**: JSON array of assets (e.g., 1000+ entries). Example entry:

  ```json
  {
    "name": "example.png",
    "category": "blocks",
    "subcategory": "wood",
    "url": "https://mcicons.ccleaf.com/assets/blocks/wood/example.png"
  }
  ```

- **`assets/` Directory**:
  - Hierarchical structure: `assets/<category>/[<subcategory>/]<filename>`.
  - Examples:
    - `assets/blocks/stone.png`
    - `assets/items/tools/subcategory/sword.png`
  - Images are PNG files (or other formats from the API).
  - Directories are created automatically.

Total output size depends on the number of assets (expect several GB for full download).

## Concurrency and Retry Settings

- **Concurrency**: 12 parallel downloads balance speed and API limits. Adjust based on your bandwidth/API rate limits (too high may cause 429 errors or bans).
- **Retries**: Up to 4 attempts per request/download:
  - Auth errors (401/403): Refresh token and retry.
  - Network/other: Wait (500ms * attempt) and retry.
- **Timeouts**: 25s per request to prevent hangs.

Tune these in `client.js` constants for your environment.

## Notes and Limitations

- **API Dependency**: Relies on mcicons.ccleaf.com stability and your API key's quotas. Check their terms for usage limits.
- **No Partial Resumes**: While it skips existing files, it re-fetches the asset list each run. For large downloads, run once and resume if interrupted.
- **Error Handling**: Logs errors but continues with other downloads. Check logs for failures; manual retry may be needed for persistent issues.
- **Security**: The API key is hardcoded—use environment variables (e.g., `process.env.API_KEY`) for production or shared code.
- **Platform**: Tested on Windows (uses `sh` shell, but Node.js is cross-platform). Paths use forward slashes internally.
- **Customization**: Extend for filtering assets (e.g., by category) by modifying `getAllImages()` or the queue.
- **Legal**: Ensure compliance with mcicons.ccleaf.com's terms and Minecraft's asset usage policies (assets are for fair use, not redistribution).

If you encounter issues, check console logs or open an issue (if this is a repo).

---
*Last updated: [10/22/25]*
```
