// 主题：背景/导线/NOT 保持灰阶；有源元件用低饱和度颜色区分（饱和度 ~64/255，
// 亮度保持 50%/75% 不变，对应信号 0/1）。
function hslToHex(h: number, s: number, l: number): number {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const hp = h / 60
    const x = c * (1 - Math.abs((hp % 2) - 1))
    let r = 0
    let g = 0
    let b = 0
    if (hp < 1) { r = c; g = x }
    else if (hp < 2) { r = x; g = c }
    else if (hp < 3) { g = c; b = x }
    else if (hp < 4) { g = x; b = c }
    else if (hp < 5) { r = x; b = c }
    else { r = c; b = x }
    const m = l - c / 2
    const rr = Math.round((r + m) * 255)
    const gg = Math.round((g + m) * 255)
    const bb = Math.round((b + m) * 255)
    return (rr << 16) | (gg << 8) | bb
}

const SAT = 32 / 255 // 用户指定饱和度 ~32/256（低饱和）

export const COLORS = {
    background: 0x1c1c1c, // 画布深灰背景
    grid: 0x3f3f3f, // 浅灰网格线
    blockBorder: 0x4f4f4f, // 方块描边
    pinDot: 0x6b6b6b, // 连接点小灰点
    off: 0x808080, // 信号 0 = 50% 灰
    on: 0xbfbfbf, // 信号 1 = 75% 灰
    wireOff: 0x808080,
    wireOn: 0xbfbfbf,
} as const

// 不同元件的低饱和色：off = 信号 0（亮度 50%），on = 信号 1（亮度 75%）
export const COMPONENT_COLORS: Record<string, { off: number; on: number }> = {
    Vcc: { off: hslToHex(120, SAT, 0.5), on: hslToHex(120, SAT, 0.75) },
    Gnd: { off: hslToHex(240, SAT, 0.5), on: hslToHex(240, SAT, 0.75) },
    Clock: { off: hslToHex(30, SAT, 0.5), on: hslToHex(30, SAT, 0.75) },
}

export const CSS = {
    background: '#1c1c1c',
    panel: '#222222',
    panelBorder: '#3c3c3c',
    text: '#9a9a9a',
    signal0: '#808080',
    signal1: '#bfbfbf',
    blockBorder: '#4f4f4f',
    button: '#333333',
    buttonBorder: '#555555',
    buttonText: '#bbbbbb',
    ghostFill: '#bfbfbf',
    ghostBorder: '#4f4f4f',
} as const
