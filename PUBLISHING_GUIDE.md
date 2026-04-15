# Publishing TimeTackle to the n8n Marketplace

## Step-by-step guide to get your node live on n8n

---

## Prerequisites

- Node.js v22+ installed
- npm account (https://www.npmjs.com/signup)
- GitHub repo for this project
- Your TimeTackle SVG logo (replace the placeholder in `nodes/TimeTackle/timetackle.svg`)

---

## Phase 1: Set Up and Test Locally

### 1. Initialize the project

```bash
cd n8n-nodes-timetackle
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Test locally with n8n

```bash
# Link the package globally
npm link

# In your n8n installation directory
cd ~/.n8n
npm link n8n-nodes-timetackle

# Start n8n
npx n8n start
```

Open n8n at http://localhost:5678 and search for "TimeTackle" in the node picker. You should see the node with the API Key credential option.

### 4. Test each operation

- Create API Key credentials with your TimeTackle API key
- Test "Export > Export Calendar Data" with a page/limit
- Test "Property > Get All" to verify connectivity
- Verify error handling (use a bad API key)

---

## Phase 2: Publish to npm

### 1. Create a GitHub repo

```bash
git init
git add .
git commit -m "feat: initial n8n community node for TimeTackle"
git remote add origin https://github.com/AkashMishra-TT/n8n-nodes-timetackle.git
git push -u origin main
```

### 2. Set up npm publishing

```bash
# Login to npm
npm login

# Verify package name is available
npm view n8n-nodes-timetackle
```

### 3. Configure GitHub Actions for provenance

In your GitHub repo settings:

1. Go to **Settings > Environments** and create a new environment (optional)
2. Go to **Settings > Secrets and variables > Actions**
3. Add `NPM_TOKEN` as a repository secret (generate at npmjs.com > Access Tokens > Automation)

### 4. Create your first release

```bash
# Tag and push
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Action (`.github/workflows/publish.yml`) will automatically build and publish to npm **with provenance** (required by n8n from May 1, 2026).

---

## Phase 3: Submit for Verification (n8n Marketplace)

Once your package is live on npm, submit it for verification to appear in the n8n marketplace.

### 1. Go to the n8n Creator Hub

Visit: https://creators.n8n.io

### 2. Requirements checklist

Before submitting, verify your node meets these requirements:

- [x] Package name starts with `n8n-nodes-`
- [x] MIT licensed
- [x] No runtime dependencies (only devDependencies and peerDependencies)
- [x] Uses `n8n-workflow` as a peerDependency
- [x] Published with provenance via GitHub Actions
- [x] Has a proper README with installation instructions
- [x] Node icon is an SVG file
- [x] Credential test endpoint works (GET /properties validates API key)

### 3. Submit for review

On the Creator Hub:

1. Sign in with your n8n account
2. Submit your npm package name: `n8n-nodes-timetackle`
3. Provide your GitHub repo URL
4. n8n team will review for quality and security

### 4. After verification

Once verified, your node:

- Gets a **verified badge** in the n8n UI
- Becomes **installable from the n8n canvas** (not just community nodes page)
- Appears in **n8n Cloud** for all cloud users
- Shows up in the **n8n integrations directory**

---

## Project Structure Reference

```
n8n-nodes-timetackle/
├── .github/workflows/publish.yml   # Auto-publish on tag push
├── credentials/
│   └── TimeTackleApi.credentials.ts        # API Key auth
├── nodes/TimeTackle/
│   ├── TimeTackle.node.ts          # Main node with all operations
│   └── timetackle.svg              # Node icon
├── package.json                     # n8n node registration
├── tsconfig.json
├── gulpfile.js                      # Icon copy task
├── LICENSE.md                       # MIT (required)
└── README.md
```

---

## Supported Operations

| Resource   | Operations                        |
|-----------|-----------------------------------|
| Export     | Export Calendar Data              |
| Property   | Create, Get All, Update, Delete  |

---

## Important Notes

- **No runtime dependencies**: n8n verified nodes cannot have runtime npm dependencies. All HTTP calls go through `this.helpers.requestWithAuthentication()` which is built into n8n.
- **Provenance required**: From May 1, 2026, all verified nodes must be published via GitHub Actions with provenance. The included workflow handles this.
- **Replace the icon**: Swap `nodes/TimeTackle/timetackle.svg` with your actual TimeTackle logo (SVG format, square aspect ratio recommended).
- **Update the repo URL**: Change the `repository` field in `package.json` to your actual GitHub repo.
