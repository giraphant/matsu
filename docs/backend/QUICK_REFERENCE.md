# 快速参考指南 - Repository & Service 层

## 🎯 何时使用什么？

### 在 API 端点中使用 Repository
**场景**: 简单的 CRUD 操作，不需要复杂业务逻辑

```python
from app.repositories.monitoring import MonitoringRepository

@router.get("/data/{monitor_id}")
async def get_data(monitor_id: str):
    db = get_db_session()
    try:
        repo = MonitoringRepository(db)
        records = repo.get_by_monitor_id(monitor_id, limit=100)
        return records
    finally:
        db.close()
```

### 在 API 端点中使用 Service
**场景**: 需要业务逻辑、多个 Repository 协调、告警检查等

```python
from app.services.monitoring import MonitoringService

@router.post("/webhook/distill")
async def process_webhook(payload: DistillWebhookPayload):
    db = get_db_session()
    try:
        service = MonitoringService(db)
        # Service 会处理：解析、保存、告警、通知
        data = service.process_webhook(payload)
        return {"status": "success"}
    finally:
        db.close()
```

---

## 📚 Repository 速查

### MonitoringRepository
```python
from app.repositories.monitoring import MonitoringRepository

repo = MonitoringRepository(db)

# 常用方法
repo.get_by_id(data_id)                    # 按 ID 获取
repo.get_by_monitor_id(monitor_id)         # 获取监控数据
repo.get_latest(monitor_id)                # 获取最新记录
repo.get_summary_statistics(monitor_id)    # 获取统计摘要
repo.get_all_monitors_summary()            # 获取所有监控摘要
repo.create(data)                          # 创建记录
```

### AlertRepository
```python
from app.repositories.alert import AlertRepository

repo = AlertRepository(db)

repo.get_by_monitor_id(monitor_id)  # 获取告警配置
repo.get_all()                       # 获取所有配置
repo.create(alert_config)            # 创建配置
repo.update(monitor_id, **kwargs)    # 更新配置
```

### PushoverRepository
```python
from app.repositories.pushover import PushoverRepository

repo = PushoverRepository(db)

repo.get_config()                    # 获取配置 (单例)
repo.create_or_update(user_key, api_token)  # 创建或更新
repo.is_configured()                 # 检查是否已配置
```

---

## 🎨 Service 速查

### MonitoringService
```python
from app.services.monitoring import MonitoringService

service = MonitoringService(db)

# 主要方法
service.process_webhook(payload)           # 处理 webhook (完整流程)
service.get_monitor_summary(monitor_id)    # 获取监控摘要 (含业务逻辑)
service.get_all_monitors_summary()         # 获取所有监控摘要
```

### PushoverService
```python
from app.services.pushover import PushoverService

service = PushoverService(db)

service.send_alert(message, title, level, url)  # 发送告警
service.is_configured()                          # 检查配置
```

---

## 💡 常见模式

### 模式 1: 简单数据查询
```python
@router.get("/monitors")
async def get_monitors():
    db = get_db_session()
    try:
        repo = MonitoringRepository(db)
        summaries = repo.get_all_monitors_summary()
        return summaries
    finally:
        db.close()
```

### 模式 2: 带业务逻辑的查询
```python
@router.get("/monitors/status")
async def get_monitors_with_status():
    db = get_db_session()
    try:
        service = MonitoringService(db)
        # Service 会添加 status 字段 (active/stale/no_data)
        summaries = service.get_all_monitors_summary()
        return summaries
    finally:
        db.close()
```

### 模式 3: 创建或更新数据
```python
@router.post("/data")
async def create_data(data: DataCreate):
    db = get_db_session()
    try:
        repo = MonitoringRepository(db)

        new_data = MonitoringData(**data.dict())
        created = repo.create(new_data)

        return {"id": created.id}
    finally:
        db.close()
```

### 模式 4: 复杂业务流程
```python
@router.post("/webhook")
async def process_webhook(payload: WebhookPayload):
    db = get_db_session()
    try:
        service = MonitoringService(db)

        # Service 处理：
        # 1. 解析数据
        # 2. 保存到数据库
        # 3. 检查告警条件
        # 4. 发送通知
        result = service.process_webhook(payload)

        return {"status": "success"}
    finally:
        db.close()
```

---

## 🔧 添加新功能

### 添加新的 Repository

1. **创建文件**: `app/repositories/your_model.py`

```python
from sqlalchemy.orm import Session
from app.models.database import YourModel

class YourModelRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: int):
        return self.db.query(YourModel).filter(YourModel.id == id).first()

    # 添加更多方法...
```

2. **导出**: 在 `app/repositories/__init__.py` 添加：

```python
from .your_model import YourModelRepository

__all__ = [
    # ... 其他
    "YourModelRepository"
]
```

### 添加新的 Service

1. **创建文件**: `app/services/your_feature.py`

```python
from sqlalchemy.orm import Session
from app.repositories.your_model import YourModelRepository

class YourFeatureService:
    def __init__(self, db: Session):
        self.db = db
        self.your_repo = YourModelRepository(db)

    def process_something(self, data):
        # 业务逻辑
        result = self.your_repo.get_by_id(data.id)
        # 更多处理...
        return result
```

2. **导出**: 在 `app/services/__init__.py` 添加：

```python
from .your_feature import YourFeatureService

__all__ = [
    # ... 其他
    "YourFeatureService"
]
```

3. **在 API 中使用**:

```python
from app.services.your_feature import YourFeatureService

@router.post("/your-endpoint")
async def your_endpoint(data: YourData):
    db = get_db_session()
    try:
        service = YourFeatureService(db)
        result = service.process_something(data)
        return result
    finally:
        db.close()
```

---

## ✅ 最佳实践

### DO ✅

1. **API 层只做 HTTP 相关的事情**
   - 参数验证
   - 调用 Service 或 Repository
   - 返回 HTTP 响应

2. **Service 层处理业务逻辑**
   - 协调多个 Repository
   - 实现业务规则
   - 处理事务

3. **Repository 层只做数据访问**
   - SQL 查询
   - CRUD 操作
   - 不包含业务逻辑

4. **使用类型提示**
   ```python
   def get_by_id(self, id: int) -> Optional[Model]:
       ...
   ```

5. **添加文档字符串**
   ```python
   def get_summary(self, monitor_id: str) -> Dict[str, Any]:
       """
       Get summary statistics for a monitor.

       Args:
           monitor_id: Monitor identifier

       Returns:
           Dictionary with statistics
       """
   ```

### DON'T ❌

1. **不要在 API 层写业务逻辑**
   ```python
   # ❌ 错误
   @router.post("/webhook")
   async def webhook(payload):
       # 直接写大量业务逻辑
       if payload.value > threshold:
           # 发送通知
           # 记录告警
           # ...
   ```

2. **不要在 Repository 中写业务逻辑**
   ```python
   # ❌ 错误
   class MonitoringRepository:
       def get_data_and_check_alerts(self, monitor_id):
           data = self.db.query(...)
           # 不要在这里检查告警！
           if data.value > threshold:
               send_alert()
   ```

3. **不要直接在 API 层写 SQL**
   ```python
   # ❌ 错误
   @router.get("/data")
   async def get_data():
       db = get_db_session()
       results = db.query(MonitoringData).filter(...).all()
   ```

---

## 🎯 决策树

```
需要访问数据库?
  ├─ 是 → 简单 CRUD?
  │     ├─ 是 → 使用 Repository
  │     └─ 否 → 需要业务逻辑?
  │           ├─ 是 → 使用 Service
  │           └─ 否 → 使用 Repository
  └─ 否 → 直接在 API 中处理
```

---

## 📝 总结

- **Repository**: 数据访问，SQL 查询
- **Service**: 业务逻辑，多 Repo 协调
- **API**: HTTP 处理，调用 Service/Repository

保持这个原则，你的代码会：
- ✅ 清晰易懂
- ✅ 易于测试
- ✅ 易于维护
- ✅ 易于扩展
