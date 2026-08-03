# LayeredComp / InfiniteCPU

交互式计算机体系结构模拟器：像《我的世界》/《泰拉瑞亚》的红石电脑一样，用逻辑方块从零搭建可运行的 CPU，不依赖任何游戏本体。

## 特性

- 方块式逻辑元件：NOT、信号源 Vcc / Gnd / Clock
- 导线网络：摆放导线方块，支持任意分叉与并线（OR），T / 十字接点可视化
- 连续绘制与擦除：左键拖动画导线，右键拖动橡皮擦
- 复杂元件预制体：NAND / AND / OR 由 NOT 组合自动生成（真值表验证）
- 默认演示电路：打开即自动运行，展示 Clock 驱动的反相链
- 低饱和灰阶界面：深灰背景 + 点阵网格，低对比度

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 构建
npm run lint     # 检查
```

## 使用

1. 从左侧拖出元件到画布（NOT / Vcc / Gnd / Clock / NAND / AND / OR）。
2. 点 **Wire** 进入导线模式，按住左键拖动绘制导线；单击放一格，Esc 退出。
3. 右键单击删除一格；按住右键拖动连续擦除沿线导线。
4. 用 **Run** 运行、**Step** 单步、**Reset** 清空、**Speed** 调速。

## 模拟模型

- 信号只有 0 / 1；0 = 50% 灰，1 = 75% 灰（有源元件为对应低饱和色）。
- 导线网络值 = 所有接入输出的 OR；元件是输入 / 输出网络之间的边界。
- Clock 每步翻转一次，驱动组合逻辑链。

## 项目结构

```
src/
├── kernel/            # 模拟内核（纯 TS，无渲染依赖）
│   ├── core/          # BaseComponent, Pin, PinImplementation, types
│   ├── gates/         # Not
│   ├── sources/       # Vcc, Gnd, Clock
│   └── world/         # World（网格+网络）, prefabs
├── render/            # PixiJS 渲染（方块/导线/点阵背景/主题）
├── app/               # React（组件栏、控制面板）
└── main.tsx
scripts/
└── verify-prefabs.ts  # 预制体真值表验证
```

## 技术栈

React + Vite · TypeScript（strict）· PixiJS v8

## 当前进度

- ✅ 基础元件与导线网络
- ✅ 工作台交互（拖放 / 画线 / 擦除 / 运行控制）
- ✅ NAND / AND / OR 预制体（真值表验证）
- 🚧 XOR 预制体布线
- ⏳ 复合块（半加器、D 触发器、MUX…）、子系统（ALU、RAM、CPU）

## 许可证

MIT
