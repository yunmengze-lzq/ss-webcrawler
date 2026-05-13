"""
通用 SQL 执行器
依赖：仅 Python 标准库

支持三种模式：
  query  → SELECT，返回 rows 数组
  run    → INSERT/UPDATE/DELETE，返回 affected
  batch  → 事务批量写入，返回 count
"""
import sys, json, sqlite3

def main():
    params = json.loads(sys.stdin.read().strip() or '{}')
    db_path = params.get('db_path')
    mode    = params.get('mode', 'query')
    sql     = params.get('sql', '')
    p       = params.get('params', [])
    rows    = params.get('rows', [])

    if not db_path or not sql:
        print(json.dumps({'error': 'db_path 和 sql 必填'})); return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        if mode == 'query':
            cur = conn.execute(sql, p)
            data = [dict(r) for r in cur.fetchall()]
            print(json.dumps({'ok': True, 'rows': data, 'count': len(data)},
                             ensure_ascii=False))

        elif mode == 'run':
            cur = conn.execute(sql, p)
            conn.commit()
            print(json.dumps({'ok': True, 'affected': cur.rowcount}))

        elif mode == 'batch':
            cur = conn.executemany(sql, rows)
            conn.commit()
            print(json.dumps({'ok': True, 'count': cur.rowcount}))

    except Exception as e:
        conn.rollback()
        print(json.dumps({'error': str(e)}))
    finally:
        conn.close()

if __name__ == '__main__':
    main()
