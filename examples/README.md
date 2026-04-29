# 测试脚本（给定时任务运行器用）

这些脚本用于验证：

- 选择不同的 Python 解释器（如 `uv` 创建的 `.venv\\Scripts\\python.exe`）是否生效
- stdout / stderr 日志采集是否正常
- 退出码是否正确记录
- `cwd` / 参数传递是否正确

## 脚本列表

- `examples/scripts/01_hello.py`：打印时间、cwd、解释器路径、argv（成功退出）
- `examples/scripts/02_fail.py`：向 stderr 输出并以退出码 2 结束（失败退出）
- `examples/scripts/03_write_artifact.py`：写入一个 json 文件到 `examples/output/`（验证写文件权限与 cwd/参数）
- `examples/scripts/04_http_request.py`：发起 HTTP 请求（依赖 `httpx`）

---

# Test scripts (for the task runner)

These scripts are used to verify:

- Selecting a specific Python interpreter (e.g. `.venv\\Scripts\\python.exe` created by `uv`)
- stdout / stderr log capture
- Exit code recording
- Correct `cwd` and argument passing

## Script list

- `examples/scripts/01_hello.py`: prints time, cwd, interpreter path, argv (success)
- `examples/scripts/02_fail.py`: writes to stderr and exits with code 2 (failure)
- `examples/scripts/03_write_artifact.py`: writes a JSON file to `examples/output/` (checks write permission and cwd/args)
- `examples/scripts/04_http_request.py`: makes an HTTP request (requires `httpx`)

