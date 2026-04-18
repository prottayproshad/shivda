#!/usr/bin/env python3
"""
Admin backend: saves the current page by replacing <body> inner HTML (from the browser).
"""
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
import os
import shutil

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).parent.resolve()


def safe_page_path(name: str) -> Optional[Path]:
    if not name or not isinstance(name, str):
        return None
    if "/" in name or "\\" in name or ".." in name:
        return None
    candidate = (BASE_DIR / name).resolve()
    if candidate.parent != BASE_DIR:
        return None
    if candidate.suffix.lower() != ".html":
        return None
    return candidate


@app.route("/api/save-page", methods=["POST"])
def save_page():
    try:
        data = request.get_json(force=True, silent=True) or {}
        page_file = data.get("file", "index.html")
        body_html = data.get("bodyHtml")
        changes = data.get("changes")

        expected_user = os.environ.get("EDITOR_USER")
        expected_pass = os.environ.get("EDITOR_PASS")
        if expected_user:
            if (
                data.get("username") != expected_user
                or data.get("password") != expected_pass
            ):
                return jsonify({"error": "Unauthorized"}), 401

        page_path = safe_page_path(page_file)
        if page_path is None:
            return jsonify({"error": "Invalid or disallowed file name"}), 403
        if not page_path.exists():
            return jsonify({"error": "File not found"}), 404

        backup_path = page_path.with_suffix(".html.bak")
        shutil.copy2(page_path, backup_path)

        with open(page_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()

        soup = BeautifulSoup(raw, "html.parser")
        body = soup.find("body")
        if not body:
            return jsonify({"error": "No <body> in file"}), 400

        if body_html is not None:
            attrs = dict(body.attrs)
            frag = BeautifulSoup(body_html, "html.parser")
            inner = frag.find("body")
            nodes = list(inner.contents) if inner else list(frag.contents)
            for child in list(body.contents):
                child.extract()
            for node in nodes:
                body.append(node)
            body.attrs.clear()
            body.attrs.update(attrs)
        elif changes:
            for change in changes:
                el_id = change.get("id")
                ctype = change.get("type")
                new_value = change.get("value")
                el = soup.find(attrs={"data-editable-id": el_id})
                if el and ctype == "text":
                    el.clear()
                    el.append(new_value)
                elif el and ctype == "image":
                    el["src"] = new_value
                    if "alt" in change:
                        el["alt"] = change["alt"]
        else:
            return jsonify({"error": "Provide bodyHtml or changes"}), 400

        with open(page_path, "w", encoding="utf-8") as f:
            f.write(str(soup))

        return jsonify(
            {
                "success": True,
                "message": f"{page_file} updated",
                "backup": str(backup_path),
            }
        )
    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    return jsonify({"status": "ok"})


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        return response


if __name__ == "__main__":
    print("Starting Simple Admin Backend…")
    print("Allowed saves: any *.html in this folder (body replacement).")
    app.run(debug=True, port=5000, host="localhost")
