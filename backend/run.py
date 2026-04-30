import pysqlite3
import sys

sys.modules["sqlite3"] = pysqlite3

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8003,
        reload=True
    )