# Run Field Atlas on GitHub

| Choose | What runs | Best use |
| --- | --- | --- |
| **GitHub Codespaces** | The dashboard and its Node.js search server | Search through server-side APIs, including providers for which you have a key. Open the private forwarded port in your browser. |
| **GitHub Pages** | The standalone dashboard in each visitor’s browser | Share a website for public browser-compatible searches, external search links, citation imports and saved papers. |

## Put the files in a repository

1. Extract the ZIP on your computer. Locate the folder containing `index.html`, `package.json` and `field-atlas-server.cjs`.
2. Create a GitHub repository. One Windows option is to clone that repository with GitHub Desktop, copy **the contents** of the extracted folder into the clone, then select **Commit to** the default branch and **Push origin**. Include the folders named `.github` and `.devcontainer`.
3. Check the repository’s **Code** tab. Open `index.html`, `.github/workflows/pages.yml` and `.devcontainer/devcontainer.json` at their paths from the repository root. Commit the packaged configuration with its sample placeholders. Keep any personal credentials and private article exports outside the upload.

You can also use **Add file → Upload files** on GitHub. If your browser omits a dot-prefixed folder, choose **Add file → Create new file**, enter its full path from step 3 and paste the packaged file’s contents. The workflow uses the repository’s default branch, whatever its name.

## Run the search server in Codespaces

1. For any provider that requires credentials, add its exact environment variable name and your value under **GitHub account settings → Codespaces → New secret**. Grant the Field Atlas repository access to that secret. You can start with public sources and add keys later. [GitHub Codespaces secrets](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces)
2. In the repository select **Code → Codespaces → Create codespace on** the default branch. The included configuration supplies Node.js 22.
3. In the terminal at the repository root, run:

   ```sh
   npm start
   ```

   You can also run `node field-atlas-server.cjs` directly. Leave the process running while using the dashboard.

4. Open the **Ports** panel, locate **18776**, confirm its visibility is **Private**, then select **Open in Browser**. If the port is missing, select **Add Port**, enter `18776`, and open it. Use the forwarded address supplied by GitHub. GitHub’s forwarding service handles the browser connection to the server listening inside the codespace. [Port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)
5. After adding or changing secrets in an existing codespace, stop and restart the codespace, then run `npm start` again. When finished working, stop the codespace to end active compute usage. Your GitHub plan and organization policy determine Codespaces availability and billing. [GitHub Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces)

The provider still decides whether your key, subscription or network is authorized. Some institutional services require access from an approved network. In that case run the local launcher on the approved network or use the provider’s search and citation export.

## Publish the browser version with Pages

1. Open **Repository Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. GitHub Free supports Pages from a public repository. Private repository support depends on the paid plan. Check the intended publication audience before enabling Pages. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
2. In **Actions**, select **Publish Field Atlas → Run workflow**, choose the repository’s default branch and run it. Anyone setting this up must have the necessary repository permissions. If a previous run started before Pages was enabled, start a fresh run now.
3. Once both **prepare** and **deploy** succeed, select the published URL in the workflow’s deployment or **Settings → Pages → Visit site**. A normal project uses `https://OWNER.github.io/REPOSITORY/`. Later updates to the top-level `index.html` on the default branch trigger publication automatically. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

The workflow uploads the standalone `index.html`. The Codespaces or local launcher supplies the Node.js API service for sources requiring server-side access. On Pages, direct searches depend on each provider allowing browser requests from the site’s origin. For an unavailable provider use its dashboard search handoff, import its citations, or run the server in Codespaces. Keep provider keys in Codespaces secrets or in your local server environment.
