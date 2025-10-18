#!/usr/bin/env python3
"""
示例：从东京服务器发送对冲数据到主服务器

用法:
    python send_hedge_data.py
"""

import asyncio
import requests
from datetime import datetime
from typing import Dict, List


# 配置
API_ENDPOINT = "https://distill.baa.one/api/hedge-data"  # 替换成你的实际域名
AUTH_TOKEN = "your_webhook_secret_here"  # 替换成你的 WEBHOOK_SECRET


async def send_hedge_data(data_points: List[Dict]) -> bool:
    """
    发送对冲数据到主服务器

    Args:
        data_points: 数据点列表，每个点包含 monitor_id, monitor_name, value, timestamp

    Returns:
        bool: 是否成功
    """
    payload = {
        "data_points": data_points
    }

    try:
        response = requests.post(
            f"{API_ENDPOINT}?token={AUTH_TOKEN}",
            json=payload,
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✓ 成功发送 {result.get('message')}")
            return True
        else:
            print(f"✗ 发送失败: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        print(f"✗ 发送错误: {e}")
        return False


async def calculate_and_send_jlp_hedge(jlp_amount: float):
    """
    计算 JLP 对冲量并发送

    这里是示例，你需要替换成实际的 JLP 计算逻辑
    """
    # TODO: 替换成你实际的 JLP 计算逻辑
    # 这里只是示例数据
    from your_jlp_calculator import calculate_jlp_hedge  # 替换成实际的导入

    hedge_positions = await calculate_jlp_hedge(jlp_amount)

    # 转换成 API 格式
    data_points = []
    current_time = datetime.utcnow().isoformat() + 'Z'

    for symbol, data in hedge_positions.items():
        data_points.append({
            "monitor_id": f"jlp_hedge_{symbol}",
            "monitor_name": f"JLP {symbol} 对冲量",
            "value": data['amount'],
            "timestamp": current_time
        })

    # 发送到主服务器
    await send_hedge_data(data_points)


async def calculate_and_send_alp_hedge(alp_amount: float):
    """
    计算 ALP 对冲量并发送

    这里是示例，你需要替换成实际的 ALP 计算逻辑
    """
    # TODO: 替换成你实际的 ALP 计算逻辑
    # 可以直接使用你现有的 alp.py 文件
    import sys
    sys.path.insert(0, '/path/to/your/xLP/src/pools')  # 替换成实际路径
    from alp import calculate_hedge

    hedge_positions = await calculate_hedge(alp_amount)

    # 转换成 API 格式
    data_points = []
    current_time = datetime.utcnow().isoformat() + 'Z'

    for symbol, data in hedge_positions.items():
        # 使用 BTC 而不是 WBTC
        display_symbol = "BTC" if symbol == "WBTC" else symbol

        data_points.append({
            "monitor_id": f"alp_hedge_{display_symbol}",
            "monitor_name": f"ALP {display_symbol} 对冲量",
            "value": data['amount'],
            "timestamp": current_time
        })

    # 发送到主服务器
    await send_hedge_data(data_points)


async def main():
    """主函数：定期计算并发送对冲数据"""

    # 从数据库或配置读取 JLP/ALP 数量
    # 这里是示例值
    jlp_amount = 5000.0  # 替换成实际值
    alp_amount = 5000.0  # 替换成实际值

    print(f"开始计算对冲量...")
    print(f"JLP: {jlp_amount:,.2f}")
    print(f"ALP: {alp_amount:,.2f}")
    print()

    # 计算并发送 JLP 对冲数据
    if jlp_amount > 0:
        print("计算 JLP 对冲量...")
        await calculate_and_send_jlp_hedge(jlp_amount)

    # 计算并发送 ALP 对冲数据
    if alp_amount > 0:
        print("计算 ALP 对冲量...")
        await calculate_and_send_alp_hedge(alp_amount)

    print("\n完成!")


if __name__ == "__main__":
    asyncio.run(main())
