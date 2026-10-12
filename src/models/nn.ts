import { gaussian, mulberry32 } from '../lib/random.ts'

/**
 * A 2 → H → 1 neural network: tanh hidden layer, sigmoid output, binary
 * cross-entropy loss, trained with full-batch gradient descent. Every
 * number shown in the playground comes from these functions.
 */

export type DatasetId = 'xor' | 'circle' | 'blobs'

export interface Dataset {
  x: [number, number][]
  y: number[]
}

export function makeDataset(id: DatasetId, n: number, seed: number): Dataset {
  const rand = mulberry32(seed)
  const x: [number, number][] = []
  const y: number[] = []
  for (let i = 0; i < n; i++) {
    if (id === 'blobs') {
      const cls = i % 2
      const c = cls ? 0.45 : -0.45
      const px = Math.max(-1, Math.min(1, c + gaussian(rand) * 0.28))
      const py = Math.max(-1, Math.min(1, c + gaussian(rand) * 0.28))
      x.push([px, py])
      y.push(cls)
      continue
    }
    let px = rand() * 2 - 1
    let py = rand() * 2 - 1
    if (id === 'xor') {
      // keep a small margin around the axes so the classes are separable
      if (Math.abs(px) < 0.06) px += Math.sign(px || 1) * 0.06
      if (Math.abs(py) < 0.06) py += Math.sign(py || 1) * 0.06
      x.push([px, py])
      y.push(px * py > 0 ? 1 : 0)
    } else {
      x.push([px, py])
      y.push(Math.hypot(px, py) < 0.62 ? 1 : 0)
    }
  }
  return { x, y }
}

export interface Net {
  H: number
  W1: Float64Array // H × 2, row-major
  b1: Float64Array // H
  w2: Float64Array // H
  b2: number
}

export function initNet(H: number, seed: number): Net {
  const rand = mulberry32(seed)
  const W1 = new Float64Array(H * 2)
  const b1 = new Float64Array(H)
  const w2 = new Float64Array(H)
  for (let j = 0; j < H; j++) {
    W1[j * 2] = gaussian(rand) * 1.2
    W1[j * 2 + 1] = gaussian(rand) * 1.2
    b1[j] = gaussian(rand) * 0.3
    w2[j] = gaussian(rand) / Math.sqrt(H)
  }
  return { H, W1, b1, w2, b2: 0 }
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export function predict(net: Net, x0: number, x1: number): number {
  let z2 = net.b2
  for (let j = 0; j < net.H; j++) {
    z2 += net.w2[j] * Math.tanh(net.W1[j * 2] * x0 + net.W1[j * 2 + 1] * x1 + net.b1[j])
  }
  return sigmoid(z2)
}

function bce(p: number, y: number) {
  const eps = 1e-12
  return -(y * Math.log(p + eps) + (1 - y) * Math.log(1 - p + eps))
}

export function evaluate(net: Net, data: Dataset) {
  let loss = 0
  let correct = 0
  for (let i = 0; i < data.x.length; i++) {
    const p = predict(net, data.x[i][0], data.x[i][1])
    loss += bce(p, data.y[i])
    if ((p >= 0.5 ? 1 : 0) === data.y[i]) correct++
  }
  return { loss: loss / data.x.length, accuracy: correct / data.x.length }
}

export interface Gradients {
  W1: Float64Array
  b1: Float64Array
  w2: Float64Array
  b2: number
}

/** Mean gradients of the loss over the whole dataset (backpropagation). */
export function gradients(net: Net, data: Dataset): Gradients {
  const { H } = net
  const g: Gradients = { W1: new Float64Array(H * 2), b1: new Float64Array(H), w2: new Float64Array(H), b2: 0 }
  const h = new Float64Array(H)
  const n = data.x.length
  for (let i = 0; i < n; i++) {
    const [x0, x1] = data.x[i]
    let z2 = net.b2
    for (let j = 0; j < H; j++) {
      h[j] = Math.tanh(net.W1[j * 2] * x0 + net.W1[j * 2 + 1] * x1 + net.b1[j])
      z2 += net.w2[j] * h[j]
    }
    const dz2 = sigmoid(z2) - data.y[i] // d(BCE)/dz2 for a sigmoid output
    g.b2 += dz2
    for (let j = 0; j < H; j++) {
      g.w2[j] += dz2 * h[j]
      const dz1 = dz2 * net.w2[j] * (1 - h[j] * h[j])
      g.W1[j * 2] += dz1 * x0
      g.W1[j * 2 + 1] += dz1 * x1
      g.b1[j] += dz1
    }
  }
  g.b2 /= n
  for (let j = 0; j < H; j++) {
    g.w2[j] /= n
    g.b1[j] /= n
    g.W1[j * 2] /= n
    g.W1[j * 2 + 1] /= n
  }
  return g
}

/** One gradient-descent update, in place. */
export function trainStep(net: Net, data: Dataset, lr: number) {
  const g = gradients(net, data)
  net.b2 -= lr * g.b2
  for (let j = 0; j < net.H; j++) {
    net.w2[j] -= lr * g.w2[j]
    net.b1[j] -= lr * g.b1[j]
    net.W1[j * 2] -= lr * g.W1[j * 2]
    net.W1[j * 2 + 1] -= lr * g.W1[j * 2 + 1]
  }
}
