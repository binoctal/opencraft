#!/usr/bin/env python3
"""Query cccmemory decisions for a given project path."""

import sqlite3
import json
import sys
import os

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: query_decisions.py <db_path> <project_path>"}))
        sys.exit(1)

    db_path = sys.argv[1]
    project_path = sys.argv[2]
    max_decisions = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    if not os.path.exists(db_path):
        print(json.dumps({"error": f"Database not found: {db_path}"}))
        sys.exit(1)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        # Get project_id for current path
        cursor = conn.execute(
            "SELECT id FROM projects WHERE canonical_path = ?",
            (project_path,)
        )
        project = cursor.fetchone()

        if not project:
            print(json.dumps([]))
            sys.exit(0)

        project_id = project["id"]

        # Get recent decisions for this project
        cursor = conn.execute("""
            SELECT d.decision_text, d.rationale, d.timestamp
            FROM decisions d
            JOIN conversations c ON d.conversation_id = c.id
            WHERE c.project_id = ?
            ORDER BY d.timestamp DESC
            LIMIT ?
        """, (project_id, max_decisions))

        results = [dict(row) for row in cursor.fetchall()]
        print(json.dumps(results, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
