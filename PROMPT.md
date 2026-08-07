# LayeredComp / InfiniteCPU

交互式计算机体系结构模拟器：像《我的世界》/《泰拉瑞亚》的红石电脑一样，用逻辑方块从零搭建可运行的 CPU，不依赖任何游戏本体。

## 当前状态

| 模块 | 状态 |
|---|---|
| 内核：基础元件 + 导线网络 | ✅ 完成 |
| 内核：元件旋转 + 预制体布线器 | ✅ 完成 |
| 预制体：NAND / AND / OR / XOR | ✅ 完成（真值表验证） |
| 复合块：半加器 | ✅ 完成（真值表验证） |
| 复合块：D 触发器（内核时序） | ✅ 完成（上升沿锁存验证） |
| 复合块：MUX | ✅ 完成（真值表验证） |
| 复合块 / 子系统 / CPU | ⏳ 未开始 |
| 工作台 UI 与默认演示电路 | ✅ 完成 |

## 技术栈

| 层 | 技术 | 职责 |
|---|---|---|
| UI | React + Vite | 布局、控制面板、事件 |
| 语言 | TypeScript（strict） | 全部代码 |
| 渲染 | PixiJS v8 | WebGL 2D 方块渲染、缩放画布 |

## 架构

```
React App（组件栏 / 控制面板 / 交互）
        │
Render（PixiJS：方块视图、导线视图、点阵背景）
        │
Kernel（纯 TS：World 网格、网络 OR、元件 tick）
```

约束：kernel 零 PixiJS/DOM 依赖（MVC 分离，违规拒绝）。

## 核心模型

- **网格世界**：元件与导线占据格子，相邻格子沿 4 向正交连通。
- **导线网络**：同一连通网络的信号值 = 所有接入输出的 OR（并线），驱动所有接出的输入；任意位置分叉 / 合并。
- **元件是边界**：输入侧与输出侧网络永不合并；信号只经元件内部逻辑传递。
- **基础元件（方案 B）**：NOT（左入右出）+ 导线（被动导体）+ 信号源 Vcc(1) / Gnd(0) / Clock。
- **元件旋转**：每个元件可旋转 0/90/180/270°（quarter turns），引脚随朝向变化；预制体可整体旋转。
- **复杂元件 = NOT 组合（预制体）**：新建时生成多个已连线的独立 NOT，组合内每个方块可拖动、重连、删除。
- **step 语义（三相）**：① 组合逻辑在时钟保持下收敛；② 时钟沿（Clock 翻转，
  Dff 在上升沿锁存 d）；③ 沿后状态收敛。Dff = 边沿触发寄存器（内核状态元件）。

## 目录结构

```
src/
├── kernel/            # 模拟内核（纯 TS）
│   ├── core/          # BaseComponent, Pin, PinImplementation, types
│   ├── gates/         # Not
│   ├── sources/       # Vcc, Gnd, Clock
│   └── world/         # World（网格+网络）, prefabs（NAND/AND/OR + XOR 布线器）
│                       #   布线器：A*（随机扰动） + 拆线重布（rip-up），种子可复现
├── render/            # PixiJS 渲染
│   ├── components/    # 各元件视图, GridBackground, WireView
│   ├── theme.ts       # 灰阶 + 低饱和色主题
│   └── utils/         # snap
├── app/               # React
│   └── components/    # ComponentPalette, ControlPanel
└── main.tsx
scripts/
├── verify-prefabs.ts  # 预制体真值表验证（node --experimental-loader scripts/resolve-ts.mjs）
├── verify-dff.ts      # D 触发器上升沿锁存与数据跟随验证
└── resolve-ts.mjs     # Node 原生 TS 加载器（补 .ts 扩展名）
```

## 交互

- **放置**：组件栏拖出元件 / 预制体；半透明落点预览吸附格子（占用时变暗）。
- **移动**：拖动元件半透明跟随，目标格高亮；占用则回退原位。
- **导线**：Wire 工具模式，左键拖动连续绘制（Bresenham 补格），单击放一格；Esc 退出。
- **擦除**：右键单击删一格；按住右键拖动连续擦除沿线导线；元件右键单击删除。
- **运行**：Run / Step / Reset / Speed 控制面板。

## 视觉规范

- 方块式元件，禁止 D 形符号；输入 / 输出分居两侧边缘，连接点为小灰点。
- 背景深灰 + 浅灰点阵（仅交叉点，无线）。
- NOT 与导线灰阶：0 = 50% 灰，1 = 75% 灰。
- 有源元件低饱和色（饱和 32/255，亮度 50%/75%）：Vcc 绿、Gnd 蓝、Clock 琥珀。
- 导线：分段线 + 弯折 / T / 十字中心接点，按信号变灰阶。

## 路线图

1. ✅ v0.1：基础元件 + 导线网络 + 工作台
2. ✅ 复杂元件预制体（NAND / AND / OR / XOR 完成；XOR 采用 4 个方形宽 NAND +
   手写通道布局：a 左通道、b 直下、X 上下双分支、Y1/Y2 分列 16/18 通道）
3. 🚧 复合块：半加器 ✅、D 触发器 ✅、MUX ✅（3 宽 NAND + 外圈通道布局）；
   译码器：结构已定（4 个 AND + NOTa/NOTb，纯端口扇出保纯净）；
   已实现通用组合器 composePrefab（A* + 随机化 + 拆 1/2 条网重布），
   对多扇出网络仍死锁（50 种子全失败，含方形宽 AND + 旋转变体）——
   需真正的轨道分配算法；全加器抽头合并同样被 a 网 L 形封锁，同一瓶颈
4. ⏳ 子系统：ALU、寄存器堆、PC、RAM、CPU
5. ⏳ 拆解 / 从零搭建模式；Hack 风格默认计算机

## 验证

- `scripts/verify-prefabs.ts`：NAND / AND / OR 全输入组合真值表（纯 TS，Node 运行）。
- 布线器自检：`scripts/debug-xor-single.ts`（XOR 六条网各自单独路由均成功）。
- Playwright（MCP / CLI 截图）验证界面渲染与交互。

## 默认演示电路

打开即自动运行（速度 2）：
- 静态参考行：`Vcc → NOT → NOT → (Gnd 并线收尾)`。
- 动态行：`Clock → NOT×4 → (Gnd 并线收尾)`，随 Clock 节奏整链明暗交替。
