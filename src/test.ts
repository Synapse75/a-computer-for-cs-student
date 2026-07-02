import { Vcc } from './kernel/sources/Vcc'
import { Gnd } from './kernel/sources/Gnd'
import { Nand } from './kernel/gates/Nand'

const vcc = new Vcc()
const gnd = new Gnd()
const nand = new Nand()

// 测试 1: Vcc(1) + Gnd(0) → Nand → 应该输出 1
vcc.pins.get('out')!.subscribe(() => {
  nand.pins.get('in1')!.setValue(vcc.pins.get('out')!.value)
})
gnd.pins.get('out')!.subscribe(() => {
  nand.pins.get('in2')!.setValue(gnd.pins.get('out')!.value)
})

vcc.tick()
gnd.tick()
nand.tick()
console.log('测试 1 - Vcc(1) + Gnd(0):', nand.pins.get('out')!.value, '(期望 1)')

// 测试 2: 两个 Vcc → Nand → 应该输出 0
const vcc2 = new Vcc()
const nand2 = new Nand()

vcc2.pins.get('out')!.subscribe(() => {
  nand2.pins.get('in1')!.setValue(vcc2.pins.get('out')!.value)
  nand2.pins.get('in2')!.setValue(vcc2.pins.get('out')!.value)
})

vcc2.tick()
nand2.tick()
console.log('测试 2 - Vcc(1) + Vcc(1):', nand2.pins.get('out')!.value, '(期望 0)')

// 测试 3: Gnd(0) + Gnd(0) → Nand → 应该输出 1
const gnd3 = new Gnd()
const nand3 = new Nand()

gnd3.pins.get('out')!.subscribe(() => {
  nand3.pins.get('in1')!.setValue(gnd3.pins.get('out')!.value)
  nand3.pins.get('in2')!.setValue(gnd3.pins.get('out')!.value)
})

gnd3.tick()
nand3.tick()
console.log('测试 3 - Gnd(0) + Gnd(0):', nand3.pins.get('out')!.value, '(期望 1)')
