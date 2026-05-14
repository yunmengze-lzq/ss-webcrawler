import json
import re
import sqlite3
import sys
from pathlib import Path


def ident(value: str) -> str:
    cleaned = re.sub(r"[^\w]", "_", value or "", flags=re.UNICODE)
    cleaned = cleaned.strip("_")
    if not cleaned:
        raise ValueError("数据库表名或字段名为空")
    if cleaned[0].isdigit():
        cleaned = f"f_{cleaned}"
    return cleaned


def normalize_value(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def main():
    params = json.loads(sys.stdin.read() or "{}")
    rows = params.get("rows") or []
    db_path = params.get("db_path")
    table_name = ident(params.get("table_name") or "crawler_rows")
    primary_key = ident(params.get("primary_key") or "")
    mode = params.get("write_mode") or "append"

    if not db_path:
        raise ValueError("db_path 不能为空")

    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    columns = []
    column_sources = {}
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        for key in row.keys():
            col = ident(str(key))
            if col not in seen:
                columns.append(col)
                column_sources[col] = key
                seen.add(col)

    if not columns:
        print(json.dumps({"db_path": db_path, "table": table_name, "count": 0}, ensure_ascii=False))
        return

    if primary_key and primary_key not in columns:
        columns.insert(0, primary_key)

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        if mode == "overwrite":
            cur.execute(f'DROP TABLE IF EXISTS "{table_name}"')

        column_defs = []
        for col in columns:
            suffix = " PRIMARY KEY" if primary_key and col == primary_key else ""
            column_defs.append(f'"{col}" TEXT{suffix}')
        cur.execute(f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(column_defs)})')

        existing_cols = {row[1] for row in cur.execute(f'PRAGMA table_info("{table_name}")').fetchall()}
        for col in columns:
            if col not in existing_cols:
                cur.execute(f'ALTER TABLE "{table_name}" ADD COLUMN "{col}" TEXT')

        placeholders = ", ".join(["?"] * len(columns))
        column_sql = ", ".join([f'"{col}"' for col in columns])

        affected = 0
        for row in rows:
            values = [
                normalize_value(row.get(column_sources.get(col, col))) if isinstance(row, dict) else None
                for col in columns
            ]
            if mode == "upsert" and primary_key:
                update_cols = [col for col in columns if col != primary_key]
                update_sql = ", ".join([f'"{col}"=excluded."{col}"' for col in update_cols])
                cur.execute(
                    f'INSERT INTO "{table_name}" ({column_sql}) VALUES ({placeholders}) '
                    f'ON CONFLICT("{primary_key}") DO UPDATE SET {update_sql}',
                    values,
                )
            else:
                cur.execute(f'INSERT INTO "{table_name}" ({column_sql}) VALUES ({placeholders})', values)
            affected += 1

        conn.commit()
        print(json.dumps({
            "db_path": db_path,
            "table": table_name,
            "count": affected,
            "mode": mode,
        }, ensure_ascii=False))
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
