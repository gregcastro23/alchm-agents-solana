import json
import os
import subprocess
import sys
import pytest
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

class MockBackendHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress logging to keep pytest output clean
        return

    def do_POST(self):
        if self.path == "/api/chat":
            response = {
                "agentName": "Socrates",
                "agentId": "socrates",
                "text": "Subprocess stdio response successful.",
                "sessionId": "mcp-socrates"
            }
            encoded_response = json.dumps(response).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(encoded_response)))
            self.end_headers()
            self.wfile.write(encoded_response)
        else:
            self.send_response(404)
            self.end_headers()

@pytest.fixture(scope="module")
def mock_backend_server():
    server = HTTPServer(('127.0.0.1', 0), MockBackendHandler)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()
    server.server_close()

@pytest.mark.skipif(
    os.getenv("PA_MCP_E2E") != "1",
    reason="PA_MCP_E2E=1 env var not set; skipping stdio integration test"
)
def test_mcp_stdio_roundtrip(mock_backend_server):
    # Prepare environment variables for the subprocess
    env = dict(os.environ)
    env["PLANETARY_AGENTS_BACKEND_URL"] = mock_backend_server
    env["ALCHM_MCP_ENABLED"] = "false"
    # Set SQLite fallback to true so we don't need real Postgres DSN for standard sqlite operations in the subprocess
    env["ALLOW_SQLITE_FALLBACK"] = "true"

    # Spawn planetary_agents_mcp_server.py as a subprocess speaking stdio
    # We run using the same python executable running the tests
    server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "planetary_agents_mcp_server.py"))
    proc = subprocess.Popen(
        [sys.executable, server_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=sys.stderr,
        text=True,
        bufsize=1,
        env=env
    )

    try:
        # Helper to send a JSON-RPC request and wait for a response
        def send_request(method, params=None, req_id=1):
            req = {
                "jsonrpc": "2.0",
                "id": req_id,
                "method": method
            }
            if params is not None:
                req["params"] = params
            
            proc.stdin.write(json.dumps(req) + "\n")
            proc.stdin.flush()
            
            line = proc.stdout.readline()
            return json.loads(line.strip())

        # 1. Speak initialize
        init_res = send_request("initialize", req_id=101)
        assert init_res["id"] == 101
        assert "result" in init_res
        assert init_res["result"]["serverInfo"]["name"] == "planetary-agents-mcp-server"

        # 2. Speak tools/list
        list_res = send_request("tools/list", req_id=102)
        assert list_res["id"] == 102
        tools = list_res["result"]["tools"]
        assert any(t["name"] == "chat_with_planetary_agent" for t in tools)

        # 3. Call chat_with_planetary_agent tool call
        call_res = send_request("tools/call", {
            "name": "chat_with_planetary_agent",
            "arguments": {
                "agentName": "Socrates",
                "message": "Hello from stdio test!",
                "modelTier": "free"
            }
        }, req_id=103)

        assert call_res["id"] == 103
        assert "result" in call_res
        
        # Check tool response text
        content = call_res["result"]["content"][0]["text"]
        payload = json.loads(content)
        print("DEBUG MCP STDIO PAYLOAD:", payload)
        assert "Subprocess stdio response successful" in payload.get("text", "")

    finally:
        # Gracefully shut down the subprocess
        proc.terminate()
        try:
            proc.wait(timeout=2.0)
        except subprocess.TimeoutExpired:
            proc.kill()
