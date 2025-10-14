# 后端架构演进图

## 当前架构 vs 优化后架构

### 📊 当前架构（Phase 1-4）

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (React)                     │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP Request
         ┌──────────▼──────────┐
         │    API Layer        │
         │  (data.py, etc.)    │
         │                     │
         │  • HTTP 处理        │
         │  • 业务逻辑  ❌     │  ← 混在一起
         │  • SQL 查询  ❌     │
         │  • 数据验证         │
         └──────────┬──────────┘
                    │ Direct Query
         ┌──────────▼──────────┐
         │     Database        │
         │   (SQLite/PG)       │
         └─────────────────────┘
```

**问题：**
- ❌ API 层职责过多
- ❌ 业务逻辑分散
- ❌ SQL 查询重复
- ❌ 难以测试

---

### ✨ 优化后架构（+ Repository + Service）

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (React)                     │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP Request
    ┌───────────────▼────────────────┐
    │        API Layer               │  ← 轻量级
    │      (data.py, etc.)           │
    │                                │
    │  ✅ HTTP 请求/响应处理          │
    │  ✅ 参数验证                    │
    │  ✅ 调用 Service               │
    └───────────────┬────────────────┘
                    │ Call Service
    ┌───────────────▼────────────────┐
    │      Service Layer             │  ← 新增！业务逻辑层
    │   (monitoring_service.py)      │
    │                                │
    │  ✅ 业务逻辑协调                │
    │  ✅ 多个 Repository 协作       │
    │  ✅ 事务管理                    │
    │  ✅ 告警触发                    │
    │  ✅ 通知发送                    │
    └───────────────┬────────────────┘
                    │ Call Repository
    ┌───────────────▼────────────────┐
    │    Repository Layer            │  ← 新增！数据访问层
    │  (monitoring_repository.py)    │
    │                                │
    │  ✅ SQL 查询封装                │
    │  ✅ CRUD 操作                   │
    │  ✅ 复杂查询方法                │
    │  ✅ 数据库抽象                  │
    └───────────────┬────────────────┘
                    │ SQL Query
         ┌──────────▼──────────┐
         │     Database        │
         │   (SQLite/PG)       │
         └─────────────────────┘
```

**优势：**
- ✅ 职责清晰分离
- ✅ 易于测试
- ✅ 代码复用高
- ✅ 易于维护

---

## 实际请求流程对比

### 示例：获取监控数据摘要

#### ❌ 当前流程（混乱）

```
1. Request → /api/monitors/btc/summary

2. API Layer (app/api/data.py)
   ├─ 解析参数
   ├─ 执行 SQL 查询 ❌
   │  ├─ SELECT COUNT(*) ...
   │  ├─ SELECT MIN(), MAX() ...
   │  └─ SELECT * ORDER BY ...
   ├─ 检查告警配置 ❌
   ├─ 计算业务逻辑 ❌
   └─ 返回响应

3. Database ← 直接查询
```

#### ✅ 优化后流程（清晰）

```
1. Request → /api/monitors/btc/summary

2. API Layer (app/api/data.py)
   ├─ 解析参数
   ├─ 调用 Service
   │   └─ monitoring_service.get_monitor_summary('btc')
   └─ 返回响应

3. Service Layer (app/services/monitoring.py)
   ├─ 调用 Repository 获取统计数据
   │   └─ monitoring_repo.get_summary_statistics('btc')
   ├─ 调用 Repository 获取告警配置
   │   └─ alert_repo.get_by_monitor_id('btc')
   ├─ 执行业务逻辑
   │   ├─ 判断数据状态（活跃/过期/无数据）
   │   ├─ 检查是否需要告警
   │   └─ 组合结果
   └─ 返回业务对象

4. Repository Layer (app/repositories/monitoring.py)
   ├─ 执行 SQL 查询
   │   ├─ SELECT COUNT(*), MIN(), MAX(), AVG() ...
   │   └─ SELECT * ORDER BY timestamp DESC LIMIT 1
   └─ 返回数据模型

5. Database ← Repository 查询
```

---

## 代码对比：实际例子

### 场景：处理 Webhook 并触发告警

#### ❌ 当前代码（125 行，API 层太重）

```python
# app/api/webhook.py
@router.post("/webhook/distill")
async def receive_webhook(payload: DistillWebhookPayload):
    db = get_db_session()
    try:
        # 1. 解析数据（10 行）
        value = None
        if payload.text:
            try:
                value = float(payload.text)
            except:
                pass

        # 2. 查找上一条记录（15 行）
        previous = db.query(MonitoringData)\
            .filter(MonitoringData.monitor_id == payload.id)\
            .order_by(desc(MonitoringData.timestamp))\
            .first()

        is_change = False
        change_type = None
        previous_value = None

        if previous and previous.value is not None and value is not None:
            if value != previous.value:
                is_change = True
                change_type = 'increase' if value > previous.value else 'decrease'
                previous_value = previous.value

        # 3. 创建记录（20 行）
        data = MonitoringData(
            monitor_id=payload.id or payload.monitor_id,
            monitor_name=payload.name or payload.monitor_name,
            url=payload.uri or payload.url,
            value=value,
            text_value=payload.text,
            status=payload.status or 'active',
            timestamp=datetime.utcnow(),
            webhook_received_at=datetime.utcnow(),
            is_change=is_change,
            change_type=change_type,
            previous_value=previous_value
        )
        db.add(data)
        db.commit()
        db.refresh(data)

        # 4. 检查告警配置（30 行）
        alert_config = db.query(AlertConfig)\
            .filter(AlertConfig.monitor_id == payload.id)\
            .first()

        if alert_config and value is not None:
            should_alert = False
            alert_message = ""

            if alert_config.upper_threshold and value > alert_config.upper_threshold:
                should_alert = True
                alert_message = f"Value {value} exceeds upper threshold {alert_config.upper_threshold}"

            if alert_config.lower_threshold and value < alert_config.lower_threshold:
                should_alert = True
                alert_message = f"Value {value} below lower threshold {alert_config.lower_threshold}"

            # 5. 发送通知（25 行）
            if should_alert:
                pushover_config = db.query(PushoverConfig).first()
                if pushover_config:
                    from app.services.pushover import send_pushover_notification
                    send_pushover_notification(
                        user_key=pushover_config.user_key,
                        message=alert_message,
                        title=f"Alert: {data.monitor_name}",
                        level=alert_config.alert_level,
                        api_token=pushover_config.api_token
                    )

                    # 6. 记录告警状态（15 行）
                    alert_state = AlertState(
                        monitor_id=payload.id,
                        alert_level=alert_config.alert_level,
                        triggered_at=datetime.utcnow(),
                        last_notified_at=datetime.utcnow(),
                        is_active=True
                    )
                    db.add(alert_state)
                    db.commit()

        return {"status": "success", "data": data}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
```

#### ✅ 优化后代码（15 行，清晰简洁）

```python
# app/api/webhook.py
@router.post("/webhook/distill")
async def receive_webhook(payload: DistillWebhookPayload):
    """
    接收 Distill webhook
    API 层只负责 HTTP 处理，业务逻辑在 Service 层
    """
    db = get_db_session()

    try:
        # 调用服务层处理所有业务逻辑
        service = MonitoringService(db)
        data = service.process_webhook(payload)

        return {"status": "success", "data_id": data.id}

    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# app/services/monitoring.py (新建)
class MonitoringService:
    """监控数据业务逻辑服务"""

    def process_webhook(self, payload: DistillWebhookPayload) -> MonitoringData:
        """处理 webhook 的完整业务流程"""
        # 1. 解析并创建数据
        data = self._create_monitoring_data(payload)

        # 2. 检查并触发告警
        self._check_and_trigger_alerts(data)

        return data

    def _create_monitoring_data(self, payload) -> MonitoringData:
        # 调用 Repository
        previous = self.monitoring_repo.get_latest(payload.id)
        value = self._parse_value(payload.text)
        change_info = self._detect_change(value, previous)

        return self.monitoring_repo.create(
            MonitoringData(..., **change_info)
        )

    # ... 其他方法清晰分离
```

---

## 测试对比

### ❌ 当前：难以测试

```python
# 测试 API 需要：
# 1. 真实数据库
# 2. 数据库迁移
# 3. 测试数据准备
# 4. 数据清理
# 5. Mock Pushover 服务
# 6. 复杂的断言

def test_webhook_endpoint():
    # 需要设置整个数据库
    setup_test_database()

    # 需要插入测试数据
    insert_test_data()

    # 发送请求
    response = client.post("/webhook/distill", json={...})

    # 验证结果（需要查询数据库）
    assert response.status_code == 200
    data = db.query(MonitoringData).first()
    assert data is not None

    # 清理
    cleanup_database()
```

### ✅ 优化后：易于测试

```python
# 测试 Service：简单的单元测试
def test_monitoring_service():
    # Mock Repository
    mock_repo = Mock(MonitoringRepository)
    mock_repo.get_latest.return_value = None
    mock_repo.create.return_value = MonitoringData(id=1)

    # 创建 Service
    service = MonitoringService(mock_db)
    service.monitoring_repo = mock_repo

    # 测试
    result = service.process_webhook(payload)

    # 验证
    assert result.id == 1
    mock_repo.create.assert_called_once()


# 测试 Repository：数据库层测试
def test_monitoring_repository():
    # 使用内存数据库
    db = create_in_memory_db()
    repo = MonitoringRepository(db)

    # 测试查询
    data = repo.create(MonitoringData(...))
    assert data.id is not None

    stats = repo.get_summary_statistics('test-id')
    assert stats['total_records'] == 1
```

---

## 架构层次总结

```
┌─────────────────────────────────────────────┐
│  API Layer (薄层)                           │
│  职责：HTTP 请求/响应处理                    │
│  示例：参数验证、调用 Service、返回 JSON    │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│  Service Layer (业务层)                     │
│  职责：业务逻辑协调                          │
│  示例：                                      │
│  • 协调多个 Repository                      │
│  • 事务管理                                  │
│  • 告警触发逻辑                              │
│  • 数据转换                                  │
│  • 通知发送                                  │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│  Repository Layer (数据层)                  │
│  职责：数据访问抽象                          │
│  示例：                                      │
│  • CRUD 操作                                │
│  • 复杂 SQL 查询                            │
│  • 数据库无关接口                            │
└───────────────────┬─────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │     Database        │
         └─────────────────────┘
```

---

## 是否应该实施？

### ✅ 应该，因为：

1. **项目已经有一定复杂度**
   - 多种数据模型（MonitoringData, AlertConfig, PushoverConfig, etc.）
   - 复杂业务逻辑（告警、通知、数据解析）
   - 多个外部服务（Pushover, DEX APIs）

2. **未来会持续增长**
   - 更多 DEX 集成
   - 更多告警类型
   - 更多通知渠道

3. **提升代码质量**
   - 更易测试
   - 更易维护
   - 更好的团队协作

### 优先级建议

1. **先实施 Repository Pattern** ⭐⭐⭐⭐⭐
   - 立即见效
   - 改动相对小
   - 基础架构

2. **再实施 Service Layer** ⭐⭐⭐⭐
   - 在 Repository 基础上
   - 更大的重构
   - 长期收益

---

## 下一步行动

如果你同意，我可以帮你：

1. ✅ **已完成**：创建 Repository Pattern
   - BaseRepository
   - MonitoringRepository

2. **待完成**：
   - 创建 Service Layer
   - 重构 API 使用 Service
   - 添加单元测试示例

你想继续实施吗？
