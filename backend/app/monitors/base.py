"""
Base monitor class for all monitoring tasks.
Provides a common interface for background monitoring services.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Optional


class BaseMonitor(ABC):
    """
    Abstract base class for all monitors.

    Each monitor runs as an independent background task and should:
    1. Implement the run() method with monitoring logic
    2. Handle its own error recovery
    3. Be stoppable via the stop() method
    """

    def __init__(self, name: str, interval: int = 60):
        """
        Initialize monitor.

        Args:
            name: Human-readable name for the monitor
            interval: Seconds between monitor runs (default: 60)
        """
        self.name = name
        self.interval = interval
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the monitor as a background task."""
        if self._running:
            print(f"⚠ Monitor '{self.name}' is already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        print(f"✓ Monitor '{self.name}' started (interval: {self.interval}s)")

    async def stop(self) -> None:
        """Stop the monitor gracefully."""
        if not self._running:
            return

        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        print(f"✓ Monitor '{self.name}' stopped")

    async def _run_loop(self) -> None:
        """
        Internal loop that runs the monitor.
        Handles initialization delay and error recovery.
        """
        # Wait a bit before starting to let the app fully initialize
        await asyncio.sleep(5)

        while self._running:
            try:
                await self.run()
            except Exception as e:
                print(f"⚠ Error in monitor '{self.name}': {e}")
                # Continue running despite errors

            # Wait for next iteration
            await asyncio.sleep(self.interval)

    @abstractmethod
    async def run(self) -> None:
        """
        Execute one iteration of the monitoring task.
        This method should be implemented by subclasses.

        Raises:
            NotImplementedError: If not implemented by subclass
        """
        raise NotImplementedError("Subclasses must implement run() method")

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name='{self.name}', interval={self.interval}s, running={self._running})>"
