---
title: "Redis (Phần 1) - Hiểu Redis từ đầu"
date: "2026-04-27"
tags:
  - system-design
  - redis
  - backend
  - caching
  - distributed-systems
---

# Redis — Không chỉ là một cái cache

**Redis** (Remote Dictionary Server) là một trong những công cụ phổ biến và mạnh mẽ nhất trong thế giới backend hiện đại.
Không chỉ là một cache đơn thuần, Redis còn là một **in-memory data structure store** đa năng — có thể đóng vai trò cache, message broker, session store, và nhiều hơn nữa.

---

## Phần I: Redis là cái gì, và tại sao nó nhanh?

### 1. Redis, định nghĩa nhanh

Redis là một **in-memory key-value store** mã nguồn mở, nổi tiếng với:

- **Tốc độ cực nhanh**: Dữ liệu lưu hoàn toàn trong RAM → độ trễ thường dưới 1ms
- **Hỗ trợ nhiều kiểu dữ liệu**: String, List, Set, Sorted Set, Hash, Stream, ...
- **Single-threaded event loop**: Tránh race condition, đảm bảo tính nguyên tử (atomicity) của lệnh
- **Persistence tùy chọn**: Có thể ghi dữ liệu ra disk để không mất khi restart

### 1.1 Redis vs Memcached — Chọn cái nào?

Trước khi Redis thống trị, **Memcached** từng là tiêu chuẩn vàng cho caching. Vậy điểm khác biệt là gì?

<div align="center">

![Redis vs Memcached](/images/system_design/redis/redis_vs_memcached.png)

</div>

<br/>

> **Tóm lại**: Nếu bạn chỉ cần cache HTML/String đơn giản và muốn tận dụng tối đa multi-core, Memcached vẫn rất tốt. Nhưng đối với 99% dự án hiện đại cần cấu trúc dữ liệu phức tạp, **Redis là lựa chọn mặc định**.

---

### 2. Database đã có rồi, cần Redis làm gì?

#### 2.1 Khi database bắt đầu trở thành nút thắt cổ chai

Hãy tưởng tượng hệ thống e-commerce với hàng triệu người dùng:

- Mỗi request cần query database để lấy thông tin sản phẩm
- Database trả về kết quả trong ~50–200ms
- Với 10,000 request/giây → Database bị quá tải

**Giải pháp**: Đặt Redis phía trước Database để cache kết quả thường dùng.

#### 2.2 Redis làm được nhiều hơn bạn nghĩ

| Bài toán | Giải pháp với Redis |
|---|---|
| Database chậm | Cache kết quả query |
| Session management | Lưu session user vào Redis |
| Rate limiting | Dùng Redis Counter + TTL |
| Real-time leaderboard | Sorted Set |
| Message queue | Redis Stream hoặc List |
| Distributed lock | SET NX + EX |

---

### 3. Bên trong Redis hoạt động như thế nào?

#### 3.1 Chỉ một thread — nhưng tại sao lại nhanh?

Redis xử lý tất cả lệnh **tuần tự, trong một thread duy nhất**:

```
Client A: SET key1 "hello"
Client B: GET key1
Client C: INCR counter

→ Redis xử lý: SET → GET → INCR (theo thứ tự đến)
```

**Lợi ích:**
- Không cần lock/mutex → đơn giản hóa code
- Mỗi lệnh là nguyên tử (atomic) tự nhiên
- Tránh race condition

**Hạn chế:**
- Lệnh nặng (như `KEYS *` hay `SORT` trên tập lớn) có thể block toàn bộ server

> ⚠️ **Redis 6.0+** đã thêm **I/O multithreading** để xử lý network I/O song song, nhưng logic xử lý lệnh vẫn single-threaded.

#### 3.2 Toàn bộ trong RAM — vậy mất điện thì sao?

Redis giữ toàn bộ dữ liệu trong RAM, nhưng hỗ trợ 2 cơ chế ghi xuống disk:

**RDB (Redis Database Backup)**:
- Chụp snapshot toàn bộ dataset theo định kỳ (VD: mỗi 5 phút)
- Nhanh để restore, nhưng có thể mất dữ liệu giữa 2 lần snapshot

**AOF (Append-Only File)**:
- Ghi mọi lệnh write vào log file
- Bền hơn RDB, nhưng file lớn hơn và restore chậm hơn

**Kết hợp RDB + AOF**: Vừa có tốc độ snapshot vừa có độ bền của AOF — đây là cấu hình khuyến nghị cho production.

---

### 4. Các kiểu dữ liệu trong Redis

#### 4.1 String — Kiểu đơn giản nhất

```bash
SET user:1:name "Manh Phong"
GET user:1:name         # → "Manh Phong"
INCR page:views         # Tăng counter nguyên tử
SETEX session:abc 3600 "user_data"  # Tự xóa sau 1 giờ
```

**Use case**: Cache, counter, session token, feature flag

#### 4.2 Hash — Lưu object có nhiều field

```bash
HSET user:1 name "Manh Phong" age 25 city "HCM"
HGET user:1 name    # → "Manh Phong"
HGETALL user:1      # → tất cả field
```

**Use case**: Lưu thông tin user, product, config

#### 4.3 List — Danh sách có thứ tự

```bash
RPUSH queue:email "job1" "job2"   # Thêm vào cuối
LPOP queue:email                   # Lấy từ đầu (FIFO)
LRANGE feed:user1 0 9              # Lấy 10 item đầu
```

**Use case**: Message queue, activity feed, recent items

#### 4.4 Set — Tập hợp không trùng lặp

```bash
SADD tags:post1 "redis" "backend" "caching"
SMEMBERS tags:post1
SINTER tags:post1 tags:post2    # Intersection: tags chung
```

**Use case**: Unique visitors, tags, friend list, blacklist

#### 4.5 Sorted Set — Set có điểm số

```bash
ZADD leaderboard 1000 "player1" 850 "player2" 1200 "player3"
ZRANGE leaderboard 0 -1 WITHSCORES REV   # Top players
ZRANK leaderboard "player1"               # Rank của player1
```

**Use case**: Leaderboard, priority queue, time-series (score = timestamp)

---

### 5. TTL — Key tự biết lúc nào cần chết

Một trong những tính năng mạnh nhất của Redis: **tự động xóa key sau một khoảng thời gian**.

```bash
SET cache:user:1 "..." EX 3600    # Hết hạn sau 1 giờ
TTL cache:user:1                   # Kiểm tra thời gian còn lại
PERSIST cache:user:1               # Hủy TTL, key tồn tại mãi
```

**Redis dùng 2 cơ chế để xóa key hết hạn:**

1. **Lazy Expiration**: Key chỉ bị kiểm tra và xóa khi có ai đó `GET` nó
2. **Active Expiration**: Background job định kỳ quét và xóa các key đã hết hạn

---

### 6. RAM đầy rồi, Redis xử lý thế nào?

Khi Redis hết bộ nhớ, nó sẽ xử lý theo `maxmemory-policy`:

| Policy | Hành vi |
|---|---|
| `noeviction` | Từ chối write mới, trả lỗi (mặc định) |
| `allkeys-lru` | Xóa key ít dùng nhất (LRU) trong toàn bộ keyspace |
| `volatile-lru` | Xóa key có TTL ít dùng nhất |
| `allkeys-lfu` | Xóa key ít được truy cập nhất (LFU — Redis 4.0+) |
| `volatile-ttl` | Xóa key có TTL ngắn nhất trước |
| `allkeys-random` | Xóa ngẫu nhiên |

> **Khuyến nghị cho cache**: Dùng `allkeys-lru` hoặc `allkeys-lfu` để Redis tự quản lý memory như một cache thực sự.

---

### Tóm lại

| Khái niệm | Điểm chính |
|---|---|
| **Redis là gì** | In-memory key-value store, hỗ trợ nhiều data structure |
| **Tại sao nhanh** | Dữ liệu trong RAM, single-threaded event loop |
| **Persistence** | RDB (snapshot) + AOF (log) |
| **Data types** | String, Hash, List, Set, Sorted Set |
| **TTL** | Key tự hết hạn, Redis dọn bằng lazy + active expiration |
| **Eviction** | Nhiều policy để xử lý khi RAM đầy |

Phần tiếp theo sẽ nói về **Kiến trúc của Redis**, bao gồm mô hình Master-Replica, High Availability với Sentinel, và cách mở rộng quy mô (Scale-out) với Redis Cluster.
