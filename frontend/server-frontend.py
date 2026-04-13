import http.server
import socketserver
import os
from pathlib import Path

PORT = 8080
FRONTEND_DIR = Path(__file__).parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, format, *args):
        pass

os.chdir(FRONTEND_DIR)
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()