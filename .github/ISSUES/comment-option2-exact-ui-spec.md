### 🎨 Approved UI/UX Design Specification: Option 2 (Executive Wide Banner) for Issue #142

**Status**: ✅ APPROVED by User & Owner. **Option 2 (Executive Wide Banner)** is selected as the official frontend layout for **Issue #142**.

---

## 🖼️ Approved Visual Design Mockup

![Kiwi Coach Option 2 Executive Wide Banner Mockup](/Users/heminghan/.gemini/antigravity/brain/2c882710-d5d6-4330-bf37-ed9170d45847/kiwi_dashboard_option2_wide_banner_1785467122191.jpg)

---

## 📐 精確 UI 組件規格與 CSS/Tailwind 參數對照表 (Exact UI Parameters)

為了保證最終實作的 Dashboard 與 Approved Mockup 圖片 100% 一致，特將組件結構、CSS 類別、HEX 色碼與資料對接欄位詳細規範如下：

### 1. Banner 容器位址與佈局 Grid (Container Placement)
- **版面位置**：插在中段 3 Stats Cards (`TOTAL SESSIONS`, `AVG. SCORE`, `LATEST ROLE`) 與 `Session History` 表格之間的全寬度 (Full-Width) 區域。
- **Tailwind Class**: `w-full bg-white rounded-2xl border border-emerald-100/60 p-6 shadow-sm my-6`
- **內層 Grid Layout**: `grid grid-cols-1 lg:grid-cols-12 gap-6 items-center`

---

### 2. 子組件 1：職缺覆蓋率甜甜圈圓環圖 (`lg:col-span-4`)
- **組件名稱**：`<ReadinessDonutChart />`
- **圖表類型**：SVG / Recharts Donut Chart (`innerRadius: 60`, `outerRadius: 80`, `startAngle: 90`, `endAngle: -270`)。
- **配色**：
  - 已完成區段：`#84CC16` (Lime Green)
  - 未完成區段：`#E5E7EB` (Light Gray)
- **中央指標文字**：
  - 大字：`78%` (`text-3xl font-bold text-gray-900`)
  - 標籤：`Role Coverage` (`text-xs text-gray-500 font-medium uppercase tracking-wider`)
- **就緒度階梯 Badge**：
  - 樣式：`bg-[#DCFCE7] text-[#15803D] text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200`
  - 文字：`Stage 3: Consistently Demonstrated`

---

### 3. 子組件 2：實證質地演變堆疊條形圖 (`lg:col-span-4`)
- **組件名稱**：`<EvidenceEvolutionBarChart />`
- **圖表類型**：100% 橫向/縱向 Stacked Bar Chart (展示歷次同質 Session 演變)。
- **配色彩色對照 (Strict Original Palette)**：
  - `Direct Past Experience` (真實經歷)：`#84CC16` (Solid Lime Green)
  - `Adjacent Experience` (相關經驗)：`#86EFAC` (Soft Mint Green)
  - `Hypothetical Answers` (假設性空話)：`#94A3B8` (Slate Gray)
  - `Generic Filler` (通用贅述)：`#E2E8F0` (Light Gray)
- **頂部數值標示**：`85% Direct Past Evidence` vs `15% Hypothetical`

---

### 4. 子組件 3：專案故事與能力矩陣熱力圖 (`lg:col-span-4`)
- **組件名稱**：`<StoryCompetencyHeatmap />`
- **標題**：`Story Competency Matrix (專案故事與能力矩陣)`
- **矩陣結構**：
  - **縱軸 (Rows)**：專案故事（如 *React Chatbot PoC*, *NZ Clinic Data Migration*, *Team Conflict Scenario*）。
  - **橫軸 (Cols)**：核心能力（*Frontend API*, *System Design*, *NZ Communication*）。
- **單元格 Status Badges**：
  - 🟢 **`Yes / Strong`**：`bg-[#DCFCE7] text-[#15803D] text-xs font-medium px-2 py-0.5 rounded`
  - 🟡 **`Low / Needs Practice`**：`bg-[#FEF9C3] text-[#A16207] text-xs font-medium px-2 py-0.5 rounded`
  - ⚪ **`Unavailable`**：`bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded`

---

### 5. 嚴格原有 HEX 色碼規範 (Strict Palette Lock)

| 視覺元素 | HEX 色碼 / Tailwind Class | 說明 |
| :--- | :--- | :--- |
| **頁面底色** | `#F4FAF6` / `bg-[#F4FAF6]` | 淺淡薄荷綠背景 |
| **卡片背景** | `#FFFFFF` / `bg-white` | 純白圓角卡片 (無浮誇 Glow) |
| **主強調色 / 柱體** | `#84CC16` / `bg-[#84CC16]` | 萊姆綠 (Lime Green) |
| **軟綠 Pills (Ready)** | `#DCFCE7` (底) / `#15803D` (字) | `Completed` / `Stage 3` 徽章 |
| **軟黃 Pills (Paused)** | `#FEF9C3` (底) / `#A16207` (字) | `Needs Practice` 徽章 |
| **主要文字** | `#111827` / `text-gray-900` | 大標題與數據數字 |
| **次要文字** | `#4B5563` / `text-gray-600` | 說明文字與圖例 |

---

### 🔒 6. 保留原有 8 大板塊對照 (100% Zero-Deletion)

本 Issue 的 Banner 插入絕不移除或修改以下任何原版區塊：
1. `Header` (Logo, PRACTICE WORKSPACE, profile)
2. `Start a practice session` & `Saved setup`
3. `Recent Activity`
4. `Stats Row` (Total Sessions 20 / Avg Score 44 / Latest Role)
5. `Quick tips (NZ FOCUS)`
6. `Session History` 表格
7. `AI Usage Cost` 卡片
8. `Privacy & Security` 卡片 (Google sign-in, Encrypted Recordings, Privacy Details)

所有參數與組件規格已完整定稿並記錄於 GitHub Issue #142！
