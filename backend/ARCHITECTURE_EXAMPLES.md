# 架构模式示例

## 1. Repository Pattern (仓储模式)

### ❌ 之前 - API 直接操作数据库

```python
# app/api/data.py
@router.get("/data")
async def get_monitoring_data(monitor_id: str):
    db = get_db_session()
    try:
        # API 层需要知道数据库查询细节
        query = db.query(MonitoringData)
        query = query.filter(MonitoringData.monitor_id == monitor_id)
        query = query.order_by(MonitoringData.timestamp.desc())
        results = query.limit(100).all()
        return results
    finally:
        db.close()
```

**问题：**
- API 层需要知道 SQL 查询细节
- 相同查询逻辑在多处重复
- 难以测试（需要真实数据库）
- 数据库变更影响多个 API 文件

### ✅ 之后 - 使用 Repository Pattern

```python
# app/api/data.py
from app.repositories import MonitoringRepository

@router.get("/data")
async def get_monitoring_data(monitor_id: str):
    db = get_db_session()
    repo = MonitoringRepository(db)

    # 简单、清晰、可测试
    return repo.get_by_monitor_id(monitor_id, limit=100)
```

**优势：**
- ✅ API 层不需要知道 SQL 细节
- ✅ 查询逻辑集中在 Repository
- ✅ 易于 Mock 测试
- ✅ 数据库变更只影响 Repository

### 📊 对比示例：获取监控摘要

#### ❌ 没有 Repository
```python
# 在 API 中直接写复杂查询 - 难以维护
@router.get("/monitors/summary")
async def get_summary(monitor_id: str):
    db = get_db_session()
    try:
        stats = db.query(
            func.count(MonitoringData.id).label('total'),
            func.min(MonitoringData.value).label('min'),
            func.max(MonitoringData.value).label('max'),
            func.avg(MonitoringData.value).label('avg')
        ).filter(
            MonitoringData.monitor_id == monitor_id
        ).first()

        latest = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        ).order_by(desc(MonitoringData.timestamp)).first()

        # 还要手动组装数据...
        return {
            'total': stats.total,
            'min': stats.min,
            # ...更多字段
        }
    finally:
        db.close()
```

#### ✅ 使用 Repository
```python
# 简洁优雅 - 易于维护
@router.get("/monitors/summary")
async def get_summary(monitor_id: str):
    db = get_db_session()
    repo = MonitoringRepository(db)

    # 一行搞定！
    return repo.get_summary_statistics(monitor_id)
```

---

## 2. Service Layer (服务层)

### 📖 什么是 Service Layer？

Service Layer 是**业务逻辑层**，位于 API 和 Repository 之间。它协调多个 Repository，实现复杂的业务逻辑。

### 架构层次

```
┌─────────────────┐
│   API Layer     │  ← 处理 HTTP 请求/响应
│  (data.py)      │
└────────┬────────┘
         │ 调用
┌────────▼────────┐
│  Service Layer  │  ← 业务逻辑、协调多个 repo
│ (monitoring.py) │
└────────┬────────┘
         │ 调用
┌────────▼────────┐
│  Repository     │  ← 数据访问、SQL 查询
│  (monitoring.py)│
└────────┬────────┘
         │
┌────────▼────────┐
│    Database     │
└─────────────────┘
```

### 示例：创建监控数据并发送通知

#### ❌ 没有 Service Layer - API 层太复杂

```python
# app/api/webhook.py - 所有业务逻辑都在 API 层
@router.post("/webhook/distill")
async def receive_webhook(payload: DistillWebhookPayload):
    db = get_db_session()

    try:
        # 1. 解析数据
        value = float(payload.text) if payload.text.replace('.', '').isdigit() else None

        # 2. 创建记录
        data = MonitoringData(
            monitor_id=payload.id,
            monitor_name=payload.name,
            url=payload.uri,
            value=value,
            timestamp=datetime.utcnow()
        )
        db.add(data)
        db.commit()

        # 3. 检查告警
        alert_config = db.query(AlertConfig).filter(
            AlertConfig.monitor_id == payload.id
        ).first()

        if alert_config:
            if value > alert_config.upper_threshold:
                # 4. 发送通知
                pushover = db.query(PushoverConfig).first()
                if pushover:
                    send_pushover_notification(
                        user_key=pushover.user_key,
                        message=f"Value {value} exceeds threshold!",
                        title="Alert"
                    )

                    # 5. 记录告警状态
                    alert_state = AlertState(
                        monitor_id=payload.id,
                        alert_level=alert_config.alert_level,
                        triggered_at=datetime.utcnow()
                    )
                    db.add(alert_state)
                    db.commit()

        return {"status": "success"}
    finally:
        db.close()
```

**问题：**
- API 层包含太多业务逻辑
- 难以测试
- 难以复用
- 职责不清晰

#### ✅ 使用 Service Layer - 清晰分离

```python
# app/services/monitoring.py - 业务逻辑层
class MonitoringService:
    """监控数据业务逻辑服务"""

    def __init__(self, db: Session):
        self.db = db
        self.monitoring_repo = MonitoringRepository(db)
        self.alert_repo = AlertRepository(db)
        self.pushover_service = PushoverService(db)

    def process_webhook(self, payload: DistillWebhookPayload) -> MonitoringData:
        """
        处理 webhook 数据并执行所有业务逻辑

        业务流程：
        1. 解析并创建监控数据
        2. 检查是否需要告警
        3. 发送通知（如果需要）
        4. 记录告警状态
        """
        # 1. 解析并创建数据
        data = self._parse_and_create_data(payload)

        # 2. 检查告警
        self._check_and_trigger_alerts(data)

        return data

    def _parse_and_create_data(self, payload: DistillWebhookPayload) -> MonitoringData:
        """解析 webhook 并创建数据记录"""
        value = self._parse_value(payload.text)

        data = MonitoringData(
            monitor_id=payload.id,
            monitor_name=payload.name,
            url=payload.uri,
            value=value,
            timestamp=datetime.utcnow()
        )

        return self.monitoring_repo.create(data)

    def _check_and_trigger_alerts(self, data: MonitoringData):
        """检查告警并发送通知"""
        alert_config = self.alert_repo.get_by_monitor_id(data.monitor_id)

        if not alert_config:
            return

        if self._should_trigger_alert(data.value, alert_config):
            self.pushover_service.send_alert(
                monitor_id=data.monitor_id,
                value=data.value,
                alert_config=alert_config
            )

            self.alert_repo.create_alert_state(
                monitor_id=data.monitor_id,
                alert_level=alert_config.alert_level
            )

    def _should_trigger_alert(self, value: float, config: AlertConfig) -> bool:
        """判断是否应该触发告警"""
        if config.upper_threshold and value > config.upper_threshold:
            return True
        if config.lower_threshold and value < config.lower_threshold:
            return True
        return False

    def _parse_value(self, text: str) -> Optional[float]:
        """解析文本为数值"""
        try:
            return float(text) if text.replace('.', '').replace('-', '').isdigit() else None
        except:
            return None


# app/api/webhook.py - API 层变得简洁
@router.post("/webhook/distill")
async def receive_webhook(payload: DistillWebhookPayload):
    db = get_db_session()

    # API 层只负责调用服务
    service = MonitoringService(db)
    data = service.process_webhook(payload)

    return {"status": "success", "data_id": data.id}
```

**优势：**
- ✅ API 层只处理 HTTP 相关逻辑
- ✅ 业务逻辑集中在 Service
- ✅ 易于测试（Mock Service）
- ✅ 易于复用（其他 API 也可用）
- ✅ 职责清晰

---

## 完整架构示例

### 最终的分层架构

```python
# ============= API Layer =============
# app/api/data.py
@router.get("/monitors/{monitor_id}/summary")
async def get_monitor_summary(monitor_id: str):
    """API 层：只处理 HTTP 请求/响应"""
    db = get_db_session()
    service = MonitoringService(db)

    # 调用服务层，返回结果
    summary = service.get_monitor_summary(monitor_id)
    return MonitorSummary(**summary)


# ============= Service Layer =============
# app/services/monitoring.py
class MonitoringService:
    """服务层：协调业务逻辑"""

    def __init__(self, db: Session):
        self.monitoring_repo = MonitoringRepository(db)
        self.alert_repo = AlertRepository(db)

    def get_monitor_summary(self, monitor_id: str) -> dict:
        """
        获取监控摘要（业务逻辑）
        可能涉及多个 repository 的协调
        """
        # 从 repository 获取数据
        summary = self.monitoring_repo.get_summary_statistics(monitor_id)

        # 额外的业务逻辑
        if summary['total_records'] == 0:
            summary['status'] = 'no_data'
        elif summary['latest_timestamp'] < datetime.utcnow() - timedelta(hours=1):
            summary['status'] = 'stale'
        else:
            summary['status'] = 'active'

        return summary


# ============= Repository Layer =============
# app/repositories/monitoring.py
class MonitoringRepository:
    """仓储层：数据访问"""

    def __init__(self, db: Session):
        self.db = db

    def get_summary_statistics(self, monitor_id: str) -> dict:
        """执行 SQL 查询，返回原始数据"""
        stats = self.db.query(
            func.count(MonitoringData.id).label('total_records'),
            func.min(MonitoringData.value).label('min_value'),
            # ...
        ).filter(
            MonitoringData.monitor_id == monitor_id
        ).first()

        return {
            'monitor_id': monitor_id,
            'total_records': stats.total_records,
            # ...
        }
```

---

## 测试对比

### ❌ 没有分层 - 测试困难

```python
# 测试 API 需要真实数据库
def test_get_summary():
    # 需要设置数据库
    # 需要插入测试数据
    # 需要清理数据库
    ...
```

### ✅ 有分层 - 测试简单

```python
# 测试 Service - Mock Repository
def test_monitoring_service():
    mock_repo = Mock(MonitoringRepository)
    mock_repo.get_summary_statistics.return_value = {'total': 10}

    service = MonitoringService(mock_db)
    service.monitoring_repo = mock_repo

    result = service.get_monitor_summary('test-id')
    assert result['total'] == 10

# 测试 Repository - 真实数据库或内存数据库
def test_monitoring_repository():
    # 使用 SQLite 内存数据库
    db = create_test_db()
    repo = MonitoringRepository(db)

    # 直接测试 SQL 查询
    stats = repo.get_summary_statistics('test-id')
    assert stats is not None
```

---

## 总结

| 特性 | 无分层 | Repository Pattern | + Service Layer |
|------|--------|-------------------|-----------------|
| **API 职责** | HTTP + 业务 + SQL | HTTP + 业务 | HTTP only |
| **测试难度** | 困难 | 中等 | 简单 |
| **代码复用** | 低 | 中 | 高 |
| **可维护性** | 差 | 好 | 优秀 |
| **职责清晰度** | 模糊 | 清晰 | 非常清晰 |

### 何时使用？

- **Repository Pattern**: 适合所有项目 ✅
- **Service Layer**: 当业务逻辑复杂时 ✅

### 我们的项目需要吗？

**需要！** 因为：
1. ✅ 有复杂的业务逻辑（告警、通知、数据解析）
2. ✅ 需要协调多个数据模型（MonitoringData, AlertConfig, PushoverConfig）
3. ✅ 想要更好的测试性
4. ✅ 未来可能扩展更多功能
