---
title: "Cache Design (Phần 1) - Nền Tảng & Tư Duy Cốt Lõi"
date: "2026-04-23"
tags:
  - system-design
  - caching
  - backend
  - performance
  - distributed-systems
---

# Cache Design - Từ Nền Tảng đến Ứng Dụng Thực Tế

**Cache** là một trong những khái niệm cơ bản nhất nhưng cũng dễ gây rối nhất trong hệ thống máy tính. 
Nó có mặt ở khắp nơi: từ CPU nhỏ bé cho đến các hệ thống toàn cầu. 
Hiểu rõ tại sao cần cache và những đánh đổi của nó là chìa khóa để xây dựng hệ thống chạy nhanh và mượt mà.


## Phần I: Nền Tảng & Tư Duy Cốt Lõi

### 1. Giới thiệu

Cache là một trong những khái niệm vừa cơ bản nhưng cũng vừa dễ gây rối rắm nhất trong giới máy tính.

Nó có mặt ở khắp nơi:
- Từ những con chip CPU nhỏ bé
- Cho đến các hệ thống toàn cầu

Phần này sẽ giúp bạn hiểu:
- **Cache là gì**
- **Tại sao nó quan trọng**
- **Nó nằm ở đâu trong hệ thống**


### 2. Bài toán Cache giải quyết: Phân tầng tốc độ

#### 2.1 Vấn đề: CPU quá nhanh so với phần còn lại

Hầu hết chúng ta không nhận ra rằng: **CPU nhanh hơn bộ nhớ (RAM) hàng trăm lần**.

Hãy tưởng tượng:
- CPU là một **đầu bếp siêu tốc**
- Nhưng mỗi khi cần nguyên liệu, ông ta lại phải đợi người đi giao hàng từ **kho rất xa**

**Những con số thực tế (với CPU 3 GHz):**

| Vị trí | Thời gian | Nhịp CPU |
|-------|----------|---------|
| L1 cache | 0.9 ns | 4 nhịp |
| RAM | 100 ns | 300 nhịp |
| SSD | 10-100 μs | 30K - 300K nhịp |
| Mạng/Internet | 10-100 ms | 30M - 300M nhịp |

> **Bài học:** Nếu CPU phải chờ dữ liệu từ Internet (100ms), nó sẽ lãng phí khoảng **300 triệu nhịp xử lý** chỉ để ngồi chơi.


#### 2.2 Giải pháp: Phân tầng bộ nhớ (Hierarchy)

Vì không thể làm cho mọi bộ nhớ đều nhanh như CPU (vì quá đắt), chúng ta chia dữ liệu thành nhiều tầng:

- **Cái nào cần gấp** → để ở chỗ **nhanh** (nhưng nhỏ)
- **Cái nào ít dùng** → để ở chỗ **chậm** (nhưng lớn)


#### 2.3 Quy luật 'Vùng làm việc' & Tính cục bộ

**Working set** là tập hợp dữ liệu mà chương trình đang cần dùng **ngay lúc này**.

Thường thì dữ liệu này rất nhỏ so với toàn bộ hệ thống.

**Ví dụ:**
- Bạn có một danh sách **10 triệu số** (40 MB)
- Nhưng vòng lặp của bạn chỉ đang tính toán quanh **1.000 số đầu tiên** (~4 KB)

**Hiệu suất sẽ khác nhau:**
- Nếu 4 KB này nằm trong **L1 cache** → Tốc độ **cực nhanh** (0.9 ns)
- Nếu phải lôi từ **RAM** → Tốc độ sẽ **chậm hơn 111 lần** (100 ns)

**Nguyên lý 80/20 (Pareto):**

> 80% người dùng thường chỉ truy cập vào **20% dữ liệu hot nhất**.

Nếu bạn giữ được 20% dữ liệu này trong cache, hệ thống đã xử lý mượt mà cho đại đa số yêu cầu.


### 3. Cache là một bài toán đánh đổi (Trade-offs)

Cache **không phải là phép màu miễn phí**.

Khi bạn tăng kích thước cache:

**Được:**
- ✅ Tăng tỷ lệ tìm thấy dữ liệu (Hit rate)

**Mất:**
- ❌ Tốn bộ nhớ
- ❌ Tốn công quản lý
- ❌ Hệ thống trở nên phức tạp hơn


#### 3.1 Tiền bạc vs. Tốc độ

Hãy nhìn vào ví dụ lưu trữ phiên đăng nhập (sessions) của người dùng:

| Kích thước | Sessions | Hit rate | Tốc độ | Chi phí |
|-----------|----------|----------|--------|---------|
| 100 MB | 10.000 | 50% | 50 ms | $5/tháng |
| 1 GB | 100.000 | 92% | 8 ms | $40/tháng |
| 10 GB | 1.000.000 | 99% | 1 ms | $400/tháng |

💡 **Lời khuyên:** Đừng chọn cái to nhất. Hãy chọn cái **'vừa đủ'** (thường là **1GB** trong ví dụ trên) để có hiệu quả kinh tế tốt nhất.


#### 3.2 Hiệu suất giảm dần (Diminishing Returns)

**Không phải** cứ tăng gấp đôi cache là tốc độ nhanh gấp đôi.

- Khi tăng từ **100MB → 200MB**: Bạn thấy nhanh hơn hẳn (**60%** ⬆️)
- Khi tăng từ **800MB → 1.6GB**: Tốc độ chỉ cải thiện thêm **5%** ⬆️

**Tại sao?**

> Những dữ liệu **'hot' nhất** bạn đã lưu rồi. Việc lưu thêm những dữ liệu hiếm khi dùng tới **không mang lại nhiều giá trị**.


#### 3.3 Gánh nặng dọn dẹp (Eviction)

Khi cache đầy, máy tính phải suy nghĩ:

> **'Nên xóa cái nào để nhường chỗ cho cái mới?'**

Việc đi tìm và xóa dữ liệu cũ cũng tốn CPU và thời gian.

🎯 **Mẹo:** Nên để cache hoạt động ở mức **70-80% công suất**.

Đừng để nó đầy khít, nếu không máy sẽ tốn **10-20% sức lực** chỉ để đi dọn dẹp.


### 4. Cache ở mọi tầng trong hệ thống

#### 4.1 Tầng Phần cứng: CPU Cache

Đây là tầng bạn không thể can thiệp trực tiếp bằng code.

Nhưng bạn có thể viết code **'khôn'** để CPU làm việc dễ dàng hơn.

**Cấu trúc:**
- **L1, L2, L3**: Càng lên cao, càng chậm nhưng dung lượng càng lớn

⚠️ **Lưu ý kỹ thuật:**

Nếu hai luồng xử lý (threads) cùng tranh nhau cập nhật dữ liệu nằm quá gần nhau trong bộ nhớ, chúng sẽ làm hỏng cache của nhau (**False Sharing**), khiến tốc độ tụt dốc.


#### 4.2 Tầng Hệ điều hành: Page Cache

Linux hay Windows sẽ tự động lấy những phần dữ liệu bạn hay đọc trên ổ cứng để để sẵn vào RAM.

**So sánh tốc độ:**
- Lần đầu đọc: **50ms**
- Lần sau (từ cache): **100ns**
- **Nhanh hơn:** 500.000 lần! 🚀


#### 4.3 Tầng Ứng dụng: Nơi bạn làm chủ hoàn toàn

Có **3 loại chính**:

**1️⃣ Cache trong máy (In-memory)**
- Ví dụ: Caffeine
- Cực nhanh
- Nhưng chỉ máy đó biết, máy khác không thấy

**2️⃣ Cache dùng chung (Distributed)**
- Ví dụ: Redis
- Chậm hơn một chút vì phải đi qua mạng
- Nhưng tất cả các máy chủ đều nhìn thấy dữ liệu giống nhau

**3️⃣ Cache phía người dùng (CDN/HTTP Cache)**
- Lưu dữ liệu ở những máy chủ gần người dùng nhất (về mặt địa lý)
- Hoặc ngay trong trình duyệt của họ


#### 4.4 Mô hình Cache đa tầng lý tưởng

Một hệ thống chuyên nghiệp thường kết hợp tất cả:

```
┌─────────────────────────────────────┐
│ Ứng dụng yêu cầu dữ liệu             │
└────────────────┬────────────────────┘
                 ↓
     Lớp 1: Bộ nhớ máy (1 μs)
                 ↓ (Miss)
     Lớp 2: Redis (5 ms)
                 ↓ (Miss)
     Lớp 3: Database (100 ms)
```


