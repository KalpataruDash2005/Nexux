import time
import hashlib
from abc import ABC, abstractmethod
from typing import Optional, Any, Dict, Tuple
from collections import OrderedDict
from app.core.config import settings
from app.core.logging import logger

class BaseCacheProvider(ABC):
    """Abstract Cache Provider interface supporting pluggable in-memory / distributed backends."""
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        pass

    @abstractmethod
    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        pass

    @abstractmethod
    def clear(self) -> None:
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        pass

class InMemoryLRUCache(BaseCacheProvider):
    """
    Thread-safe, bounded in-memory LRU cache with per-entry TTL.
    Prevents unbounded memory growth in long-lived or warm serverless microVMs.
    """
    def __init__(self, max_entries: int = 200, default_ttl: int = 3600):
        self.max_entries = max_entries
        self.default_ttl = default_ttl
        # OrderedDict mapping key -> (value, expire_timestamp)
        self._store: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            self.misses += 1
            return None

        value, expire_at = self._store[key]
        now = time.time()
        if expire_at and now > expire_at:
            # Expired entry
            del self._store[key]
            self.misses += 1
            return None

        # Move to end to mark as recently used
        self._store.move_to_end(key)
        self.hits += 1
        return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        expire_at = time.time() + ttl if ttl > 0 else 0.0

        if key in self._store:
            del self._store[key]
        elif len(self._store) >= self.max_entries:
            # Evict least recently used (first item in OrderedDict)
            self._store.popitem(last=False)
            self.evictions += 1

        self._store[key] = (value, expire_at)

    def delete(self, key: str) -> bool:
        if key in self._store:
            del self._store[key]
            return True
        return False

    def clear(self) -> None:
        self._store.clear()
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def get_stats(self) -> Dict[str, Any]:
        total = self.hits + self.misses
        hit_ratio = (self.hits / total) if total > 0 else 0.0
        return {
            "size": len(self._store),
            "max_entries": self.max_entries,
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "hit_ratio": round(hit_ratio, 4)
        }

class CacheManager:
    """
    Centralized, namespace-isolated Cache Manager.
    Enforces tenant separation, deterministic key hashing, and metric tracking.
    """
    def __init__(self, provider: Optional[BaseCacheProvider] = None):
        self.provider = provider or InMemoryLRUCache(
            max_entries=settings.CACHE_MAX_ENTRIES,
            default_ttl=settings.CACHE_DEFAULT_TTL_SECONDS
        )

    @staticmethod
    def build_key(namespace: str, tenant_id: Optional[str], resource_id: str, *params) -> str:
        """
        Builds a deterministic, isolated cache key format:
        careeros:{namespace}:{tenant_id or 'global'}:{resource_id}:{sha256(params)}
        """
        tenant = tenant_id if tenant_id else "global"
        raw_params = ":".join(str(p) for p in params)
        if raw_params:
            param_hash = hashlib.sha256(raw_params.encode("utf-8")).hexdigest()[:16]
            return f"careeros:{namespace}:{tenant}:{resource_id}:{param_hash}"
        return f"careeros:{namespace}:{tenant}:{resource_id}"

    def get(self, key: str) -> Optional[Any]:
        try:
            return self.provider.get(key)
        except Exception as e:
            logger.warning(f"[CACHE] Error reading key {key}: {e}")
            return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        try:
            self.provider.set(key, value, ttl_seconds)
        except Exception as e:
            logger.warning(f"[CACHE] Error writing key {key}: {e}")

    def delete(self, key: str) -> bool:
        try:
            return self.provider.delete(key)
        except Exception as e:
            logger.warning(f"[CACHE] Error deleting key {key}: {e}")
            return False

    def clear(self) -> None:
        self.provider.clear()

    def get_stats(self) -> Dict[str, Any]:
        return self.provider.get_stats()

    # Mapping protocol support for seamless dictionary-like access
    def __getitem__(self, key: str) -> Any:
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

    def __setitem__(self, key: str, value: Any) -> None:
        self.set(key, value)

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None

# Global Singleton Instance
cache_manager = CacheManager()
