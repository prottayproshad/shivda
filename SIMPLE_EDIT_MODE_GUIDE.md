# Simple Admin Edit Mode - Quick Start

## Overview

Instead of a complex admin dashboard, this system lets you **edit your website pages directly** by:

1. Opening the page (e.g., `index.html`)
2. Logging in
3. Clicking any text or image to edit it
4. Saving changes

## Setup

### Step 1: Start the Backend

```powershell
cd "d:\29GB Material\Shiv"
python simple_admin_backend.py
```

Keep this terminal open.

### Step 2: Open the Edit Overlay

Open `admin-edit-overlay.html` in your browser.

### Step 3: Login

- **Username:** `admin`
- **Password:** `admin123`

(You can change the password in the file later)

## How to Use

### Edit Text

1. In edit mode, click any heading or text
2. A popup appears
3. Edit the text
4. Click "Save"
5. The text updates on the page

### Edit Images

1. In edit mode, click any image
2. A popup shows the current image
3. Paste a new image URL
4. Optionally edit the alt text
5. Click "Save"

### Save All Changes

Once you've made edits:
- Click the green **"💾 Save Changes"** button at the top
- Your actual `index.html` file is updated
- A backup is created automatically

### Exit Edit Mode

- Click **"Exit Edit Mode"** to turn off editing
- Click **"Logout"** to log out

## File Structure

```
your-website/
├── admin-edit-overlay.html      ← Open this to edit
├── simple_admin_backend.py      ← Run this in terminal
├── index.html                   ← Gets updated when you save
├── home.html
└── ...
```

## Security Notes

- Default password: `admin123` - **Change this in the file!**
- Edit mode only in browsers on your computer (localhost)
- Not accessible from the internet

## Changing the Password

Edit `admin-edit-overlay.html`, find this line:

```javascript
const ADMIN_PASSWORD = 'admin123';  // Change this to your password
```

Change `'admin123'` to your new password.

## Troubleshooting

### "Backend not running" error
→ Start `simple_admin_backend.py` in terminal

### Changes not saving
→ Make sure backend terminal is still open
→ Check browser console for errors (F12)

### Can't login
→ Username: `admin`
→ Password: Check what you set in the file

## Workflow Example

```
1. python simple_admin_backend.py (in terminal)
2. Open admin-edit-overlay.html
3. Login with admin/admin123
4. Click on "LANTA PILATES" text
5. Edit it to something new
6. Click Save in popup
7. Click "💾 Save Changes" at top
8. Check index.html - text is updated!
9. Exit Edit Mode
10. Logout
```

---

**Much simpler than the dashboard approach!** Just edit directly on the page.
