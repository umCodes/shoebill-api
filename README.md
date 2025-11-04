# shoebill ai

An AI-powered quiz generation and paper clean‑up API. Upload PDFs (text or scanned), extract content with OCR when needed, and generate structured quizzes with difficulty control. Track quiz history, enforce per‑page and per‑question credits, and validate user answers via an LLM.

> Calm, precise, effective — like the shoebill.


## Features

- AI quiz generation from educational content (PDF text or OCR’d scans)
- Supported question types: MCQ, True/False, Fill‑in‑Blank, Short Answer
- Difficulty levels: Basic, Regular, Intermediate, Advanced, Expert
- Paper “clear‑up”: extract only valid questions from uploaded exam/quiz text
- Credits system: charges per PDF page processed and per question generated
- Auth, user profile updates, feedback endpoint


## Tech Stack

- Runtime: Node.js + Express
- Database: MongoDB
- OCR: Tesseract.js
- PDF parsing and image conversion: `pdf-parse`, `node-poppler`
- LLMs:
  - Google Gemini 2.0 Flash (quiz generation, clear‑up)
- TypeScript


## Architecture (high level)

- `src/index.ts` wires Express, CORS, cookies, auth middleware, routes, and DB connection
- `src/controllers/*` implement auth, file, quiz, clear‑up, and user handlers
- `src/middlewares/*` include authentication, error handling, file upload/processing, and credits pre‑calc
- `src/utils/*` contain LLM prompts, PDF/OCR utilities, credits, and token helpers
- `src/db/db.ts` provides MongoDB connection helpers


## Environment variables

Create a `.env` in the project root with:

```
PORT=3000
ORIGIN=http://localhost:5173        # frontend origin for CORS

# MongoDB
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=shoebill

# Auth token secrets
ACCESS_TOKEN_SIGNATURE=replace_me
REFRESH_TOKEN_SIGNATURE=replace_me

# LLM providers
GEMINI_API_KEY=your_google_gemini_key
OPEN_ROUTER_API_KEY=your_openrouter_key
```


## Installation and setup

```bash
git clone <repo-url> shoebill-ai
cd shoebill-ai
npm install
cp .env.example .env  # if provided; otherwise create .env using the table above
npm run dev
```

The server prints the listening port (defaults via `PORT`). Ensure MongoDB is reachable and env vars are set.


## API Overview

Base URL: depends on your deployment, locally often `http://localhost:3000`.

### Auth

- `POST /auth/signup`
- `POST /auth/login`
- `DELETE /auth/logout`

Tokens are managed via cookies; routes under `/api` are protected by refresh/access token middleware.

### Files

- `POST /api/pages` — multipart PDF upload; returns `{ pages }`

### Clear‑up (extract valid questions from a paper)

- `POST /api/clearup` — multipart PDF upload with fields:
  - `file` (PDF)
  - `file_type`: `image` | `text` (choose OCR for scanned PDFs)
  - `qTypes`: JSON string array of types, e.g. `["MCQ","TF","FIB","SAQ"]`
  - credits are pre‑calculated by middleware based on pages and `file_type`
  - Returns a stored “Clear‑up” record with extracted questions and credits used

### Quizzes

- `POST /api/quiz` — multipart PDF upload with fields:
  - `file` (PDF)
  - `file_type`:  `text`
  - `qTypes`: JSON string array, e.g. `["MCQ","TF"]`
  - `difficulty`: `Basic|Regular|Intermediate|Advanced|Expert`
  - `number`: integer desired question count (the service batches up to 20 per LLM call and dedupes)
  - Returns a stored “Quiz” record with topic and generated questions

- `GET /api/quizzes` — get user quiz history (newest first)
- `GET /api/quizzes-total` — get total quiz count
- `GET /api/quiz?id=<quizId>` — get a specific quiz
- `DELETE /api/quiz?id=<quizId>` — delete a quiz

### Answer checking

- `POST /api/check` — body: `{ question, answer, explanation }`
  - Validates inputs and checks correctness vs. `explanation` via LLM
  - Returns `{ valid: boolean, correct?: boolean, reason?: string }`

### Users

- `GET /user` — returns authenticated user
- `PUT /user/name` — update display name
- `POST /api/feedback` — submit feedback


## Credits model

- Per‑page cost: derived in middleware (`creditsPerPage.imagePDF` for OCR, `creditsPerPage.textPDF` for text PDFs)
- Per‑question cost: `creditsPerQuestion` multiplied by successfully generated questions
- Total credits are checked before processing and deducted after successful operations


## File handling and constraints

- Text PDFs: parsed with `pdf-parse`; must meet a minimum character threshold
- Scanned PDFs: converted to images via `node-poppler`, OCR’d with Tesseract.js (English)
- Page limits are enforced (see `maxNumOfPagesPerPdf`, `maxClearUpPages`)


## Development scripts

Common scripts (check `package.json`):

```bash
npm run dev      # start development server (with nodemon)
npm run build    # if configured for production builds
npm run start    # run compiled server
```


## Directory structure (key paths)

```
src/
  controllers/         # route handlers (auth, file, quiz, clear-up, user)
  middlewares/         # auth, cookies, errors, multer, file processing/credits
  routes/              # express Routers mounted in index.ts
  utils/               # llm, prompts, files (pdf/ocr), credits, tokens, env
  db/                  # Mongo connection utilities
  models/              # TypeScript types for quizzes, users, jwt
  constants/           # env, credits, constraints
  index.ts             # app bootstrap
uploads/               # temporary file storage (cleaned periodically)
```


## Docker (optional)

```bash
docker build -t shoebill-ai:latest .
docker run -p 3000:3000 --env-file .env shoebill-ai:latest
```

Note: OCR with `tesseract.js` and `node-poppler` may require additional system libs depending on your base image.


## Security and reliability notes

- Never commit `.env` or secrets
- Validate uploaded files and sizes; clean `uploads/` regularly
- Enforce CORS via `ORIGIN`
- Fail fast on missing env vars and DB connection issues


## Troubleshooting

- 401 Unauthorized: ensure auth cookies are present and valid
- 402 Insufficient Credits: top up or reduce request size/questions
- 400 on PDF parsing: confirm PDF is readable (for OCR use `file_type=image`)
- OCR is slow: large scans are CPU‑intensive; consider page limits and queues


## License

Add your preferred license (MIT suggested) and include a `LICENSE` file.

