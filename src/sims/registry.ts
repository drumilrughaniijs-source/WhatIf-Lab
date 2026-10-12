import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { CategoryId, Level } from '../lib/categories'

export interface SimProps {
  accent: string
}

export interface SimMeta {
  id: string
  title: string
  category: CategoryId
  /** The "What if…?" hook. */
  question: string
  summary: string
  tags: string[]
  level: Level
  /** Core experiments are featured on the home page and listed first. */
  core?: boolean
  concept: string
  /** Model and assumptions, shown on the experiment page. */
  model: string[]
  tryThis: string[]
  component: LazyExoticComponent<ComponentType<SimProps>>
}

export const SIMS: SimMeta[] = [
  /* ============================================================ core six */
  {
    id: 'ram-pressure',
    title: 'RAM Pressure Lab',
    category: 'computing',
    core: true,
    question: 'What if you opened one more app than your memory can hold?',
    summary: 'Model how capacity, per-app memory and the number of running apps push a computer into swapping, and what that does to responsiveness.',
    tags: ['memory', 'swap', 'operating systems'],
    level: 'Beginner',
    concept:
      'Running programs keep their working data in RAM. When demand exceeds capacity, the operating system moves the least-used memory pages to disk (swap). Disk is thousands of times slower than RAM, so even a small share of memory accesses landing in swap can make the whole system feel frozen. This is called thrashing.',
    model: [
      'Demand = 1.5 GB reserved for the OS and background services + (apps × average memory per app). Every app is assumed to use the same amount.',
      'Utilisation = demand ÷ capacity. Anything above capacity is "overflow" and is assumed to be paged out to swap.',
      'Below 70% utilisation responsiveness is 100%. Between 70% and 100% it falls to 85% as the OS gives up its file cache.',
      'Above 100%: 10% of swapped memory is assumed to still be in active use. Effective access time = (1 − p)·100 ns + p·t_swap, where p is the share of accesses that hit swap and t_swap is 80 µs (SSD) or 8 ms (HDD).',
      'Real systems also compress memory, share libraries between apps and kill background processes. None of that is modelled. This lab does not read or measure your computer\'s memory.',
    ],
    tryThis: [
      'With 8 GB of RAM, find how many 1 GB apps fit before swapping starts.',
      'Push demand just 10% past capacity, then switch the swap device from SSD to HDD.',
      'Double the capacity. Does doubling the number of apps return you to the same state?',
    ],
    component: lazy(() => import('./computing/RamPressure')),
  },
  {
    id: 'cpu-performance',
    title: 'CPU Performance Explorer',
    category: 'computing',
    core: true,
    question: 'What if you doubled your CPU cores? Would programs run twice as fast?',
    summary: 'Estimate throughput from clock speed, core count, workload size and how parallel the work is, and see where adding cores stops helping.',
    tags: ['Amdahl’s law', 'parallelism', 'hardware'],
    level: 'Intermediate',
    concept:
      'Doubling cores only helps the part of a program that can run in parallel. Amdahl\'s law says the serial part sets a hard ceiling on speed-up: if 10% of the work is serial, no number of cores can make it more than 10× faster. In practice, the clock drops as more cores get busy, and cores spend time coordinating, so returns diminish even sooner.',
    model: [
      'Single-core speed = 3 instructions per cycle × clock frequency (a fixed, typical IPC).',
      'The serial fraction (1 − p) runs on one core at the full clock. The parallel fraction p is split evenly across N cores.',
      'All-core clock drops 0.4% per additional active core (maximum 25% drop) to approximate power and thermal limits.',
      'Coordination overhead adds 0.05% of the parallel work per additional core (locks, cache traffic, communication).',
      'Memory bandwidth, caches, SIMD, hyper-threading and turbo behaviour are not modelled. These are simulated estimates, not hardware benchmarks.',
    ],
    tryThis: [
      'Set parallelisability to 50%. How much faster is 64 cores than 8?',
      'Find the core count where adding more cores starts to make the workload slower.',
      'Compare a 4-core 5 GHz CPU with a 16-core 3 GHz CPU on a 70% parallel workload.',
    ],
    component: lazy(() => import('./computing/CpuPerformance')),
  },
  {
    id: 'neural-network',
    title: 'Neural Network Playground',
    category: 'ai',
    core: true,
    question: 'What if you could watch a neural network learn, one step at a time?',
    summary: 'Train a real two-layer network with gradient descent and watch its weights, decision boundary and loss change as it learns.',
    tags: ['neural networks', 'backpropagation', 'training'],
    level: 'Advanced',
    concept:
      'A neural network is a function with adjustable weights. Training measures how wrong its predictions are (the loss), computes how each weight affects that loss (backpropagation), and nudges every weight slightly downhill (gradient descent). Repeat this thousands of times and the network bends its decision boundary to separate the classes.',
    model: [
      'Architecture: 2 inputs → H hidden neurons (tanh) → 1 output neuron (sigmoid), where H is adjustable from 2 to 8.',
      'Loss: binary cross-entropy averaged over every point (full-batch training).',
      'Each iteration computes exact gradients by backpropagation and updates every weight: w ← w − η·∂L/∂w.',
      'Weights start from a seeded random initialisation, so "Reset" reproduces the same run and "New weights" draws a fresh one.',
      'Accuracy is measured on the same training points; there is no separate test set in this small demo.',
    ],
    tryThis: [
      'Train on XOR with 2 hidden neurons, then with 4. Which one solves it reliably?',
      'Set the learning rate to 5 and watch the loss chart. Then try 0.05.',
      'On the circle dataset, watch which hidden neurons develop the strongest connections.',
    ],
    component: lazy(() => import('./ai/NeuralNetwork')),
  },
  {
    id: 'compound-interest-lab',
    title: 'Compound Interest Lab',
    category: 'finance-math',
    core: true,
    question: 'What if you invested a little every month for 30 years?',
    summary: 'Project an investment from an initial deposit, monthly contributions, an annual rate and a time horizon, with a full year-by-year breakdown.',
    tags: ['compounding', 'investing', 'savings'],
    level: 'Beginner',
    concept:
      'Compound interest means you earn interest on previous interest. Growth is slow at first and then accelerates, so later years often add more than all the early years combined. The rate and the time horizon matter far more than they intuitively seem to.',
    model: [
      'The nominal annual rate r compounded m times per year is converted to an equivalent monthly rate i = (1 + r/m)^(m/12) − 1, so the effective annual yield is exact for each compounding frequency.',
      'Contributions are made every month, at the start or the end of the month (your choice). The initial investment is made at time zero.',
      'The rate is constant for the whole period. Taxes, fees and inflation are not included.',
      'Projections are hypothetical. Real returns vary year to year and are not guaranteed; this is not financial advice.',
    ],
    tryThis: [
      'Compare 20 years and 40 years with the same contribution. How much bigger is the result?',
      'Change compounding from annually to daily. How much difference does it actually make?',
      'Find the monthly contribution that reaches $1,000,000 in 30 years at 7%.',
    ],
    component: lazy(() => import('./finance/CompoundInterestLab')),
  },
  {
    id: 'probability-playground',
    title: 'Probability Playground',
    category: 'probability',
    core: true,
    question: 'What if you flipped a coin 100,000 times? Would it come out exactly 50/50?',
    summary: 'Run coin flips and dice rolls with real random sampling, then compare observed frequencies with theory.',
    tags: ['randomness', 'law of large numbers', 'chi-square'],
    level: 'Beginner',
    concept:
      'Theoretical probability says what to expect in the long run; a finite experiment always deviates from it. The law of large numbers says the observed proportion converges to the true probability as trials increase, but the absolute difference in counts usually grows. A chi-square test measures whether the deviation is larger than chance would explain.',
    model: [
      'Each trial uses fresh random numbers from your browser\'s cryptographic random generator (crypto.getRandomValues), so results are never pre-recorded or repeated.',
      'Dice are fair six-sided dice. The sum of two dice is two independent rolls added together.',
      'The coin can be biased: "probability of heads" sets the true chance of heads used for sampling.',
      'Chi-square goodness of fit compares observed counts with expected counts. A p-value below 0.05 would be unusual if the model were correct, and will still happen about 5% of the time by chance.',
    ],
    tryThis: [
      'Run 10 coin flips several times. How often do you get exactly 5 heads?',
      'Roll two dice 10,000 times. Why is 7 the most common sum?',
      'Bias the coin to 55% heads and find how many flips it takes for the chi-square test to notice.',
    ],
    component: lazy(() => import('./probability/ProbabilityPlayground')),
  },
  {
    id: 'orbital-gravity',
    title: 'Orbital Gravity Playground',
    category: 'physics',
    core: true,
    question: 'What if a planet moved a little faster? Would it escape its star?',
    summary: 'Launch a body around a star, adjust its distance, speed and mass, and watch circular, elliptical and escape trajectories emerge.',
    tags: ['gravity', 'orbits', 'numerical integration'],
    level: 'Intermediate',
    concept:
      'An orbit is a balance between falling and moving sideways. At exactly the circular speed, the body falls around the star at a constant distance. A bit slower or faster gives an ellipse; at √2 times the circular speed it escapes forever. When the two masses are similar, both bodies orbit their shared centre of mass.',
    model: [
      'Two point masses interact by Newtonian gravity in two dimensions. Units: astronomical units (AU), years and solar masses, so G·M☉ = 4π².',
      'The star has one solar mass; "relative mass" sets the companion\'s mass as a fraction of the star.',
      'Motion is integrated with velocity Verlet (kick–drift–kick) using a fixed step of 0.0005 years. This symplectic method keeps energy error small; the energy drift is shown as a check.',
      'Bodies are treated as points. A separation below 0.02 AU is reported as a collision, and the run stops once the bodies are more than 30 AU apart.',
      'Relativity, other planets, tides and drag are ignored.',
    ],
    tryThis: [
      'Click "Circular", then increase the speed by 10%. What shape is the orbit now?',
      'Use "Escape" speed, then reduce it slightly. How far out does the orbit reach?',
      'Set the relative mass to 1 to make a binary star system.',
    ],
    component: lazy(() => import('./physics/OrbitalGravity')),
  },

  /* ========================================================== more labs */
  {
    id: 'sorting-race',
    title: 'Sorting Race',
    category: 'computing',
    question: 'What if four sorting algorithms raced on the same data?',
    summary: 'Animate Bubble, Insertion, Merge and Quick sort side by side and count every comparison and write.',
    tags: ['algorithms', 'animation', 'Big-O'],
    level: 'Beginner',
    concept:
      'Sorting algorithms trade simplicity for speed. Bubble and Insertion sort compare neighbours and do O(n²) work in the worst case, while Merge and Quick sort divide the problem and average O(n log n). The input order matters too: Insertion sort is nearly free on almost-sorted data, while a naive Quick sort degrades on it.',
    model: [
      'Every algorithm really sorts the same array; each comparison and write is recorded and replayed.',
      'All four perform the same number of operations per animation frame, so finishing order reflects total work.',
      'Quick sort uses a last-element pivot (Lomuto partition) on purpose, to show its worst case.',
    ],
    tryThis: [
      'Switch the input to "Nearly sorted". Which algorithm suddenly wins?',
      'Use "Reversed" input and compare Insertion vs Merge sort.',
      'Double the array size and see how much the comparison count grows for each algorithm.',
    ],
    component: lazy(() => import('./computing/SortingRace')),
  },
  {
    id: 'big-o',
    title: 'Big-O Growth',
    category: 'computing',
    question: 'What if your input grew a million times bigger?',
    summary: 'Compare O(1) to O(2ⁿ) and translate operation counts into wall-clock time on a computer of a given speed.',
    tags: ['complexity', 'scaling', 'performance'],
    level: 'Beginner',
    concept:
      'Big-O notation describes how the work an algorithm does grows with input size n. Constant factors and hardware speed matter for small inputs, but for large n the growth class dominates: no computer is fast enough to rescue an O(2ⁿ) algorithm.',
    model: [
      'Operation counts are exactly 1, log₂n, n, n·log₂n, n² and 2ⁿ, with every constant factor set to 1.',
      'Time = operations ÷ operations per second. Calculations are done on logarithms so huge values never overflow.',
    ],
    tryThis: [
      'Set n to 60 and look at how long O(2ⁿ) would take. Compare it with the age of the universe.',
      'Make the CPU 1000× faster. How much bigger can n get for O(n²) in one second?',
      'Find the n where O(n log n) and O(n²) differ by 100×.',
    ],
    component: lazy(() => import('./computing/BigO')),
  },
  {
    id: 'gradient-descent',
    title: 'Gradient Descent',
    category: 'ai',
    question: 'What if the learning rate were too big, or too small?',
    summary: 'Drop a ball on a loss landscape and watch it roll towards the minimum, overshoot, or get stuck.',
    tags: ['optimisation', 'learning rate', 'momentum'],
    level: 'Intermediate',
    concept:
      'Neural networks learn by repeatedly stepping downhill on a loss surface: x ← x − η·∇L(x). The learning rate η controls step size. Too small and training crawls; too large and it overshoots and diverges. Momentum carries velocity between steps, helping to roll through flat regions and shallow local minima.',
    model: [
      'One-dimensional loss functions with exact derivatives. Update: v ← βv − η·L′(x), x ← x + v.',
      'Runs stop at 150 steps, when the gradient and velocity are both below 0.001, or when |x| exceeds 50 (diverged).',
    ],
    tryThis: [
      'On the "Bowl" landscape, push the learning rate up until training diverges.',
      'On "Two valleys", start at x = 2.5 and see which minimum you end up in. Now add momentum.',
      'Compare the number of steps to converge with and without momentum.',
    ],
    component: lazy(() => import('./ai/GradientDescent')),
  },
  {
    id: 'kmeans',
    title: 'K-Means Clustering',
    category: 'ai',
    question: 'What if you asked an AI to find groups without telling it what they are?',
    summary: "Unsupervised learning in action: step through Lloyd's algorithm as centroids hunt for clusters.",
    tags: ['unsupervised', 'clustering', 'iteration'],
    level: 'Beginner',
    concept:
      'K-means alternates two steps: assign each point to its nearest centroid, then move every centroid to the mean of its points. It always converges, but only to a local optimum. The answer depends on where the centroids start and on choosing k well. Inertia (the total squared distance to centroids) measures how tight the clusters are.',
    model: [
      'Data are Gaussian blobs generated from a seed, so a saved experiment reproduces the same points.',
      'Standard Lloyd iterations until centroids stop moving (or 40 iterations).',
      'k-means++ picks each new starting centroid with probability proportional to its squared distance from existing ones.',
    ],
    tryThis: [
      'Set k higher than the true number of blobs. What does the algorithm do with the extra centroids?',
      'Increase the spread until blobs overlap. Do the clusters still make sense?',
      'Re-initialise the centroids a few times on the same data. Do you always get the same answer?',
    ],
    component: lazy(() => import('./ai/KMeans')),
  },
  {
    id: 'projectile',
    title: 'Projectile on Other Worlds',
    category: 'physics',
    question: 'What if you threw a ball on the Moon, Mars, or Jupiter?',
    summary: 'Launch projectiles under different gravity and air resistance and compare their arcs.',
    tags: ['kinematics', 'gravity', 'drag'],
    level: 'Beginner',
    concept:
      'Without air, a projectile follows a perfect parabola: range = v²·sin(2θ)/g, so the maximum is at 45°. Gravity scales everything: on the Moon (g = 1.62 m/s²) the same throw goes about six times farther. Air drag (proportional to v²) steals energy and pulls the optimal angle below 45°.',
    model: [
      'A baseball (0.145 kg, 7.3 cm diameter, drag coefficient 0.47) with quadratic drag F = ½ρC_dAv².',
      'Surface gravity and air density for each world; Jupiter uses the density near its 1-bar level.',
      'Integrated with semi-implicit Euler at 2 ms steps; wind and spin are ignored.',
    ],
    tryThis: [
      'Compare the 45° range on Earth and the Moon. Is it exactly 6× farther?',
      'Turn on drag and search for the angle that maximises range.',
      'Throw almost straight up on Jupiter. How long is the flight?',
    ],
    component: lazy(() => import('./physics/Projectile')),
  },
  {
    id: 'pendulum',
    title: 'Pendulum Lab',
    category: 'physics',
    question: 'What if a pendulum swung forever, or had friction?',
    summary: 'A real-time numerically integrated pendulum with damping, adjustable length, gravity and amplitude.',
    tags: ['oscillation', 'energy', 'numerical integration'],
    level: 'Intermediate',
    concept:
      "For small swings a pendulum's period is T = 2π√(L/g), independent of amplitude, the property that made pendulum clocks possible. At large amplitudes this approximation breaks down and the period grows. Damping drains energy exponentially, shrinking the swing while barely changing its rhythm.",
    model: [
      'Full non-linear equation θ″ = −(g/L)·sin θ − c·θ′, integrated with 4th-order Runge–Kutta at 1 ms steps.',
      'The exact period uses the arithmetic–geometric mean formula; the measured period comes from successive zero crossings.',
    ],
    tryThis: [
      'Quadruple the length. Does the period double?',
      'Start at 170° and compare the measured period with the small-angle formula.',
      'Add damping and watch kinetic and potential energy trade places as they fade.',
    ],
    component: lazy(() => import('./physics/Pendulum')),
  },
  {
    id: 'monte-carlo-pi',
    title: 'Monte Carlo π',
    category: 'probability',
    question: 'What if you could calculate π by throwing random darts?',
    summary: 'Scatter random points into a square and estimate π from how many land inside the circle.',
    tags: ['probability', 'randomness', 'convergence'],
    level: 'Beginner',
    concept:
      'A quarter circle of radius 1 covers π/4 of the unit square. Throw points uniformly at random, and the fraction landing inside the circle approaches π/4, so 4 × (fraction) estimates π. The error shrinks like 1/√N: to get one more correct digit you need 100× more darts.',
    model: [
      'Points are uniform in the unit square. The ±2σ band uses the binomial standard error 4·√(p(1 − p)/N) with p = π/4.',
    ],
    tryThis: [
      'Throw 1,000 darts and note the error. How many do you need for 10× better?',
      'Watch the convergence chart. Does the estimate approach π smoothly or wobble?',
      'Start a new run and compare runs at the same N.',
    ],
    component: lazy(() => import('./math/MonteCarloPi')),
  },
  {
    id: 'fourier',
    title: 'Fourier Builder',
    category: 'finance-math',
    question: 'What if any shape could be built from sine waves?',
    summary: 'Stack rotating circles (epicycles) to draw square, sawtooth and triangle waves from pure sinusoids.',
    tags: ['series', 'waves', 'signals'],
    level: 'Advanced',
    concept:
      "Fourier's insight: any periodic signal is a sum of sine waves at integer multiples of a base frequency. A square wave uses only odd harmonics with amplitudes 1/n. Adding more terms sharpens the edges, but an ~9% overshoot near each jump (the Gibbs phenomenon) never disappears.",
    model: ['Exact Fourier sine-series coefficients for each waveform, summed up to the chosen number of non-zero terms.'],
    tryThis: [
      'Build a square wave with 1, 3, then 25 terms. Watch the corners sharpen.',
      'Look closely at the jump with many terms: the overshoot never goes away.',
      'Compare how quickly the triangle wave converges versus the square wave.',
    ],
    component: lazy(() => import('./math/Fourier')),
  },
  {
    id: 'compound-interest',
    title: 'Early vs Late Investor',
    category: 'finance-math',
    question: 'What if you started investing 10 years earlier?',
    summary: 'Compare two investors with different start ages and see the power of compounding, after inflation.',
    tags: ['compounding', 'inflation', 'retirement'],
    level: 'Beginner',
    concept:
      'Because growth is exponential, money invested early has far more time to multiply: the last decade of a 40-year plan often adds more than the first three combined. Inflation erodes purchasing power, so the real (inflation-adjusted) value tells the honest story.',
    model: [
      'Monthly contributions with the annual return converted to an equivalent monthly rate; both investors stop at 65.',
      'Constant return and inflation; no taxes or fees. Hypothetical projections, not financial advice.',
    ],
    tryThis: [
      'Make the late starter invest twice as much per month. Do they catch up?',
      'Drop the return from 7% to 4%. How much does the early-start advantage shrink?',
      "Toggle inflation adjustment to see the final balance in today's money.",
    ],
    component: lazy(() => import('./finance/CompoundInterest')),
  },
  {
    id: 'loan-payoff',
    title: 'Loan Payoff Planner',
    category: 'finance-math',
    question: 'What if you paid a little extra on your loan every month?',
    summary: 'Amortise a loan and see how extra payments cut years off the term and thousands off the interest.',
    tags: ['amortisation', 'debt', 'interest'],
    level: 'Intermediate',
    concept:
      'Loan payments are front-loaded with interest: early on, most of each payment pays the lender rather than the balance. Every extra dollar goes straight to principal, which reduces all future interest, so small, early overpayments have an outsized effect.',
    model: [
      'Standard fixed-rate amortisation with monthly payments: P·r/(1 − (1 + r)^−n), r = APR/12.',
      'Extra payments are applied to principal every month. No fees, escrow or prepayment penalties.',
    ],
    tryThis: [
      'Add $100/month on a 30-year mortgage. How many years disappear?',
      'Compare the interest saved at 3% vs 8% rates for the same extra payment.',
      'Find the extra payment that halves the total interest.',
    ],
    component: lazy(() => import('./finance/LoanPayoff')),
  },
]

export const simById = (id: string) => SIMS.find((s) => s.id === id)
export const CORE_SIMS = SIMS.filter((s) => s.core)
