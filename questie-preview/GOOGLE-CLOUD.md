# Google Cloud Run deployment (Questie preview only)

The existing root Dockerfile runs the full OpenRive editor. For the separate Questie preview use Dockerfile.questie, with the repository root as build context. No database, Gemini API key, or original voice files are required. Voice files stay in the browser after local selection.

## Google AI Studio
Open https://aistudio.google.com/apps and import the repository from GitHub. Select questie-rive-v4 if branch selection is offered. If only main can be imported, do not overwrite main: use Cloud Run direct from GitHub instead. In the AI Studio workspace, preserve native exports and use the exact build command bun install --frozen-lockfile followed by bun run scripts/build-questie-guides.ts, serving questie-site. If AI Studio cannot run Bun or the existing project layout, use the direct Cloud Run path below. Publish a separate app only after the preview and CI pass.

## Cloud Run direct from GitHub
Create a NEW service named questie-native-rive in a dedicated Google Cloud project with billing as required. Choose continuous deployment from repository via Cloud Build; connect mfordmtgLO/OpenRive; use the exact branch regex ^questie-rive-v4$; build type Dockerfile; source location Dockerfile.questie; container port 8080. Request public access only for the preview. Keep minimum instances zero and select a low maximum instance count to limit cost. The console returns the actual URL. Do not attach production FTHB resources or copy private recordings into the container.

## Local container smoke check
From repository root:
    docker build -f Dockerfile.questie -t questie-preview .
    docker run --rm -p 8080:8080 questie-preview
Open http://localhost:8080/ and /healthz. Test the Pin and Geo switches and original local voice import. Container build and cloud deployment still require verification; the source exporter CI is separate.
