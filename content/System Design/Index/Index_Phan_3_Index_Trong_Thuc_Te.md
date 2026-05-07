---
title: "Database Index (Phần 3) - Index trong thực tế: cạm bẫy và tối ưu hóa"
date: "2026-04-30"
tags:
  - system-design
  - database
  - index
  - backend
  - performance
---

## Phần III: Index trong thực tế

### 11. Những cạm bẫy phổ biến khiến Index bị bỏ qua

Tạo index không đảm bảo database sẽ dùng nó. Có nhiều cách vô tình "phá" index mà không hay biết.

#### 11.1 Dùng hàm trên cột được index

```sql
-- ❌ Index trên email bị bỏ qua — database phải tính LOWER() cho từng dòng
SELECT * FROM users WHERE LOWER(email) = 'john@example.com';

-- ✅ Giải pháp: lưu dữ liệu đã lowercase, hoặc dùng Function-based Index
SELECT * FROM users WHERE email = 'john@example.com';

-- ✅ Hoặc tạo Function-based Index (PostgreSQL)
CREATE INDEX idx_email_lower ON users(LOWER(email));
```

#### 11.2 Implicit type conversion (ép kiểu ngầm)

```sql
-- ❌ Cột phone là VARCHAR nhưng so sánh với số nguyên
-- Database phải cast từng dòng → Full Table Scan
SELECT * FROM users WHERE phone = 0912345678;

-- ✅ So sánh đúng kiểu
SELECT * FROM users WHERE phone = '0912345678';
```

#### 11.3 LIKE với wildcard đầu chuỗi

```sql
-- ❌ Wildcard ở đầu → không dùng được B-Tree index
SELECT * FROM products WHERE name LIKE '%phone%';

-- ✅ Wildcard chỉ ở cuối → dùng được index
SELECT * FROM products WHERE name LIKE 'iphone%';

-- ✅ Giải pháp cho full-text search: dùng Full-Text Index
CREATE FULLTEXT INDEX idx_name ON products(name);
SELECT * FROM products WHERE MATCH(name) AGAINST('phone');
```

#### 11.4 OR làm mất tác dụng của Composite Index

```sql
-- ❌ OR khiến optimizer bỏ qua index (trong nhiều trường hợp)
SELECT * FROM orders WHERE user_id = 1 OR status = 'pending';

-- ✅ Dùng UNION thay thế
SELECT * FROM orders WHERE user_id = 1
UNION
SELECT * FROM orders WHERE status = 'pending';
```

#### 11.5 Chọn quá nhiều cột không cần thiết

```sql
-- ❌ SELECT * buộc database quay lại bảng chính (bookmark lookup)
SELECT * FROM orders WHERE user_id = 123;

-- ✅ Chỉ select những cột cần thiết — có thể tận dụng Covering Index
SELECT order_id, status, created_at FROM orders WHERE user_id = 123;
```


### 12. Index và vấn đề ghi — khi nào index trở thành gánh nặng?

Index tăng tốc đọc, nhưng **mỗi thao tác ghi đều phải cập nhật tất cả các index liên quan**.

```
INSERT một dòng mới:
  → Ghi vào bảng chính
  → Cập nhật Index 1 (B-Tree rebalance nếu cần)
  → Cập nhật Index 2
  → Cập nhật Index 3
  → ...
```

**Bài toán thực tế:** Một bảng `event_logs` nhận **100,000 INSERT/giây** từ hệ thống tracking.

❌ Nếu bảng có 8 index → mỗi giây phải thực hiện **800,000 thao tác index update**.

**Giải pháp:**
- Chỉ tạo index trên các cột **thực sự được query**
- Dùng **partial index** để giảm kích thước index
- Với write-heavy workloads: **batch insert**, **bulk load**, hoặc **tắt index khi import dữ liệu lớn**


### 13. Partial Index — index thông minh hơn

**Partial Index** (PostgreSQL) chỉ đánh index trên **một tập con dữ liệu** theo điều kiện.

```sql
-- Chỉ index các đơn hàng chưa xử lý (pending)
-- Thay vì index toàn bộ bảng orders (có thể hàng tỷ dòng)
CREATE INDEX idx_pending_orders ON orders(created_at)
WHERE status = 'pending';

-- Query này sẽ dùng partial index — nhỏ gọn và nhanh hơn nhiều
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at;
```

**Ưu điểm:**
- ✅ Index nhỏ hơn nhiều → ít disk, tìm kiếm nhanh hơn
- ✅ Ghi nhanh hơn — chỉ update index khi dòng thỏa điều kiện
- ✅ Phù hợp cho dữ liệu có **phân phối lệch** (skewed distribution)


### 14. Quy trình phân tích và tối ưu Index

Khi gặp query chậm, đây là quy trình chuẩn:

#### Bước 1: Dùng EXPLAIN để hiểu query plan

```sql
-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- MySQL
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
```

**Những điều cần chú ý trong kết quả EXPLAIN:**

| Dấu hiệu | Ý nghĩa | Hành động |
|----------|---------|-----------|
| `Seq Scan` / `Full Table Scan` | Không dùng index | Xem xét tạo index |
| `Index Scan` | Dùng index, cần bookmark lookup | Cân nhắc Covering Index |
| `Index Only Scan` | Covering Index — tốt nhất | Giữ nguyên |
| `rows=10000000` nhưng kết quả ít | Thống kê lỗi thời | Chạy `ANALYZE table` |

#### Bước 2: Kiểm tra thống kê index hiện có

```sql
-- PostgreSQL: xem các index đang dùng hay không
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;  -- index ít được dùng nằm trên cùng
```

**Index có `idx_scan = 0` sau nhiều tuần** → có thể là index thừa, cân nhắc xóa.

#### Bước 3: Tìm slow queries

```sql
-- PostgreSQL: bật pg_stat_statements để theo dõi slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```


### 15. Tổng kết — Index trong thực tế

**Index là nghệ thuật cân bằng giữa đọc và ghi.**

**5 nguyên tắc thực chiến:**

1. 📌 **Index theo query, không theo cột**
   - Nhìn vào các query thực tế của ứng dụng trước khi tạo index
   - Đừng index mọi cột vì "có thể sẽ cần"

2. 📊 **Ưu tiên cardinality cao**
   - Cột `user_id` (triệu giá trị) → index hiệu quả
   - Cột `is_deleted` (chỉ 0/1) → index gần như vô nghĩa

3. 🎯 **Composite Index: thứ tự cột là tất cả**
   - Cột filter nhiều nhất, cardinality cao nhất → đặt đầu tiên
   - Nhớ quy tắc Leftmost Prefix

4. 🔍 **Dùng EXPLAIN thường xuyên**
   - Không đoán mò — để database nói cho bạn biết nó đang làm gì
   - Kiểm tra sau mỗi lần thêm hoặc xóa index

5. 🧹 **Xóa index thừa**
   - Index không được dùng vẫn làm chậm ghi và tốn disk
   - Định kỳ review `pg_stat_user_indexes` hoặc tương đương

---

**Kỹ năng index tốt là dấu hiệu của một engineer hiểu hệ thống thực sự — không chỉ viết query cho xong.**
