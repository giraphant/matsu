#!/usr/bin/env python3
"""
Simple Pushover test script
"""
import requests
import sys

USER_KEY = input("Enter your Pushover User Key: ").strip()
API_TOKEN = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"  # Default app token

if not USER_KEY:
    print("Error: User key is required")
    sys.exit(1)

payload = {
    'token': API_TOKEN,
    'user': USER_KEY,
    'message': 'This is a test notification from Matsu!',
    'title': 'Test Notification',
    'priority': 0,
    'sound': 'pushover'
}

print(f"\nSending test notification...")
print(f"User Key: {USER_KEY[:10]}...")
print(f"API Token: {API_TOKEN[:10]}...")

try:
    response = requests.post(
        'https://api.pushover.net/1/messages.json',
        data=payload,
        timeout=10
    )

    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {response.text}")

    if response.status_code == 200:
        print("\n✅ SUCCESS: Notification sent!")
    else:
        print(f"\n❌ FAILED: {response.text}")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
