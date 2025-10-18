# 对冲数据 API 使用文档

## API 端点

```
POST https://distill.baa.one/api/hedge-data?token=YOUR_TOKEN
```

## 认证

使用查询参数 `token` 进行认证，token 值为你的 `WEBHOOK_SECRET` 环境变量。

## 请求格式

```json
{
  "data_points": [
    {
      "monitor_id": "jlp_hedge_SOL",
      "monitor_name": "JLP SOL 对冲量",
      "value": 123.456,
      "timestamp": "2025-10-17T12:00:00Z"
    },
    {
      "monitor_id": "alp_hedge_BTC",
      "monitor_name": "ALP BTC 对冲量",
      "value": 0.00123
    }
  ]
}
```

### 字段说明

- `monitor_id` (必需): 监控器 ID，建议格式：`jlp_hedge_SOL`, `alp_hedge_BTC` 等
- `monitor_name` (必需): 显示名称，如 "JLP SOL 对冲量"
- `value` (必需): 对冲量数值
- `timestamp` (可选): ISO 8601 格式时间戳，不提供则使用服务器当前时间

## 使用示例

### 1. 使用 curl

```bash
curl -X POST "https://distill.baa.one/api/hedge-data?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data_points": [
      {
        "monitor_id": "jlp_hedge_SOL",
        "monitor_name": "JLP SOL 对冲量",
        "value": 123.456
      },
      {
        "monitor_id": "jlp_hedge_BTC",
        "monitor_name": "JLP BTC 对冲量",
        "value": 0.00123
      }
    ]
  }'
```

### 2. 使用 Python requests

```python
import requests
from datetime import datetime

API_URL = "https://distill.baa.one/api/hedge-data"
TOKEN = "your_webhook_secret"

data = {
    "data_points": [
        {
            "monitor_id": "jlp_hedge_SOL",
            "monitor_name": "JLP SOL 对冲量",
            "value": 123.456,
            "timestamp": datetime.utcnow().isoformat() + 'Z'
        }
    ]
}

response = requests.post(
    f"{API_URL}?token={TOKEN}",
    json=data
)

print(response.json())
```

### 3. 集成到现有计算脚本

如果你已经有 JLP/ALP 计算脚本（比如 xLP 项目的 alp.py），可以这样集成：

```python
#!/usr/bin/env python3
import asyncio
import requests
from datetime import datetime

# 导入你的计算函数
from alp import calculate_hedge  # 从 xLP 项目导入

API_URL = "https://distill.baa.one/api/hedge-data"
TOKEN = "your_token_here"

async def main():
    # 计算 ALP 对冲量
    alp_amount = 5000.0
    hedge_positions = await calculate_hedge(alp_amount)

    # 转换为 API 格式
    data_points = []
    timestamp = datetime.utcnow().isoformat() + 'Z'

    for symbol, data in hedge_positions.items():
        display_symbol = "BTC" if symbol == "WBTC" else symbol

        data_points.append({
            "monitor_id": f"alp_hedge_{display_symbol}",
            "monitor_name": f"ALP {display_symbol} 对冲量",
            "value": data['amount'],
            "timestamp": timestamp
        })

    # 发送到服务器
    response = requests.post(
        f"{API_URL}?token={TOKEN}",
        json={"data_points": data_points}
    )

    if response.status_code == 200:
        print(f"✓ 成功: {response.json()}")
    else:
        print(f"✗ 失败: {response.text}")

if __name__ == "__main__":
    asyncio.run(main())
```

### 4. 使用 crontab 定时发送

在东京服务器上设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 每分钟运行一次
* * * * * cd /path/to/your/script && python3 send_hedge_data.py >> /var/log/hedge_sender.log 2>&1

# 或者每 5 分钟运行一次
*/5 * * * * cd /path/to/your/script && python3 send_hedge_data.py >> /var/log/hedge_sender.log 2>&1
```

## 响应格式

### 成功响应 (200 OK)

```json
{
  "status": "success",
  "message": "Stored 3 data points",
  "received_at": "2025-10-17T12:00:00.123456"
}
```

### 错误响应

**认证失败 (403)**
```json
{
  "detail": "Invalid or missing token"
}
```

**数据格式错误 (422)**
```json
{
  "detail": [
    {
      "loc": ["body", "data_points", 0, "value"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## 注意事项

1. **延迟问题**: 由于在东京运行，建议使用 HTTP keepalive 连接减少延迟
2. **重试机制**: 建议实现重试逻辑，处理网络临时故障
3. **批量发送**: 可以一次发送多个数据点（JLP + ALP），减少请求次数
4. **时间戳**: 建议使用计算时的时间戳，而不是发送时的时间戳

## 监控器 ID 命名规范

建议使用以下格式：

- JLP 对冲: `jlp_hedge_SOL`, `jlp_hedge_ETH`, `jlp_hedge_BTC`
- ALP 对冲: `alp_hedge_SOL`, `alp_hedge_BONK`, `alp_hedge_BTC`

这样数据会自动显示在现有的监控面板中。
