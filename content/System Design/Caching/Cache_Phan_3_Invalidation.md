---
title: "Cache Design (Phần 3) - Cache Invalidation"
date: "2026-04-25"
tags:
  - system-design
  - caching
  - backend
  - distributed-systems
  - consistency
---

## Cache Invalidation

Cache invalidation là việc xóa hoặc làm hết hiệu lực dữ liệu cũ trong cache khi dữ liệu gốc trong database đã thay đổi.

## 1. Vì sao Cache Invalidation khó

<div align="center">
  <img src="/images/system_design/cache/invalidate_cache_is_hard.png" alt="Sơ đồ invalidate_cache_is_hard" />
</div>

## 2. Các chiến lược invalidation phổ biến

### 2.1 TTL-based invalidation

Mỗi key có thời gian sống (TTL), hết hạn thì tự xóa.

**Ưu điểm:**
- Đơn giản
- Dễ vận hành

**Nhược điểm:**
- Có khoảng thời gian dữ liệu bị cũ

### 2.2 Explicit invalidation

Khi update DB, ứng dụng chủ động xóa key liên quan trong cache.

Ví dụ:
1. Update `user:123` trong DB
2. Delete key cache `user:123`
3. Lần đọc tiếp theo sẽ nạp lại từ DB

### 2.3 Event-based invalidation

Service ghi DB phát sự kiện (vd: `product.updated`), service cache lắng nghe để xóa hoặc cập nhật key.

**Phù hợp:** hệ thống nhiều service, phân tán.

### 2.4 Versioned key

Không ghi đè key cũ, mà tăng version:
- `product:42:v5`
- `product:42:v6`

Giảm rủi ro ghi đè stale data nhưng quản lý key phức tạp hơn.

## 3. Pattern thực dụng nên dùng

### 3.1 Update DB -> Delete Cache

Đây là pattern thực tế, dễ triển khai và an toàn hơn chiều ngược lại.

```text
write flow:
1) update DB
2) delete cache key
```

### 3.2 Cache-Aside cho luồng đọc

```text
read flow:
1) đọc cache
2) miss -> đọc DB
3) set cache
```

### 3.3 Double Delete (khi traffic cao)

```text
1) update DB
2) delete cache
3) sleep ngắn
4) delete cache lần 2
```

## 4. Race Condition trong môi trường đa luồng

### 4.1 Anti-pattern nguy hiểm: Delete Cache -> Update DB

Race điển hình:
1. Thread A delete cache
2. Thread B cache miss, đọc DB cũ
3. Thread B set cache cũ
4. Thread A update DB mới

Kết quả: **DB mới nhưng cache cũ**.

### 4.2 Cache miss storm / stampede

Nhiều thread cùng miss một key và cùng query DB.

Giải pháp:
- Single flight theo key
- Distributed lock ngắn hạn
- TTL + jitter

### 4.3 Event đến sai thứ tự

Trong event-driven invalidation, event cũ đến sau event mới có thể làm cache rollback về trạng thái cũ.

Giải pháp:
- Gắn version/timestamp
- Bỏ qua event cũ hơn

## 5. Khi nào chọn chiến lược nào

### 5.1 Dữ liệu ít nhạy
- TTL-based là đủ

### 5.2 Dữ liệu cần tương đối mới
- Update DB -> Delete Cache
- TTL ngắn làm safety net

### 5.3 Hệ thống đa service
- Event-based invalidation + version check

### 5.4 Hot key
- Single flight
- Pre-warm key nóng

## 6. Checklist triển khai thực tế

- Thiết kế key rõ ràng theo namespace (`service:entity:id`)
- Dùng TTL cho mọi key để tránh key sống vô hạn
- Write theo pattern `update DB -> delete cache`
- Có cơ chế chống stampede cho key nóng
- Theo dõi metric: hit rate, miss rate, stale read, DB fallback rate

## Kết luận

Cache invalidation không có công thức hoàn hảo cho mọi hệ thống.

Cách an toàn để bắt đầu:
1. Cache-aside cho read
2. Update DB -> Delete Cache cho write
3. TTL + jitter
4. Thêm single-flight khi gặp hot key
