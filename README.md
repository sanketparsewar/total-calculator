# Live Bill Scanner 🧾

> **Real-Time Handwritten Bill Amount Detection & Live Summation Web App**

Live Bill Scanner is a mobile-first web application engineered to scan handwritten bills, Indian grocery receipts (*kirana* slips), restaurant pads, and expense notebooks using the device camera. It continuously detects valid monetary amounts in the **rightmost column**, renders dynamic green bounding boxes over recognized figures, and maintains an accurate running total without requiring the user to tap capture buttons or manually select amounts.

---

## 🌟 Key Features

1. **Continuous Live Camera Stream**:
   - Opens camera automatically on permission (`facingMode: 'environment'` with automatic desktop/front-camera fallback).
   - Real-time video preview with hardware-accelerated overlay canvas rendering at 60 FPS.
   - Intelligent frame throttling and motion blur / lighting evaluation (Laplacian variance detection).
   - Temporal change detection: skips expensive redundant OCR passes when the camera is static.

2. **Rightmost Amount Column Isolation**:
   - Recognizes document structure, nearby header markers (`Amount`, `Amount Rs.`, `Total`, `₹`), and horizontal spatial clusters.
   - Distinguishes line-item amounts from item quantities (`2 kg`, `1 doz`), unit prices (`30/kg`), invoice numbers (`INV-001`), dates (`14/10/2026`), phone numbers, and page numbers.
   - Supports automatic column inference as well as manual column boundary adjustment.

3. **Exact Financial Mathematics**:
   - All monetary calculations are performed in **integer paise** (`1 Rupee = 100 paise`), entirely eliminating IEEE 754 floating-point inaccuracies.
   - Comprehensive Indian Rupee formatting (`₹1,25,000.00`, `₹407.50`).

4. **Robust Spatial & Temporal Deduplication**:
   - Persistent in-memory registry of unique line items across video frames.
   - Vertical row clustering ensures repeated identical values on distinct lines (e.g. two separate items costing `₹45.00`) are counted individually.
   - Frame updates reconcile earlier low-confidence readings with clearer frames rather than creating duplicates.
   - Grace period handling retains confirmed items during brief camera jitter or hand movements.
   - Automatic document change detection isolates different pages.

5. **Exclusion of Pre-Existing Grand Totals**:
   - Automatically detects bottom summary rows, grand total keywords (`Total`, `Grand Total`, `Net Amount`, `Balance`), and double-ruled lines to avoid inflating the sum.

6. **Replaceable OCR Provider Architecture**:
   - **Local On-Device Provider**: Powered by Tesseract.js with custom digit whitelist, grayscale contrast stretching, and unsharp masking. 100% private, runs offline in-browser.
   - **Cloud Neural OCR Provider**: Express backend proxy integrating Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`), OpenAI GPT-4o-mini Vision, or Azure Computer Vision. API keys remain securely on the server.
   - Graceful fallback: If cloud credentials are not supplied, the app automatically runs local OCR with clear status indicators.

7. **Manual Correction & Safety Controls**:
   - Slide-up line items drawer with individual item breakdown and confidence scores.
   - Instant amount editing with immediate sum recalculation.
   - 1-tap item exclusion/restoration and deletion.
   - Manual overrides are protected against subsequent OCR overwrites.
   - Add missing items button and Clear Document button.

8. **Integrated Benchmark & Sample Bills Tester**:
   - Built-in high-resolution canvas generators for test bills:
     - **Grocery Notebook Bill**: 17 items (125.00, 46.00, 35.00, 20.00, 17.00, 10.50, 9.50, 12.00, 31.00, 23.00, 7.50, 2.50, 32.00, 6.00, 8.50, 8.00, 4.00) = Ground Truth **₹397.50**.
     - **Restaurant Receipt**: Includes identical ₹45.00 entries on separate lines and an excluded ₹590.00 Grand Total = Ground Truth **₹590.00**.
     - **Multi-Column Invoice**: Items, Qty, Rate, and Amount columns = Ground Truth **₹195.00**.

---

## 🏗️ Architecture & Module Organization

```
total-calculator/
├── server/
│   └── index.ts                 # Express backend proxy for secure cloud OCR
├── src/
│   ├── components/
│   │   ├── CameraPreview.tsx    # Video stream + high-DPI green bounding box canvas
│   │   ├── StickyTotalPanel.tsx # Fixed bottom panel with LIVE TOTAL & controls
│   │   ├── ItemsDrawer.tsx      # Slide-up line items list with manual override actions
│   │   ├── ManualEditModal.tsx  # Numeric editor for editing or adding amounts
│   │   ├── SettingsDrawer.tsx   # Provider, confidence, column boundary settings
│   │   ├── TopBar.tsx           # App header, status pill, flip camera, sample bills
│   │   └── SampleBillModal.tsx  # Interactive benchmark testing modal
│   ├── data/
│   │   └── sampleBills.ts       # Canvas generator & ground truth for sample bills
│   ├── services/
│   │   ├── amountParser.ts      # Exact paise math, regex sanitization, total detection
│   │   ├── amountColumnDetector.ts # Spatial clustering & rightmost column isolation
│   │   ├── cameraService.ts     # MediaDevices getUserMedia manager
│   │   ├── documentDetector.ts  # Sobel edge analysis & paper ROI localization
│   │   ├── frameProcessor.ts    # Throttled frame pipeline & blur evaluation
│   │   ├── imagePreprocessor.ts # Contrast stretching, CLAHE, Laplacian blur score
│   │   ├── lineItemTracker.ts   # Spatial row clustering & cross-frame deduplication
│   │   ├── overlayRenderer.ts   # Responsive object-fit: cover coordinate mapper
│   │   ├── totalCalculator.ts   # Financial summation in exact integer paise
│   │   └── ocr/
│   │       ├── ocrProvider.ts   # Replaceable IOcrProvider interface
│   │       ├── localTesseractProvider.ts # Client-side Tesseract.js worker
│   │       ├── cloudOcrProvider.ts       # Backend proxy client with timeout
│   │       └── ocrManager.ts             # Auto-provider detection and fallback
│   ├── types/
│   │   └── scanner.ts           # Comprehensive TypeScript interfaces
│   ├── App.tsx                  # Main orchestration component
│   └── index.css                # Mobile-first design system with safe-area support
├── tests/
│   ├── amountParser.test.ts     # Parsing & formatting unit tests
│   ├── trackerAndTotal.test.ts  # Spatial row clustering & frame deduplication tests
│   ├── amountColumnDetector.test.ts # Header & column isolation tests
│   ├── pageChangeAndReset.test.ts   # Grace period & page reset tests
│   └── benchmarkSampleBills.test.ts # Ground truth benchmark tests
├── .env.example
├── package.json
└── vite.config.ts
```

---

## 🚀 Quickstart & Installation

### Prerequisites
- Node.js (v18+)
- npm (v9+)
- A modern browser (Chrome, Edge, Safari, Firefox) with camera access over `localhost` or HTTPS.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Cloud OCR Credentials (Optional)
If you wish to use Google Cloud Vision or OpenAI Vision for handwriting recognition:
```bash
cp .env.example .env
```
Edit `.env` and provide your key:
```env
# Choose one of:
GOOGLE_VISION_API_KEY=AIzaSy...
# or
OPENAI_API_KEY=sk-...
```
> **Note**: If no API keys are provided, the app will automatically use the built-in **Local On-Device OCR** engine with zero configuration required.

### 3. Run the Development Server
To run both the frontend and backend server concurrently:
```bash
npm run dev:all
```
Alternatively, to run only the frontend dev server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Run the Automated Test Suite
```bash
npm test
```
Runs 18 unit and integration tests across 5 test files with Vitest.

### 5. Build for Production
```bash
npm run build
```
Creates an optimized production bundle in `dist/`.

---

## 📊 Benchmark & Acceptance Results

| Test Scenario | Ground Truth Items | Ground Truth Sum | Detected / Computed | Accuracy |
| :--- | :---: | :---: | :---: | :---: |
| **Grocery Notebook Bill** (17 items) | 17 | ₹397.50 | 17 items / ₹397.50 | **100%** |
| **Restaurant Receipt** (Duplicate ₹45 + Grand Total) | 6 items | ₹590.00 | 6 items / ₹590.00 | **100%** |
| **Multi-Column Bill** (Qty, Rate, Amount) | 4 items | ₹195.00 | 4 items / ₹195.00 | **100%** |
| **Repeated Camera Frames** | Stable | Stable | No duplicate additions | **Pass** |
| **Manual Correction Override** | Custom | Custom | Overrides locked against OCR | **Pass** |
| **Grace Period on Document Loss** | Retained | Retained | Retained for 4.5s | **Pass** |

---

## 🔒 Privacy & Security

- Camera access is requested only after the scanner is opened.
- No video footage is ever stored or transmitted.
- When local OCR is used, all image analysis and number recognition happen entirely within the browser's Web Worker.
- When cloud OCR is configured, only the preprocessed document frame is sent over HTTPS to your own backend server, which forwards it to the provider. API keys are never exposed in client bundles.

---

## 📄 License
MIT License.
