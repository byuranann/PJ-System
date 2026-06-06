# SheetSync - Google Sheets Data Collection & Analytics Dashboard

SheetSync is a modern, premium web application built using **TypeScript, HTML5, and CSS3** that interfaces directly with **Google Sheets** via a serverless **Google Apps Script** API. 

It provides a responsive, single-page application (SPA) layout inspired by Notion, Stripe, and Google Analytics, featuring real-time data entry validation, data caching, dynamic visualizations (Bar, Line, Pie charts) powered by **Chart.js**, and dark mode support.

---

## 📂 Project Structure

```
PJ System/
├── index.html                   # Entry point (layout skeleton + SPA view containers)
├── package.json                 # Project configuration and dependencies (Chart.js, etc.)
├── vite.config.ts               # Vite configuration (ports, build output, directories)
├── tsconfig.json                # TypeScript compiler configuration
├── src/
│   ├── main.ts                  # App initializer, SPA hash router, settings and theme controllers
│   ├── types.ts                 # TypeScript interfaces (DataRow, AnalyticsSummary, etc.)
│   ├── api.ts                   # Google Sheets HTTP client layer (GET/POST CORS handler)
│   ├── style.css                # Premium vanilla CSS styling system & color schemes
│   ├── pages/
│   │   ├── form.ts              # Data Entry Page component (real-time field validation)
│   │   └── dashboard.ts         # Analytics Dashboard Page component (metrics, table, Chart.js)
│   └── utils/
│       └── helpers.ts           # Math calculations, date/number formatting, input sanitization
└── GAS/
    └── Code.js                  # Google Apps Script Web App backend script
```

---

## 🛠️ Google Sheets & Backend Setup Guide

To connect the application to a Google Sheet, follow these steps to deploy your Google Apps Script backend:

### Step 1: Create the Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a **Blank spreadsheet**.
2. Rename the first sheet tab (at the bottom-left) to **`Data`** (exactly as written, case-sensitive).
3. Set up headers in Row 1:
   * **Column A**: `Timestamp`
   * **Column B**: `Field A`
   * **Column C**: `Field B`
   * **Column D**: `Field C`
4. Bold Row 1 for readability.

### Step 2: Open and Configure Apps Script
1. In your Google Sheet, click **Extensions** -> **Apps Script** in the top menu.
2. In the Apps Script editor, delete any template code in the file (usually named `Code.gs`).
3. Open the file [Code.js](file:///var/home/byuranan/Project/PJ%20System/GAS/Code.js) from this repository, copy the entire contents, and paste it into the Apps Script editor.
4. Click the **Save** icon (floppy disk) or press `Ctrl + S`.

### Step 3: Deploy as a Web App (Crucial Step)
1. Click the blue **Deploy** button in the top-right corner and select **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the deployment details:
   * **Description**: `SheetSync API Backend`
   * **Execute as**: **Me (your-email@gmail.com)** (This runs operations under your authority).
   * **Who has access**: **Anyone** (This is crucial to allow the frontend dashboard to access the API without OAuth login prompts).
4. Click **Deploy**.
5. Google will ask you to **Authorize Access**. Click **Authorize Access**, log in with your Google Account, click **Advanced** (at the bottom of the prompt), and then click **Go to SheetSync API Backend (unsafe)** to grant spreadsheet permissions.
6. Once deployed, copy the **Web app URL** from the dialog (it will end with `/exec`).

---

## 💻 Local Development Setup

To run the application locally on your computer:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org) (v18+) installed.

### Installation
1. Clone or navigate to the project directory:
   ```bash
   cd "PJ System"
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```

### Running Locally
1. Start the Vite development server:
   ```bash
   npm run dev
   ```
2. The browser will automatically open to `http://localhost:3000`.
3. If it is your first time opening the app, you will see a warning stating the API is unconfigured, and the **API Settings** modal will automatically appear.
4. Paste the **Google Apps Script Web App URL** you copied in Step 3 into the text field and click **Save Connection**.
5. The application is now fully connected! You can start submitting data or viewing the dashboard.

---

## 🚀 Building & Deploying the Web App

When you are ready to publish the web application to the internet:

### Generate Production Bundle
Run the build command:
```bash
npm run build
```
This compiles the TypeScript files, optimizes assets, and outputs a production-ready folder in:
```
PJ System/dist/
```

### Static Hosting Deployments
Because SheetSync compiles into vanilla HTML, CSS, and JS (SPA), the `dist/` directory can be hosted for **free** on any static web hosting provider:
* **Vercel**: Run `npx vercel` inside the root directory, or link your GitHub repo.
* **Netlify**: Drag and drop the `dist/` folder into the Netlify dashboard.
* **GitHub Pages**: Configure GitHub Actions to publish from the `dist/` directory or push build files to a `gh-pages` branch.
* **Firebase Hosting**: Run `npx firebase init hosting` and configure the public directory to point to `dist`.

*Note: Storing the API URL in localStorage ensures that your hosted frontend remains completely secure and serverless, as each user holds their spreadsheet endpoint configuration locally in their browser. Alternatively, you can set the build-time environment variable `VITE_API_URL` to hardcode your Apps Script URL during deployment.*

---

## 🛡️ Security & Performance Highlights

* **CORS Preflight Bypass**: Frontend POST requests are sent as `text/plain` payload, transforming the transaction into a "simple request" to prevent Google Apps Script CORS preflight blocks.
* **Input Sanitization**: Client-side inputs are sanitized via character escaping before insertion into the DOM to mitigate Cross-Site Scripting (XSS).
* **Validation Lifecycles**: Strict `:user-invalid` triggers validation states only after users exit (`blur`) a form group, avoiding annoying intrusive validation flags while typing.
* **Memory Leak Avoidance**: Chart.js objects are correctly disposed of using `.destroy()`, and intervals/timers are fully cleared when switching pages in the SPA shell router.
* **No FOUC (Flash of Unstyled Content)**: An inline parser in the HTML `<head>` runs immediately before document parsing to inject the user's saved light/dark mode preference.
