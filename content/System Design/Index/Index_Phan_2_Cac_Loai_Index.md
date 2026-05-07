---
title: "Database Index (Phần 2) - Các loại Index: B-Tree, Hash, Composite và hơn thế"
date: "2026-04-30"
tags:
  - system-design
  - database
  - index
  - backend
  - performance
---

## Phần II: Các loại Index và khi nào dùng loại nào

### 6. B-Tree Index — loại phổ biến nhất

**B-Tree (Balanced Tree)** là cấu trúc index mặc định của hầu hết các RDBMS như PostgreSQL, MySQL (InnoDB), Oracle.

<div align="center">
  <img src="/images/system_design/index/2.6.png" alt="Sơ đồ cấu trúc B-Tree Index" />
</div>

**Cấu trúc:**
- Dữ liệu được sắp xếp theo **thứ tự có thể so sánh** (vd: chữ cái, số)
- Cây luôn **cân bằng**: mọi đường từ gốc đến lá đều có cùng độ sâu
- Mỗi node chứa nhiều key, cây **rộng** hơn thay vì sâu → giảm số lần đọc disk

**B-Tree hỗ trợ:**
- **Tìm kiếm chính xác**: `WHERE id = 42`
- **Tìm kiếm theo khoảng**: `WHERE age BETWEEN 20 AND 30`
- **Sắp xếp**: `ORDER BY created_at`
- **Tìm kiếm tiền tố**: `WHERE name LIKE 'Nguyen%'` *(chú ý: `LIKE '%Nguyen'` thì không dùng được index)*

**Độ phức tạp:**
- Tìm kiếm: **O(log n)**
- Chèn/xóa: **O(log n)**


### 7. Hash Index — nhanh nhất cho tra cứu chính xác

**Hash Index** chuyển đổi giá trị cột thành **hash code** và lưu trong bảng băm.

```
hash("john@example.com") → bucket 4829 → [con trỏ đến dòng dữ liệu]
hash("jane@example.com") → bucket 1204 → [con trỏ đến dòng dữ liệu]
```

**Ưu điểm:**
- ✅ Tìm kiếm chính xác cực nhanh: **O(1)** trung bình
- ✅ Phù hợp cho `WHERE email = 'abc@xyz.com'`

**Nhược điểm:**
- ❌ **Không hỗ trợ range query**: `WHERE age > 20` — hash không có khái niệm thứ tự
- ❌ **Không hỗ trợ ORDER BY**
- ❌ **Collision** (va chạm hash) làm giảm hiệu năng nếu không được xử lý tốt

**Khi nào dùng Hash Index:**
- In-memory database như **Redis** — tra cứu theo key chính xác
- Các bảng **lookup/mapping** — `user_session_id`, `token → user_id`
- Dữ liệu **không cần sắp xếp hay khoảng**


### 8. Clustered vs Non-Clustered Index

Đây là sự phân biệt quan trọng mà nhiều người bỏ qua.

#### 8.1 Clustered Index — dữ liệu chính là index

<div align="center">
  <img src="/images/system_design/index/2.8.1.png" alt="Sơ đồ Clustered Index" />
</div>

Trong **Clustered Index**, các dòng dữ liệu thật sự được **lưu trữ vật lý theo thứ tự của index**.

- Một bảng **chỉ có một** Clustered Index duy nhất (vì chỉ có một cách sắp xếp vật lý)
- Trong MySQL (InnoDB), **Primary Key luôn là Clustered Index**
- Vì dữ liệu được sắp xếp sẵn → truy vấn theo `PRIMARY KEY` cực nhanh

**Ví dụ**: Bảng `orders` có clustered index trên `order_id`:
```sql
-- Truy vấn này cực nhanh: dữ liệu nằm liên tiếp trên disk
SELECT * FROM orders WHERE order_id BETWEEN 1000 AND 2000;
```

#### 8.2 Non-Clustered Index — index riêng biệt với dữ liệu

<div align="center">
  <img src="/images/system_design/index/2.8.2.png" alt="Sơ đồ Non-Clustered Index" />
</div>

**Non-Clustered Index** là một **cấu trúc riêng biệt** chứa giá trị cột được index + con trỏ trỏ đến dòng dữ liệu thật.

- Một bảng có thể có **nhiều** Non-Clustered Index
- Truy vấn cần **hai bước**: tìm trong index → theo con trỏ đến dòng thật (**bookmark lookup**)
- Nếu cần nhiều cột không có trong index, database phải **quay lại bảng chính** → tốn I/O hơn


### 9. Composite Index — index trên nhiều cột

**Composite Index** (còn gọi là Multi-column Index) là index được tạo trên **nhiều cột cùng lúc**.

```sql
-- Tạo composite index trên (last_name, first_name)
CREATE INDEX idx_name ON users(last_name, first_name);
```

#### 9.1 Quy tắc "Leftmost Prefix"

Composite index **chỉ hiệu quả khi query dùng các cột từ trái sang phải**.

```sql
-- ✅ Dùng được index (last_name là cột đầu tiên)
SELECT * FROM users WHERE last_name = 'Nguyen';

-- ✅ Dùng được index (cả hai cột)
SELECT * FROM users WHERE last_name = 'Nguyen' AND first_name = 'Manh';

-- ❌ KHÔNG dùng được index (bỏ qua cột đầu tiên)
SELECT * FROM users WHERE first_name = 'Manh';
```

**Hãy luôn đặt cột được filter nhiều nhất và có cardinality cao lên đầu.**

#### 9.2 Thứ tự cột trong Composite Index quan trọng

```sql
-- Hai index này KHÁC NHAU hoàn toàn
CREATE INDEX idx_a ON orders(user_id, status);    -- Tối ưu cho: WHERE user_id = ? AND status = ?
CREATE INDEX idx_b ON orders(status, user_id);    -- Tối ưu cho: WHERE status = ? (nhiều user)
```

Thứ tự cột phải phản ánh **cách bạn thường query**.


### 10. Covering Index — không cần quay lại bảng chính

**Covering Index** là khi index chứa **đủ tất cả các cột mà query cần** — database không cần đọc thêm bảng chính.

```sql
-- Index trên (user_id, status, created_at)
CREATE INDEX idx_orders_cover ON orders(user_id, status, created_at);

-- Query này chỉ cần đọc index, không cần đọc bảng orders
SELECT user_id, status, created_at FROM orders WHERE user_id = 123;
```

<div align="center">
  <img src="/images/system_design/index/2.10.png" alt="Sơ đồ Covering Index" />
</div>

**Ưu điểm:**
- ✅ Loại bỏ hoàn toàn bookmark lookup
- ✅ Tốc độ đọc rất nhanh — đặc biệt hiệu quả với read-heavy workloads

**Nhược điểm:**
- ❌ Index to hơn vì chứa nhiều cột
- ❌ Ghi chậm hơn vì phải cập nhật nhiều cột trong index

---

**Chọn đúng loại index cho từng tình huống — đó là nghệ thuật, không phải khoa học.**
