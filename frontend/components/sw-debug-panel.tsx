'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useServiceWorker } from '@/hooks/useServiceWorker';

/**
 * Service Worker Debug Panel
 * Shows registration status and provides test controls
 */
export function ServiceWorkerDebugPanel() {
  const { requestNotificationPermission, checkNow, isSupported } = useServiceWorker();
  const [swStatus, setSwStatus] = useState<'checking' | 'registered' | 'not-registered' | 'not-supported'>('checking');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [swController, setSwController] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isSupported) {
      setSwStatus('not-supported');
      return;
    }

    // Check Service Worker registration
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration) {
        setSwStatus('registered');
        setSwController(!!navigator.serviceWorker.controller);
      } else {
        setSwStatus('not-registered');
      }
    });

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Listen for Service Worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setSwController(!!navigator.serviceWorker.controller);
    });
  }, [isSupported]);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    if (granted) {
      alert('通知权限已授予！');
    } else {
      alert('通知权限被拒绝');
    }
  };

  const handleTestNotification = () => {
    if (Notification.permission !== 'granted') {
      alert('请先授予通知权限');
      return;
    }

    new Notification('测试通知', {
      body: '这是一个测试通知，如果你看到了说明通知功能正常！',
      icon: '/icon-192.png',
      tag: 'test-notification'
    });
  };

  const handleTestSound = () => {
    const audio = new Audio('/sounds/alert-high.mp3');
    audio.volume = 0.6;
    audio.play().catch(e => {
      alert('播放声音失败：' + e.message);
    });
  };

  const handleCheckNow = () => {
    checkNow();
    alert('已触发 Service Worker 立即检查警报');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Worker 调试面板</CardTitle>
        <CardDescription>
          检查 Service Worker 状态并测试通知功能
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Service Worker 状态</label>
            <div className="mt-1">
              {swStatus === 'registered' && (
                <Badge variant="default">✅ 已注册</Badge>
              )}
              {swStatus === 'not-registered' && (
                <Badge variant="destructive">❌ 未注册</Badge>
              )}
              {swStatus === 'not-supported' && (
                <Badge variant="secondary">⚠️ 不支持</Badge>
              )}
              {swStatus === 'checking' && (
                <Badge variant="outline">🔍 检查中...</Badge>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Controller 状态</label>
            <div className="mt-1">
              {swController ? (
                <Badge variant="default">✅ 已激活</Badge>
              ) : (
                <Badge variant="secondary">⏳ 未激活</Badge>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">通知权限</label>
            <div className="mt-1">
              {notificationPermission === 'granted' && (
                <Badge variant="default">✅ 已授予</Badge>
              )}
              {notificationPermission === 'denied' && (
                <Badge variant="destructive">❌ 已拒绝</Badge>
              )}
              {notificationPermission === 'default' && (
                <Badge variant="secondary">⏳ 未询问</Badge>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">后台警报设置</label>
            <div className="mt-1">
              {typeof window !== 'undefined' && localStorage.getItem('backgroundAlertsEnabled') !== 'false' ? (
                <Badge variant="default">✅ 已启用</Badge>
              ) : (
                <Badge variant="secondary">❌ 已禁用</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">测试功能</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRequestPermission}>
              请求通知权限
            </Button>
            <Button size="sm" onClick={handleTestNotification} variant="outline">
              测试通知
            </Button>
            <Button size="sm" onClick={handleTestSound} variant="outline">
              测试声音
            </Button>
            <Button size="sm" onClick={handleCheckNow} variant="outline">
              立即检查警报
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                  registrations.forEach(r => r.unregister());
                  alert('已清除 Service Worker，请刷新页面重新注册');
                });
              }}
            >
              清除 SW（调试用）
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">浏览器控制台指令</p>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono space-y-1">
            <div>查看注册: <code>navigator.serviceWorker.getRegistration()</code></div>
            <div>查看权限: <code>Notification.permission</code></div>
            <div>查看设置: <code>localStorage.getItem('backgroundAlertsEnabled')</code></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
