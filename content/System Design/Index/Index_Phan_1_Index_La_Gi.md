---
title: "Database Index (Phần 1) - Index là gì và tại sao hệ thống cần nó"
date: "2026-04-30"
tags:
  - system-design
  - database
  - index
  - backend
  - performance
---

# Database Index — Tại sao truy vấn nhanh hay chậm phụ thuộc vào nó?

**Index** là một trong những công cụ tối ưu hóa quan trọng nhất trong cơ sở dữ liệu.
Nó quyết định liệu một câu truy vấn chạy trong vài **milliseconds** hay mất hàng **giây, thậm chí phút**.
Hiểu rõ index là gì, khi nào cần dùng và khi nào không — đó là kỹ năng cốt lõi của mọi backend engineer.


## Phần I: Hiểu Index từ gốc rễ

### 1. Index là gì, nói ngắn gọn

- **Index** là một **cấu trúc dữ liệu** giúp **tăng tốc độ truy vấn** dữ liệu.
- Index thường được **lưu trữ trên disk**, cùng nơi với dữ liệu chính.

Hãy tưởng tượng bạn có một cuốn sách giáo trình dày 800 trang.
Để tìm nội dung về "TCP/IP", bạn có hai lựa chọn:

- **Không có mục lục**: Lật từng trang, từ trang 1 đến 800, cho đến khi tìm thấy — **O(n)**
- **Có mục lục**: Tra bảng mục lục, biết ngay trang 342 — **O(log n)**

**Database Index hoạt động theo cùng nguyên lý đó.**

Khi bạn tạo index trên một cột, database xây dựng một **cấu trúc dữ liệu phụ** (thường là B-Tree hoặc Hash Table) chứa giá trị cột đó kèm con trỏ trỏ đến vị trí dòng dữ liệu thật.


### 2. Vấn đề mà Index giải quyết — Full Table Scan

Không có index, database phải duyệt qua **từng dòng** của bảng để tìm kết quả.

```sql
-- Bảng users có 10 triệu dòng, không có index trên email
SELECT * FROM users WHERE email = 'john@example.com';
```

Database sẽ đọc **10 triệu dòng**, so sánh từng dòng — đây gọi là **Full Table Scan**.

Với dữ liệu nhỏ thì không vấn đề gì, nhưng khi bảng có **hàng triệu dòng**, đây là thảm họa về hiệu năng.

**Full Table Scan:**
- Đọc toàn bộ bảng từ ổ đĩa vào RAM
- Tốn I/O disk — cực kỳ chậm
- Tốn CPU để so sánh từng dòng
- Tốn thời gian người dùng phải chờ


### 3. Index giúp ích như thế nào?

Khi có index trên cột `email`:

1. Database tìm trong **cấu trúc B-Tree** của index → tìm giá trị `john@example.com`
2. Lấy **con trỏ (pointer)** trỏ đến vị trí chính xác dòng dữ liệu trên disk
3. Đọc đúng dòng đó — không cần duyệt toàn bộ bảng

Thay vì đọc 10 triệu dòng, database chỉ cần **vài bước tra cứu** trong B-Tree — từ **O(n)** xuống **O(log n)**.

<div align="center">
  <img src="/images/system_design/index/1.3.png" alt="Sơ đồ so sánh Full Table Scan vs Index Scan" />
</div>


### 4. Index không miễn phí — luôn có đánh đổi

Index giúp **đọc nhanh hơn**, nhưng có chi phí:

| Hoạt động | Không có Index | Có Index |
|-----------|----------------|----------|
| **SELECT** | Chậm (Full Scan) | Nhanh |
| **INSERT** | Nhanh | Chậm hơn (phải cập nhật index) |
| **UPDATE** | Chậm (tìm dòng) + nhanh ghi | Nhanh tìm + chậm ghi (cập nhật index) |
| **DELETE** | Chậm (tìm dòng) | Nhanh tìm + phải xóa trong index |
| **Dung lượng disk** | Bình thường | Tốn thêm disk để lưu index |

**Nguyên tắc:** Mỗi lần bạn thêm index, bạn đang **đánh đổi tốc độ ghi và dung lượng** để đổi lấy **tốc độ đọc**.


### 5. Khi nào nên và không nên dùng Index?

**✅ Nên tạo index khi:**
- Cột thường xuyên xuất hiện trong mệnh đề `WHERE`, `JOIN ON`, `ORDER BY`
- Cột có **cardinality cao** (nhiều giá trị phân biệt) — ví dụ: `email`, `user_id`
- Bảng có **số lượng dòng lớn** (> vài chục nghìn dòng trở lên)

**❌ Không nên tạo index khi:**
- Cột có **cardinality thấp** — ví dụ: cột `gender` chỉ có 2-3 giá trị (index không hiệu quả)
- Bảng nhỏ — Full Scan có thể còn nhanh hơn đi qua index
- Cột **ghi rất nhiều nhưng ít đọc** — index làm chậm ghi không đáng

---

**Index là con dao hai lưỡi. Dùng đúng thì hệ thống bay, dùng sai thì ghi chậm, disk đầy.**
