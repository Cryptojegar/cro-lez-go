# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/6e943188-43a4-479c-927d-f12bc081f14e

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6e943188-43a4-479c-927d-f12bc081f14e) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6e943188-43a4-479c-927d-f12bc081f14e) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Claude Review Upload (client-facing HTML reviews)

The **Claude Review Upload** tab (`/audits`, previously `/claude-review-upload`, which now redirects) lets anyone drop an HTML
report exported from Claude (for example `oramune.html`) and turn it into a
share-ready link for clients.

- The file name becomes the link name: `oramune.html` → `/oramune`.
- Reviews are published into this repository as `public/<slug>.html`, plus a small
  `public/<slug>/index.html` redirect so `/oramune` works on any static host, and
  `public/claude-reviews.json` keeps the list of everything that is published.
- The upload page also lists published reviews with open / copy link / delete actions.
- `/oramune` is rendered by the `ReviewView` route (full-screen review);
  `/oramune.html` works as a direct link as well.

Publishing uses the GitHub Contents API, so publishing needs a token and a target
repository: on the upload page open **Settings** and press **Connect** — the token
is typed once into a prompt, kept in the browser's `localStorage` only, never
rendered on the page and never committed. Create a fine-grained token with
**Contents: Read and write** for this repository at
`github.com/settings/personal-access-tokens/new`. "Forget" removes it from the
browser again. After publishing, the site redeploys (Lovable Publish or your host)
and the link is live for clients.

The owner / repository / branch are **not hardcoded** and are never displayed:
they are stored in `localStorage` too, and are only typed when you press
**Settings → Change target** (a first publish without a target opens that editor).
This keeps those names out of the public JavaScript bundle as well as off the
screen — so nothing but the token prompt ever shows account details.

Do **not** put the token in a `.env` file: Vite inlines `VITE_*` variables into the
public JavaScript bundle, so a token there is readable by anyone who visits the
site. `.env` files are git-ignored, and the page shows a warning if a
`VITE_GITHUB_TOKEN` is present in the build.

The repository may be **private**: the token simply needs access to it
(*Repository access → Only select repositories → this repo*), and the host that
builds the site needs read access to the same repo. Note that repository privacy
does **not** make the reviews private — a published review is a public page on the
deployed site (`/<slug>`), and `claude-reviews.json` lists every published slug.

### Local development

```sh
npm install
npm run dev   # http://localhost:8080/audits
```

