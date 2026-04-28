---
title: "Redis (Phần 3) - Dùng Redis thực tế như thế nào"
date: "2026-04-27"
tags:
  - system-design
  - redis
  - backend
  - caching
  - distributed-systems
---

# Redis — Dùng như thế nào cho đúng?

Phần trước đã giải thích kiến trúc của Redis. Phần này đi thẳng vào các **pattern thực tế** được dùng trong production — cách Redis giải quyết các bài toán phức tạp hơn là chỉ đơn giản là cache.

---

## Phần III: Các pattern hay gặp trong thực tế

### 1. Các cách dùng Redis để cache

Đây là use case phổ biến nhất. Nhưng cách implement đúng quan trọng hơn việc "chỉ thêm Redis vào".

#### 1.1 Cache-Aside (Lazy Loading)

Pattern phổ biến nhất — ứng dụng tự quản lý cache:

```
Request → Check Redis
   ↓ Cache HIT → Trả kết quả từ Redis
   ↓ Cache MISS → Query Database → Ghi vào Redis → Trả kết quả
```

```python
def get_user(user_id):
    cache_key = f"user:{user_id}"
    
    # 1. Thử lấy từ cache
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 2. Cache miss → query DB
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    
    # 3. Ghi vào cache với TTL 1 giờ
    redis.setex(cache_key, 3600, json.dumps(user))
    
    return user
```

**Ưu điểm**: Chỉ cache những gì thực sự được hỏi, linh hoạt  
**Nhược điểm**: Lần đầu luôn bị cache miss (cold start), nguy cơ **cache stampede**

#### 1.2 Cache Stampede — Khi 1000 request cùng thấy cache miss

Kịch bản: 1000 request đồng thời cùng hit cache miss → 1000 query vào Database cùng lúc → Database sập.

**Giải pháp: Distributed Lock + Early Re-computation**

```python
def get_user_safe(user_id):
    cache_key = f"user:{user_id}"
    lock_key = f"lock:user:{user_id}"
    
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Chỉ 1 request được phép query DB
    acquired = redis.set(lock_key, "1", nx=True, ex=5)
    if acquired:
        try:
            user = db.query("SELECT * FROM users WHERE id = ?", user_id)
            redis.setex(cache_key, 3600, json.dumps(user))
            return user
        finally:
            redis.delete(lock_key)
    else:
        # Các request khác đợi
        time.sleep(0.1)
        return get_user_safe(user_id)  # Retry
```

#### 1.3 Write-Through Cache

Ghi vào cache và database **cùng lúc**:

```
Write Request → Ghi vào Redis → Ghi vào Database → Trả kết quả
```

**Ưu điểm**: Cache luôn nhất quán với DB, không bao giờ stale  
**Nhược điểm**: Write chậm hơn, cache chứa nhiều data chưa chắc được đọc

#### 1.4 Write-Behind (Write-Back) Cache

Ghi vào cache ngay, **ghi xuống DB sau** (async):

```
Write Request → Ghi vào Redis (ACK ngay) → Background job → Flush sang DB
```

**Ưu điểm**: Write cực nhanh  
**Nhược điểm**: Có thể mất dữ liệu nếu Redis crash trước khi flush

---

### 2. Distributed Lock — đảm bảo chỉ một nơi chạy một lúc

#### 2.1 Bài toán: nhiều server, một việc

Trong hệ thống distributed, nhiều server cùng chạy — cần đảm bảo tác vụ quan trọng (VD: xử lý payment) chỉ chạy **một lần** tại một thời điểm.

#### 2.2 Cách thực hiện với Redis

```bash
# Acquire lock: SET nếu key chưa tồn tại, TTL 30s
SET lock:payment:123 "server-1" NX EX 30

# → OK: Có lock, tiến hành xử lý
# → nil: Lock đang được giữ bởi server khác

# Release lock (chỉ xóa nếu mình đang giữ)
# Dùng Lua script để đảm bảo atomic:
```

```lua
-- Lua script: chỉ xóa nếu value khớp
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
```

#### 2.3 Redlock — khi có nhiều node Redis

Dùng khi có **Redis Cluster** (nhiều node). Thuật toán Redlock của Antirez:

1. Lấy timestamp hiện tại
2. Thử acquire lock trên **N node Redis** (thường N=5)
3. Nếu acquire được trên **đa số node** (≥ N/2+1) trong thời gian cho phép → Có lock
4. Thời gian lock hợp lệ = TTL - thời gian acquire

> ⚠️ Redlock vẫn có tranh cãi về correctness trong edge case. Với yêu cầu critical cao, xem xét dùng ZooKeeper hoặc etcd thay thế.

---

### 3. Rate Limiting — chặn request abuse

#### 3.1 Fixed Window Counter

```python
def is_rate_limited(user_id, limit=100, window=60):
    key = f"rate:{user_id}:{int(time.time() // window)}"
    
    count = redis.incr(key)
    if count == 1:
        redis.expire(key, window)  # Set TTL lần đầu
    
    return count > limit
```

**Vấn đề**: Spike ở biên window — user có thể gửi 200 request trong vòng 2 giây (cuối window cũ + đầu window mới).

#### 3.2 Sliding Window Log

```python
def is_rate_limited_sliding(user_id, limit=100, window=60):
    key = f"rate_log:{user_id}"
    now = time.time()
    
    pipe = redis.pipeline()
    # Xóa các request cũ hơn window
    pipe.zremrangebyscore(key, 0, now - window)
    # Thêm request hiện tại
    pipe.zadd(key, {str(now): now})
    # Đếm số request trong window
    pipe.zcard(key)
    pipe.expire(key, window)
    results = pipe.execute()
    
    return results[2] > limit
```

**Chính xác hơn Fixed Window** nhưng tốn memory hơn (lưu timestamp từng request).

#### 3.3 Token Bucket với Redis

```python
def consume_token(user_id, capacity=10, refill_rate=1):
    key = f"bucket:{user_id}"
    now = time.time()
    
    # Lua script đảm bảo atomic
    script = """
    local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens') or capacity)
    local last_refill = tonumber(redis.call('HGET', KEYS[1], 'last_refill') or now)
    local refill = math.floor((now - last_refill) * rate)
    tokens = math.min(capacity, tokens + refill)
    
    if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HSET', KEYS[1], 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', KEYS[1], 3600)
        return 1  -- Allowed
    else
        return 0  -- Rate limited
    end
    """
    return redis.eval(script, 1, key, capacity, refill_rate, now)
```

---

### 4. Lưu session bằng Redis

Redis là lựa chọn hàng đầu cho **distributed session store**:

```python
# Login: tạo session
session_id = str(uuid.uuid4())
session_data = {"user_id": 123, "role": "admin", "login_at": now}
redis.setex(f"session:{session_id}", 86400, json.dumps(session_data))  # 24h

# Middleware: validate session
def get_session(session_id):
    data = redis.get(f"session:{session_id}")
    if data:
        redis.expire(f"session:{session_id}", 86400)  # Sliding expiry
        return json.loads(data)
    return None

# Logout: xóa session ngay lập tức
def logout(session_id):
    redis.delete(f"session:{session_id}")
```

**Tại sao dùng Redis thay JWT cho session?**

| | JWT | Redis Session |
|---|---|---|
| Revoke ngay | ❌ Không thể | ✅ Xóa key là xong |
| Payload size | Nhỏ (client lưu) | Server lưu, client chỉ lưu ID |
| Scalability | ✅ Stateless | Cần Redis available |
| Bảo mật | Cần validate signature | Tự động expire |

---

### 5. Pub/Sub và Stream — khi cần nhắn tin giữa các service

#### 5.1 Pub/Sub — đơn giản, nhưng mất message khi offline

```python
# Publisher
redis.publish("channel:notifications", json.dumps({
    "user_id": 123,
    "message": "Bạn có đơn hàng mới!"
}))

# Subscriber
pubsub = redis.pubsub()
pubsub.subscribe("channel:notifications")

for message in pubsub.listen():
    if message["type"] == "message":
        data = json.loads(message["data"])
        print(f"Received: {data}")
```

**Hạn chế của Pub/Sub**: Message không được lưu trữ — subscriber offline sẽ **mất message**.

#### 5.2 Redis Stream — Queue có lưu tạm

Redis Stream (từ version 5.0) là một **persistent message log**:

```python
# Producer: thêm message vào stream
redis.xadd("stream:orders", {
    "order_id": "123",
    "user_id": "456",
    "amount": "99.99"
})

# Consumer Group: nhiều worker xử lý, không bị trùng
redis.xgroup_create("stream:orders", "order-processors", id="0")

# Worker
messages = redis.xreadgroup(
    "order-processors", "worker-1",
    {"stream:orders": ">"},  # ">" = chỉ lấy message chưa deliver
    count=10
)

for stream, msgs in messages:
    for msg_id, data in msgs:
        process_order(data)
        redis.xack("stream:orders", "order-processors", msg_id)
```

**Redis Stream vs Kafka**:

| | Redis Stream | Kafka |
|---|---|---|
| Throughput | Vừa (hàng trăm nghìn msg/s) | Rất cao (hàng triệu msg/s) |
| Retention | Giới hạn bởi RAM | Disk (unlimited) |
| Setup | Đơn giản | Phức tạp |
| Use case | Realtime, internal queue | Event sourcing, big data pipeline |

---

### 6. Leaderboard — bài toán Sorted Set điển hình

Một use case cực kỳ phù hợp với Redis:

```python
# Cập nhật điểm
redis.zadd("leaderboard:global", {"player:123": 1500})
redis.zincrby("leaderboard:global", 100, "player:123")  # +100 điểm

# Top 10 players
top10 = redis.zrange("leaderboard:global", 0, 9, withscores=True, rev=True)
# → [("player:456", 2000), ("player:123", 1600), ...]

# Rank của một player
rank = redis.zrevrank("leaderboard:global", "player:123")
# → 1 (0-indexed, tức là hạng 2)

# Players xung quanh tôi (±5 hạng)
my_rank = redis.zrevrank("leaderboard:global", "player:123")
nearby = redis.zrange("leaderboard:global",
    max(0, my_rank - 5), my_rank + 5,
    withscores=True, rev=True
)
```

---

### 7. So sánh Redis và Memcached trong thực tế

Khi triển khai production, khác biệt lớn nhất không nằm ở benchmark đơn lẻ mà ở **bài toán bạn cần giải**:

| Tiêu chí | Redis | Memcached |
|---|---|---|
| Mục tiêu chính | Cache + data store cho nhiều pattern (session, lock, queue, leaderboard) | Cache key-value thuần, tối giản |
| Kiểu dữ liệu | String, Hash, List, Set, Sorted Set, Stream | Key-value đơn giản |
| Độ bền dữ liệu | Có thể bật RDB/AOF | Không persistence |
| Feature đi kèm | TTL mạnh, Pub/Sub, Lua, consumer group (Stream) | Tập trung cache, ít tính năng phụ |
| Vận hành | Nhiều cấu hình hơn, linh hoạt hơn | Dễ setup, scale ngang nhanh cho cache đơn giản |

**Rule of thumb**:

- Nếu chỉ cần cache response/object đơn giản với kiến trúc tối giản: chọn **Memcached**.
- Nếu cần thêm session tập trung, distributed lock, rate limit, queue nhẹ hoặc leaderboard: chọn **Redis**.

---

### Tóm lại

| Pattern | Redis Feature | Use Case |
|---|---|---|
| Cache-Aside | String + TTL | API response caching |
| Distributed Lock | SET NX EX + Lua | Payment, job scheduling |
| Rate Limiting | INCR / Sorted Set | API throttling |
| Session Store | String + EXPIRE | User authentication |
| Pub/Sub | PUBLISH/SUBSCRIBE | Real-time notifications |
| Message Queue | Redis Stream | Order processing, event-driven |
| Leaderboard | Sorted Set | Gaming, ranking |

Phần tiếp theo sẽ nói về Redis Cluster, High Availability và cách vận hành Redis ở môi trường production quy mô lớn.
