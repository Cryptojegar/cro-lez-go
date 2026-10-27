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

The **Claude Review Upload** tab (`/claude-review-upload`) lets anyone drop an HTML
report exported from Claude (for example `oramune.html`) and turn it into a
share-ready link for clients.

- The file name becomes the link name: `oramune.html` → `/oramune`.
- Reviews are published into this repository as `public/<slug>.html`, plus a small
  `public/<slug>/index.html` redirect so `/oramune` works on any static host, and
  `public/claude-reviews.json` keeps the list of everything that is published.
- The upload page also lists published reviews with open / copy link / delete actions.
- `/oramune` is rendered by the `ReviewView` route (full-screen review);
  `/oramune.html` works as a direct link as well.

Publishing uses the GitHub Contents API, so the first publish needs a fine-grained
personal access token with **Contents: Read and write** for this repository
(create one at `github.com/settings/personal-access-tokens/new`). The token is kept
in the browser's `localStorage` only and is never committed. After publishing, the
site redeploys (Lovable Publish or your host) and the link is live for clients.

### Local development

```sh
npm install
npm run dev   # http://localhost:8080/claude-review-upload
```

