# SmartReco

*A little more you, in every discovery.*

A product recommendation web app. A Next.js frontend talks to a FastAPI backend that scores products
against a prompt, rating, category and budget. Prices are in Indian Rupees (₹).

## Quick start (one command)

Requires **Python 3.10+** and **Node.js 18+**.

```bash
cd smartreco        # the folder that contains run.js
npm start           # same as: node run.js
```

Then open **http://localhost:3000**.

The first run creates the Python virtual environment, installs the backend and frontend
dependencies, and creates `frontend/.env.local`. This takes a minute or two. Later runs start in seconds.
Press **Ctrl+C once** to stop both servers.

| Service  | URL                          |
|----------|------------------------------|
| Web app  | http://localhost:3000        |
| API      | http://localhost:8000        |
| API docs | http://localhost:8000/docs   |

## Everyday commands

Windows Git Bash paths are shown (`D:\product_reco1\smartreco` is written `/d/product_reco1/smartreco`).

| Task | Where | Command |
|---|---|---|
| Start the whole app | top-level `smartreco` folder | `node run.js` (`npm start` and `npm run dev` do the same, but only from this folder) |
| Stop it | the same terminal | Ctrl+C once |
| Add a product batch | files only | JSON into `backend/data/`, pictures into `frontend/public/products/`, then restart |
| Check a data file without importing | `backend` folder | `.venv/Scripts/python import_products.py --dry-run` |
| Import by hand | `backend` folder | `.venv/Scripts/python import_products.py` |
| Preview picture processing | top-level folder | `backend/.venv/Scripts/python tools/prepare_images.py "D:/product_reco1/raw_images" --dry-run` |
| Process pictures for real | top-level folder | the same command without `--dry-run` |

Run `import_products.py` from inside `backend/`. It uses the database in the folder you run it from, so running it
elsewhere would fill a different database than the one the API reads. On macOS/Linux use `.venv/bin/python`.

## Project structure

```
smartreco/
├── run.js                 One-command launcher (starts API + web app)
├── package.json           Root scripts: npm start / npm run dev
├── README.md
├── backend/
│   ├── main.py            FastAPI app and routes (incl. auth)
│   ├── auth.py            Password hashing and login tokens
│   ├── models.py          SQLAlchemy models, DB session, Pydantic schemas
│   ├── recommender.py     Hybrid scoring engine
│   ├── seed.py            The original 10 products and a demo user
│   ├── import_products.py Loads product batches from data/*.json
│   ├── data/
│   │   ├── products_batch1.json   5 Electronics products
│   │   └── products_batch2.json   50 products across all 5 categories
│   └── requirements.txt
├── tools/
│   ├── prepare_images.py  Resizes/renames your generated pictures into place
│   └── image_checklist.csv  Every product's filename and an image prompt
└── frontend/
    ├── package.json
    ├── tailwind.config.ts Warm palette (warm-beige, accent-terracotta, ink)
    ├── postcss.config.js
    ├── tsconfig.json
    ├── .env.local.example
    ├── app/
    │   ├── page.tsx       Header, hero, category pills, recommendation grid
    │   ├── auth-context.tsx  Login state shared across pages
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── layout.tsx     Fonts + auth provider
    │   └── globals.css
    ├── components/
    │   └── AuthShell.tsx  Shared layout and fields for login/signup
    └── public/products/   One image per product (placeholders now; replace with real photos)
```

## Manual setup (two terminals)

Use this if you prefer to run each part yourself.

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows Git Bash: source .venv/Scripts/activate
                                   # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py                     # optional: the API seeds an empty DB on startup
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
cp .env.local.example .env.local   # Windows cmd: copy .env.local.example .env.local
npm install
npm run dev
```

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | API address (default `http://localhost:8000`). Restart the dev server after changing it. |
| `DATABASE_URL` | environment | Defaults to SQLite. For PostgreSQL: `postgresql+psycopg2://user:pass@localhost/smartreco` (also `pip install psycopg2-binary`). |
| `CORS_ORIGINS` | environment | Comma-separated allowed origins (default `http://localhost:3000`). |
| `SMARTRECO_SECRET` | environment | Key used to sign login tokens. If unset, a random key is created in `backend/.secret_key` on first run. Set it explicitly in production. |
| `SMARTRECO_USE_EMBEDDINGS` | environment | Set to `1` to use semantic embeddings (`pip install sentence-transformers`). The first request downloads a model. |

## Accounts (login and sign up)

- Pages: **/signup** and **/login**. The header shows *Log in / Sign up*, or your initial and *Log out* once signed in.
- Sign-up collects name, email, password (8+ characters), optional style tags and a usual budget. When you are logged in, "Picked for you" uses your style tags and budget tier.
- Passwords are hashed with scrypt. Login returns a token valid for 7 days, stored in the browser (localStorage) and sent as `Authorization: Bearer <token>`.
- Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`.
- Existing databases are upgraded automatically (a `password_hash` column is added on startup).
- The seeded demo user (`aarohi@example.com`) has no password and can't log in. Create your own account instead.
- This is a solid starting point, not a finished security setup: before going live add HTTPS, rate limiting on login, email verification and password reset, and consider httpOnly cookies instead of localStorage.

## How recommendations work

`POST /api/recommend`

```json
{ "prompt": "wireless headphones under 15k", "category": null, "sort": "relevance", "limit": 20 }
```

```
Score = 0.5 × text match + 0.3 × rating + 0.2 × category/budget alignment
```

- **Text match:** TF-IDF cosine similarity over title, brand, category, tags and description, normalised so the best match is 1.
- **Rating:** rating ÷ 5.
- **Alignment:** category hits (from the tab or keywords in the prompt) and budget fit. Budgets are parsed from phrases like "under 15k", "below ₹5,000" or "up to 2 lakh". Products far above the budget are excluded.
- **No prompt ("Picked for you"):** ranks by the recommended flag, the user's style preferences and rating.
- **Sort options:** `relevance`, `price_asc`, `rating_desc`.

Other endpoints: `GET /api/health`, `GET /api/products`, `GET /api/categories`.

## Product data (65 products)

The catalogue is the original 10 products (`seed.py`) plus every JSON file in `backend/data/` (55 products).
New products from those files are added automatically when the API starts, so adding a batch is:

1. Put the JSON file in `backend/data/` (same fields as the existing files).
2. Put the pictures in `frontend/public/products/`, named exactly as each product's `image_file`.
3. Restart with `npm start`.

Or run the importer yourself from `backend/` (with the venv active, or via `.venv/Scripts/python` on Windows):

```bash
python import_products.py --dry-run   # check the files, change nothing
python import_products.py             # add new products
python import_products.py --update    # also update existing products (matched by title)
python import_products.py --raw       # skip the automatic clean-ups
```

Rows that break the rules (missing fields, price outside the category range, bad image filename, duplicate title)
are rejected and listed. Users and existing products are never deleted.

**Automatic clean-ups** (all printed by the importer, skipped with `--raw`): category-name tags removed, a
"waterproof" tag changed to "water resistant" when the description says water-resistant, at most 3 ratings above
4.7 and at most 1 "Recommended" badge per category per file, and two author names that match real people
replaced. Your JSON files are never modified.

Searches show 20 products at a time with a **Show more** button.

## Product images

`frontend/public/products/` holds one picture per product. Right now they are placeholders (a beige tile with the
product name). Each file is named after the product's `image_file` value (in `backend/data/*.json` and `seed.py`).
If a file is missing, the card shows a soft placeholder icon instead.

Cards show the picture in a fixed frame and crop it from the centre, so keep the product centred with a margin.
The homepage collage uses three of them (`ikea-table-lamp.jpg`, `zara-linen-dress.jpg`, `sony-wh-ch720n.jpg`),
so do those first.

### Adding real pictures

1. Open `tools/image_checklist.csv` in Excel. It has 65 rows: the exact filename to save as, plus an image
   prompt for each product (the original 10 use unbranded prompts).
2. Generate the pictures with any image tool. Save them all in one folder **outside the project**, for example
   `D:\product_reco1\raw_images`, named like the "save as" column. Capitals, spaces and the extension don't
   matter (`Vertex Rapid Charger 65W.png` works), and PNG, JPG and WebP are all accepted.
3. Install Pillow once (needed only by this script):
   ```bash
   cd /d/product_reco1/smartreco
   backend/.venv/Scripts/python -m pip install pillow
   ```
4. Preview, then run for real:
   ```bash
   backend/.venv/Scripts/python tools/prepare_images.py "D:/product_reco1/raw_images" --dry-run
   backend/.venv/Scripts/python tools/prepare_images.py "D:/product_reco1/raw_images"
   ```
   Each picture is cropped to a centred square, resized to 1000x1000, compressed under 250 KB and saved into
   `frontend/public/products/`. The script warns about pictures that weren't square (their edges were cropped).
   Files that don't match a product are listed with the closest names; nothing is guessed. Pictures you haven't
   supplied keep their placeholder, so you can run it in stages.
5. Hard-refresh the browser (Ctrl+Shift+R). No restart is needed.

After adding a new data batch, refresh the checklist with
`backend/.venv/Scripts/python tools/prepare_images.py --checklist`.

**Tip for Windows:** File Explorer hides real file extensions. Renaming a PNG to `name.jpg` actually creates
`name.jpg.png`. The script copes with that, but turn on View > Show > File name extensions so you can see the real
names. You don't need to rename PNGs to JPG at all.

## Wishlist

The heart button saves products in your browser (localStorage). Nothing is stored on the server.

## Production

```bash
# backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# frontend (set NEXT_PUBLIC_API_URL first; it is baked in at build time)
cd frontend && npm run build && npm start
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm start` says it can't find `package.json` | Run it from the top-level `smartreco` folder, not from `backend/` or `frontend/`. |
| `npm run dev` inside `frontend/` shows no products | That starts only the website. Run it from the top-level folder (or use `node run.js`) so the API starts too. |
| npm error `EALLOWSCRIPTS` | A known npm issue with an `allow-scripts` setting. Start with `node run.js` instead of `npm start`. |
| "Python 3.10+ was not found" | Install Python from python.org and make sure it is on your PATH. |
| `.venv/bin/activate: No such file` | On Windows the script is `.venv/Scripts/activate`. |
| `No module named 'models'` | `import_products.py` is not inside `backend/` (it must sit next to `models.py`). |
| `No module named 'pydantic'` | The wrong Python is running. Use `backend/.venv/Scripts/python`, or run `node run.js`, which installs the requirements. |
| "We can't reach the recommendation service" | The API isn't running or `NEXT_PUBLIC_API_URL` is wrong. |
| CORS error in the browser console | Add your frontend origin to `CORS_ORIGINS`. |
| Port 8000 or 3000 already in use | Stop the other process, or change the port in `run.js` and `.env.local`. |
| `prepare_images.py`: "Folder not found" | Create the folder first. In Git Bash use forward slashes: `"D:/product_reco1/raw_images"`. |
| `prepare_images.py`: "0 of 65 products" | The folder is empty, the pictures are in a subfolder (only the top level is read), or the names don't match. Unmatched files are listed with the closest product names. |
| `prepare_images.py`: "Pillow is required" | `backend/.venv/Scripts/python -m pip install pillow` |
| New pictures don't appear | Hard-refresh with Ctrl+Shift+R. Check the file is in `frontend/public/products/` with exactly the product's filename. |
| New products don't appear | The JSON must be in `backend/data/` and valid; restart the app. Run the importer with `--dry-run` to see rejected rows. |
| Stale or odd data | Stop the app and delete `backend/smartreco.db`, then restart. **This also deletes user accounts.** `python seed.py --reset` does the same. |