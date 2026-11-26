from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser


class PreviewHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".riv": "application/octet-stream",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parent), **kwargs)


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 0), PreviewHandler) as server:
        host, port = server.server_address[:2]
        url = "http://{}:{}/".format(host, port)
        print("Preview: {} (press Ctrl+C to stop)".format(url), flush=True)
        if "--no-browser" not in sys.argv[1:]:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nPreview server stopped.", flush=True)
