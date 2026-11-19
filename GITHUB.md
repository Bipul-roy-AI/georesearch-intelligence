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

The shared dashboard runs on the `gh-pages` branch of [Bipul-roy-AI/georesearch-intelligence](https://github.com/Bipul-roy-AI/georesearch-intelligence). Open [Field Atlas](https://bipul-roy-ai.github.io/georesearch-intelligence/) to use it.

The `Publish Field Atlas` workflow rebuilds and tests changes to the dashboard on the default branch. It copies the generated `index.html` to `gh-pages`, keeps the `.nojekyll` file, and requests a Pages build. To rerun it, open **Actions**, select **Publish Field Atlas**, and click **Run workflow**. GitHub also lists the resulting **pages build and deployment** run.

For a new repository, push the source files to its default branch. Create a separate branch named `gh-pages` with the packaged `index.html` and an empty `.nojekyll` file at its root. In **Settings → Pages**, choose **Deploy from a branch**, select **gh-pages** and **/(root)**, then save. Enable Actions in that repository and run **Publish Field Atlas**. Open the published URL under **Settings → Pages**. [GitHub Pages configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

The local launcher and Codespaces provide the Node.js service. On Pages, each provider must allow browser requests from the site's origin. For an unavailable provider, open its search link, import its citations, or use the private server. Keep credentials in Codespaces secrets or your local environment.
