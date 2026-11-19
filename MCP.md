# Research app connections

Field Atlas can run metadata searches through a connected Article Galaxy or Undermind account. Start these OAuth connections on the computer where you will complete the browser sign-in. The other indexes and citation imports work independently.

## Article Galaxy

1. Open a terminal in the extracted folder. If the dashboard server is already running, stop it with **Ctrl+C** before starting the OAuth-enabled server.
2. With Node.js 22 or newer and npm installed, install the two optional local packages.

   ~~~sh
   npm install --no-save --package-lock=false mcp-remote@0.16.6 @modelcontextprotocol/sdk@1.32.2
   ~~~

3. Start the connection, sign in with your Article Galaxy account, and approve access in the browser.

   ~~~sh
   node mcp-search.cjs connect "Article Galaxy"
   ~~~

4. Open the dashboard address printed by the launcher. In **Sources**, select **Article Galaxy**, then search in **Explore**. Leave the terminal running. Subsequent sessions start with the same command.

Field Atlas calls the literature search operation for metadata and opens an article link when Article Galaxy identifies it as publicly accessible. A provider login link, institutional entitlement or purchasable PDF does not qualify as a public copy. The client has no ordering command.

Research Solutions provides the connection details and account requirements. [Article Galaxy MCP setup guide](https://help.researchsolutions.com/hc/en-us/articles/48473499012116-Article-Galaxy-MCP)

## Undermind

Undermind uses an individual account and a workspace. Each installation needs its own OAuth client identification. Choose one of these routes.

- Ask Undermind to register **Field Atlas** as a public client with callback URL **http://127.0.0.1:18444/oauth/callback**. Set the client ID they issue as **UNDERMIND_CLIENT_ID** in your local environment.
- Alternatively, publish a public **client metadata JSON document** under an HTTPS URL that you control. Set **UNDERMIND_CLIENT_ID** to the exact document URL. Its **client_id** must match that URL. Include the callback URL above. An example document follows.

~~~json
{
  "client_id": "https://YOUR-DOMAIN.example/field-atlas-client.json",
  "client_name": "Field Atlas",
  "redirect_uris": ["http://127.0.0.1:18444/oauth/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp"
}
~~~

Use Node 22+, install the same two packages listed above, and run the following in the extracted folder.

~~~sh
node mcp-search.cjs connect "Undermind"
~~~

Sign in to Undermind and choose an existing workspace if prompted. To remember your choice, set **UNDERMIND_WORKSPACE_ID** to a UUID listed by your account. The launcher also reads these settings from a local **.env** file. Keep the terminal open and select **Undermind** in the dashboard. Enter a descriptive topic or a research question. Field Atlas uses semantic search and a second metadata lookup to identify the journal DOI. This search can surface papers in your Undermind workspace. Deep research runs, orders, uploads and PDF retrieval are outside this connector.

You can connect both services before starting the dashboard.

~~~sh
node mcp-search.cjs connect "Article Galaxy" "Undermind"
~~~

Official documentation: [Undermind integration reference](https://www.undermind.ai/mcp/reference) · [OAuth bridge](https://github.com/punkpeye/mcp-remote).

## Browser and GitHub options

The OAuth callback returns to the local machine. Local execution is the supported path for this bridge. GitHub Pages serves the static dashboard and cannot run the bridge. Codespaces can run the other server-side API searches. Completing these optional MCP logins in a remote container additionally requires access to the appropriate callback through your local browser. This package does not configure remote OAuth forwarding.

The bridge stores its OAuth cache under your home directory in **.field-atlas/oauth/**. Each service has a separate directory. The server sends only normalized citation records and public access links to the dashboard. Stop the local process to disconnect the current session; revoke persistent authorization in the provider account settings.

## SciSpace and connected-app search

SciSpace distributes its research MCP through its ChatGPT and Claude directories. Open your connected SciSpace tool and ask the following, replacing the example topic with your own.

> Find published journal articles on Chattogram urban heat exposure and geospatial public health. Include subscription journals. Return citation metadata as CSL-JSON journal articles, with each title, journal, year, authors and DOI when available.

Use the dashboard’s citation import and select **SciSpace** as the source. This route also works for an existing Undermind or Article Galaxy session when you prefer to keep sign-in inside the connected app. For Article Galaxy, request citation metadata only.

Official entry points: [SciSpace for ChatGPT and Claude](https://scispace.com/guides/mcp) · [Undermind connections](https://www.undermind.ai/mcp) · [Article Galaxy connections](https://www.researchsolutions.com/article-galaxy-mcp).

## Consensus and Zotero

**Consensus** uses **CONSENSUS_API_KEY** for REST searches. Each request draws on the account’s API quota. Access to additional pages depends on your plan. Field Atlas retrieves bibliographic metadata, checks DOI-bearing results against Crossref journal records and omits full-text excerpts. [API and key](https://docs.consensus.app/api-plans-and-access)

**Zotero** searches one configured Web library. Set **ZOTERO_LIBRARY_TYPE** to **users** or **groups** and **ZOTERO_LIBRARY_ID** to its numeric ID. Public libraries support anonymous reads. For a private library, set **ZOTERO_API_KEY** to a read-only key scoped to it. The web API quick search works best with a title phrase or author. The dashboard also accepts a Zotero citation export in the browser. [Web API documentation](https://www.zotero.org/support/dev/web_api/v3/basics)
