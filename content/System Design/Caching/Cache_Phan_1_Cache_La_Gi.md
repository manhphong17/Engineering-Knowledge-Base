---
title: "Cache Design (Phần 1) - Cache là gì và tại sao nó ở khắp nơi"
date: "2026-04-23"
tags:
  - system-design
  - caching
  - backend
  - performance
  - distributed-systems
---

# Cache — Tại sao nó xuất hiện ở khắp nơi?

**Cache** là một trong những khái niệm cơ bản nhất nhưng cũng dễ gây rối nhất trong hệ thống máy tính. 
Nó có mặt ở khắp nơi: từ CPU nhỏ bé cho đến các hệ thống toàn cầu. 
Hiểu rõ tại sao cần cache và những đánh đổi của nó là chìa khóa để xây dựng hệ thống chạy nhanh và mượt mà.


## Phần I: Hiểu cache từ gốc rễ

### 1. Cache là gì, nói ngắn gọn

Cache là một trong những khái niệm vừa cơ bản nhưng cũng vừa dễ gây rối rắm nhất trong giới máy tính.

Nó có mặt ở khắp nơi:
- Từ những con chip CPU nhỏ bé
- Cho đến các hệ thống toàn cầu

Phần này sẽ giúp bạn hiểu:
- **Cache là gì**
- **Tại sao nó quan trọng**
- **Nó nằm ở đâu trong hệ thống**


### 2. Vì sao cần cache? Vì tốc độ không đồng đều

#### 2.1 CPU đợi RAM — khoảng cách còn lớn hơn bạn nghĩ

Hầu hết chúng ta không nhận ra rằng: **CPU nhanh hơn bộ nhớ (RAM) hàng trăm lần**.

<div align="center">
  <img src="/images/system_design/cache/2.1.png" alt="Sơ đồ 2.1" />
</div>


#### 2.2 Phân tầng bộ nhớ — cái nào cần gấp thì để gần

Vì không thể làm cho mọi bộ nhớ đều nhanh như CPU (vì quá đắt), chúng ta chia dữ liệu thành nhiều tầng:

- **Cái nào cần gấp** → để ở chỗ **nhanh** (nhưng nhỏ)
- **Cái nào ít dùng** → để ở chỗ **chậm** (nhưng lớn)


#### 2.3 Tại sao cache hiệu quả — tính cục bộ của dữ liệu

<div align="center">
  <img src="/images/system_design/cache/2.3.png" alt="Sơ đồ 2.3" />
</div>

### 3. Cache không miễn phí — luôn có đánh đổi

<div align="center">
  <img src="/images/system_design/cache/3.png" alt="Sơ đồ 3" />
</div>


### 4. Cache xuất hiện ở đâu trong hệ thống?

<div align="center">
  <img src="/images/system_design/cache/4.png" alt="Sơ đồ 4" />
</div>

