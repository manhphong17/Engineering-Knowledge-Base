---
title: "Cache Design (Phần 2) - Đọc và ghi: chọn chiến lược nào?"
date: "2026-04-23"
tags:
  - system-design
  - caching
  - backend
  - performance
  - distributed-systems
---

## Phần II: Chiến lược đọc và ghi

### 5. Đọc dữ liệu từ cache như thế nào?

#### 5.1 Cache-Aside (Lazy Loading)

**Đây là chiến lược phổ biến nhất.**

<div align="center">
  <img src="/images/system_design/cache/cache-aside.png" alt="Sơ đồ Cache-Aside" />
</div>

*Hình: Luồng hoạt động Cache-Aside (đọc cache trước, miss thì xuống DB rồi ghi ngược lên cache).* 

Ứng dụng sẽ kiểm tra Cache trước.
- Nếu **có (Hit)** → trả về luôn
- Nếu **không (Miss)** → truy vấn Database và cập nhật ngược lại vào Cache

**Quy trình:**
1. Check Cache → Nếu có (Hit), trả về luôn
2. Nếu không (Miss) → Đọc từ Database
3. Lưu dữ liệu vừa đọc vào Cache để dùng cho lần sau

**Ưu điểm:**
- ✅ Khả năng chịu lỗi tốt (nếu Cache sập, hệ thống vẫn chạy với DB)

**Nhược điểm:**
- ❌ **Độ trễ lần đầu (First-load latency)**: Người dùng đầu tiên luôn bị chậm
- ❌ **Dữ liệu bị cũ (Stale data)**: Nếu DB thay đổi nhưng Cache chưa hết TTL
- ❌ **Cache Stampede**: Nếu cache sập, tất cả requests sẽ đổ dồn vào DB cùng lúc

**Ví dụ thực tế:**

Trang chi tiết sản phẩm trên **Tiki/Shopee**:
- Thông tin sản phẩm ít thay đổi nên được lưu vào **Redis**
- Khi có người xem, hệ thống check **Redis** trước
- Nếu không thấy mới query **DB**


#### 5.2 Read-Through — để tầng cache tự lo

Khác với **Cache-Aside** (nơi ứng dụng quản lý cả DB và Cache).

<div align="center">
  <img src="/images/system_design/cache/read-through.png" alt="Sơ đồ Read-Through" />
</div>

*Hình: Luồng Read-Through (ứng dụng chỉ gọi cache/provider, miss thì provider tự đọc DB).* 

Ở chiến lược này, ứng dụng chỉ tương tác với **một Cache Library/Provider**.

Nếu **Cache Miss**, chính lớp Cache này sẽ tự đi tìm dữ liệu ở DB và nạp vào chính nó.

**Quy trình:**
1. Ứng dụng yêu cầu dữ liệu từ Cache
2. Nếu Miss → Cache tự nạp từ DB
3. Cache trả dữ liệu về cho ứng dụng

**Ưu điểm:**
- ✅ Code ứng dụng **sạch hơn** (không phải xử lý logic check-then-fill)

**Nhược điểm:**
- ❌ **Độ phức tạp khi tích hợp**: Đòi hỏi một lớp trung gian hiểu cấu trúc Database
- ❌ **Khó tùy biến query**: Việc thực hiện các câu query phức tạp, Join nhiều bảng thường khó khăn

**Ví dụ thực tế:**

Sử dụng **Guava Cache** hoặc các thư viện tích hợp sẵn để load dữ liệu từ ổ đĩa lên RAM.


#### 5.3 Refresh-Ahead — nạp trước khi ai hỏi

Chiến lược này **dự đoán** dữ liệu nào sắp hết hạn hoặc sắp được truy cập.

<div align="center">
  <img src="/images/system_design/cache/refresh-ahead.png" alt="Sơ đồ Refresh-Ahead" />
</div>

*Hình: Luồng Refresh-Ahead (hệ thống chủ động refresh dữ liệu trước khi request tới).* 

Sau đó tự động **làm mới (refresh)** trước khi người dùng yêu cầu.

**Quy trình:**
- Hệ thống theo dõi **TTL** của Key
- Nếu Key sắp hết hạn → tiến trình chạy ngầm tự động fetch dữ liệu mới từ DB
- Đè lên Key đó

**Ưu điểm:**
- ✅ Giảm thiểu tối đa **độ trễ (latency)** vì dữ liệu gần như luôn có sẵn

**Nhược điểm:**
- ❌ **Lãng phí tài nguyên**: Liên tục làm mới những dữ liệu mà không ai truy cập tới
- ❌ **Khó dự báo chính xác**: Thuật toán dự báo có thể bỏ lỡ hoặc làm mới quá sớm/muộn

**Ví dụ thực tế:**

Các hệ thống **bảng giá chứng khoán** hoặc **tỉ số bóng đá** trực tuyến:
- Dữ liệu cần được cập nhật **liên tục**
- Người dùng không thể chờ đợi việc load từ DB khi Cache hết hạn


### 6. Ghi dữ liệu: cache và database đồng bộ như thế nào?

#### 6.1 Write-Through

**Write-through** là chiến lược mà việc ghi dữ liệu sẽ được thực hiện **đồng thời** trên cả cache và database.

<div align="center">
  <img src="/images/system_design/cache/write-through.png" alt="Sơ đồ Write-Through" />
</div>

> Hình: Luồng Write-Through (ghi đồng thời cache và database trong cùng luồng xử lý).

Chỉ khi dữ liệu được ghi **thành công vào cả hai nơi**, thao tác ghi mới được coi là hoàn thành.

**Cách hoạt động:**
1. Ứng dụng thực hiện thao tác ghi dữ liệu tới **hệ thống cache**
2. Hệ thống cache sẽ tự động thực hiện việc ghi dữ liệu vào cả **cache và database**
3. Chỉ khi cả hai thao tác ghi vào cache và database đều **thành công**
4. Thao tác ghi mới được xem là **hoàn tất**
5. Nếu một trong hai thao tác thất bại → toàn bộ giao dịch sẽ bị **rollback**

**Ưu điểm:**
- ✅ Application chỉ cần ghi dữ liệu vào bộ nhớ đệm
- ✅ **Đảm bảo tính nhất quán** giữa cache và database
- ✅ Phù hợp với dữ liệu **read nhiều nhưng write thấp** (ví dụ: danh mục sản phẩm)

**Nhược điểm:**
- ❌ **Hiệu năng thấp**: Đồng bộ vào cả 2 nơi làm giảm hiệu suất
- ❌ **Bottleneck**: Đặc biệt với hệ thống có tần suất ghi cao
- ❌ **Lãng phí dung lượng**: Nếu có nhiều dữ liệu được ghi nhưng không được đọc lại
- ❌ **Khó xử lý lỗi**: Cần rollback nếu có lỗi, rất phức tạp

**Trường hợp sử dụng:**

✅ **Write-through phù hợp khi:**
- Cần đảm bảo **tính nhất quán cao** giữa cache và database
- Ví dụ: **DAX (DynamoDB Accelerator)** - cache cho Amazon DynamoDB

❌ **Write-through không phù hợp khi:**
- Yêu cầu **hiệu năng cao** cho thao tác ghi (ví dụ: xử lý log, analytics)
- Dữ liệu có **tính tạm thời** (ví dụ: cache session)
- **Tài nguyên hạn chế** (ví dụ: hệ thống nhúng, IoT)


#### 6.2 Write-Around — bỏ qua cache khi ghi

**Ghi trực tiếp vào Database** và bỏ qua Cache.

<div align="center">
  <img src="/images/system_design/cache/write-around.png" alt="Sơ đồ Write-Around" />
</div>

> Hình: Luồng Write-Around (ghi thẳng DB, cache chỉ được nạp khi có request đọc).

Dữ liệu chỉ vào Cache khi có thao tác **Đọc** sau đó.

**Cơ chế:**

```
Ghi (App) → Database → Thành công
           (Cache giữ nguyên)
```

**Ưu điểm:**
- ✅ Không làm **đầy Cache** bằng những dữ liệu ghi xong nhưng ít khi đọc lại

**Nhược điểm:**
- ❌ Thao tác **đọc ngay sau khi ghi** sẽ luôn bị **Cache Miss**

**Ví dụ:**
- Hệ thống **lưu log**
- **Báo cáo định kỳ**


#### 6.3 Write-Back — ghi cache trước, đẳy xuống DB sau

Khác với **write-through**, **write-back** là chiến lược ghi **không đồng bộ** vào cache và database.

<div align="center">
  <img src="/images/system_design/cache/write-back.png" alt="Sơ đồ Write-Back" />
</div>

> Hình: Luồng Write-Back (ghi vào cache trước, đồng bộ xuống database theo lô/chu kỳ).

Dữ liệu sẽ được **ghi vào cache trước**, và sau đó được **tích lũy** rồi **ghi vào database theo chu kỳ** (từng lô lớn).

Điều này giúp **giảm tải** cho database và cải thiện **tốc độ thực thi**.

**Ưu điểm:**
- ✅ **Giảm độ trễ ghi**: Dữ liệu được ghi vào cache trước, không bị đợi database
- ✅ **Giảm số lần ghi**: Ghi theo lô thay vì từng lần
- ✅ **Giảm tải cho database**
- ✅ **Tăng khả năng chống chịu lỗi**: Dữ liệu có thể được phục hồi từ cache

**Nhược điểm:**
- ❌ **Dữ liệu tạm thời không nhất quán**: Cache và database có thể không đồng bộ
- ❌ **Nguy cơ mất dữ liệu**: Nếu cache sập trước khi dữ liệu được ghi vào DB
- ❌ **Phức tạp trong quản lý**: Cần cơ chế đồng bộ hóa phức tạp

**Ví dụ thực tế:**

- **Ổ cứng SSD**: Ghi dữ liệu không đồng bộ vào cache rồi ghi vào đĩa theo từng chu kỳ
- **Ghi log**: Lưu dữ liệu vào buffer trước khi chuyển đến hệ thống lưu trữ chính
- **Ứng dụng tin nhắn**: Đồng bộ tin nhắn giữa local storage với cloud


## Kết luận

**Cache là một công cụ mạnh mẽ nhưng đòi hỏi sự hiểu biết sâu sắc.**

**4 nguyên tắc cơ bản:**

1. 🎯 **Chỉ cache khi cần**
   - Đánh giá hiệu suất trước khi thêm cache
   - Đừng thêm cache vào khi chưa đo lường được hệ thống chậm ở đâu

2. 📊 **Tối ưu Hit Rate**
   - Hãy cố gắng đạt **85% trở lên**
   - Đây là điểm cân bằng giữa hiệu suất và tài nguyên

3. 🔄 **Quản lý TTL**
   - Đảm bảo dữ liệu không bị cũ
   - Phải có kế hoạch xóa dữ liệu cũ (TTL hoặc sự kiện xóa)

4. 📈 **Theo dõi liên tục**
   - Luôn dùng các công cụ monitor như **Prometheus**
   - Biết cache của mình đang 'khỏe' hay 'yếu'


**Lựa chọn đúng chiến lược cache cho từng tình huống sẽ quyết định thành bại của hệ thống.**
