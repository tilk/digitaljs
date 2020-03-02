![][digitaljs-logo]

[![Build Status](https://travis-ci.org/tilk/digitaljs.svg?branch=master)](https://travis-ci.org/tilk/digitaljs)
# DigitalJS

This project is a digital circuit simulator implemented in Javascript.
It is designed to simulate circuits synthesized by hardware design tools
like [Yosys](http://www.clifford.at/yosys/), and it has a companion project
[yosys2digitaljs](https://github.com/tilk/yosys2digitaljs), which converts
Yosys output files to DigitalJS. It is also intended to be a teaching tool,
therefore readability and ease of inspection is one of top concerns for
the project.

You can [try it out online](https://digitaljs.tilk.eu/). The web app is
[a separate Github project](https://github.com/tilk/digitaljs_online/).

# Usage

You can use DigitalJS in your project by installing it from NPM:

```bash
npm install digitaljs
```

Or you can use the [Webpack bundle](https://tilk.github.io/digitaljs/main.js) directly.

To simulate a circuit represented using the JSON input format (described later)
and display it on a `div` named `#paper`, you need to run the following
JS code ([see running example](https://tilk.github.io/digitaljs/test/fulladder.html)):

```javascript
// create the simulation object
const circuit = new digitaljs.Circuit(input_goes_here);
// display on #paper
const paper = circuit.displayOn($('#paper'));
// activate real-time simulation
circuit.start();
```

# Input format

Circuits are represented using JSON. The top-level object has three keys, `devices`,
`connectors` and `subcircuits`. Under `devices` is a list of all devices forming
the circuit, represented as an object, where keys are (unique and internal) device
names. Each device has a number of properties, which are represented by an object.
A mandatory property is `type`, which specifies the type of the device. Example
device:

```javascript
"dev1": {
    "type": "And",
    "label": "AND1"
}
```

Under `connectors` is a list of connections between device ports, represented as an
array of objects with two keys, `from` and `to`. Both keys map to an object with two
keys, `id` and `port`; the first corresponds to a device name, and the second -- to
a valid port name for the device. A connection must lead from an output port to
an input port, and the bitwidth of both ports must be equal. Example connection:

```javascript
{
    "from": {
        "id": "dev1",
        "port": "out"
    },
    "to": {
        "id": "dev2",
        "port": "in"
    }
}
```

Under `subcircuits` is a list of subcircuit definitions, represented as an object,
where keys are unique subcircuit names. A subcircuit name can be used as
a `celltype` for a device of type `Subcircuit`; this instantiates the subcircuit. 
A subcircuit definition
follows the representation of whole circuits, with the exception that subcircuits
cannot (currently) define their own subcircuits. A subcircuit can include
`Input` and `Output` devices, these are mapped to ports on a subcircuit
instance.

## Device types

 * Unary gates: `Not`, `Repeater`
    * Attributes: `bits` (natural number)
    * Inputs: `in` (`bits`-bit)
    * Outputs: `out` (`bits`-bit)
 * Binary gates: `And`, `Nand`, `Or`, `Nor`, `Xor`, `Xnor`
    * Attributes: `bits` (natural number)
    * Inputs: `in1`, `in2` (`bits`-bit)
    * Outputs: `out` (`bits`-bit)
 * Reducing gates: `AndReduce`, `NandReduce`, `OrReduce`, `NorReduce`, `XorReduce`, `XnorReduce`
    * Attributes: `bits` (natural number)
    * Inputs: `in` (`bits`-bit)
    * Outputs: `out` (1-bit)
 * Bit shifts: `ShiftLeft`, `ShiftRight`
    * Attributes: `bits.in1`, `bits.in2` and `bits.out` (natural number), `signed.in1`, `signed.in2`, `signed.out` and `fillx` (boolean)
    * Inputs: `in1` (`bits.in1`-bit), `in2` (`bits.in2`-bit)
    * Outputs: `out` (`bits.out`-bit)
 * Comparisons: `Eq`, `Ne`, `Lt`, `Le`, `Gt`, `Ge`
    * Attributes: `bits.in1` and `bits.in2` (natural number), `signed.in1` and `signed.in2` (boolean)
    * Inputs: `in1` (`bits.in1`-bit), `in2` (`bits.in2`-bit)
    * Outputs: `out` (1-bit)
 * Number constant: `Constant`
    * Attributes: `constant` (binary string)
    * Outputs: `out` (`constant.length`-bit)
 * Unary arithmetic: `Negation`, `UnaryPlus`
    * Attributes: `bits.in` and `bits.out` (natural number), `signed` (boolean)
    * Inputs: `in` (`bits.in`-bit)
    * Outputs: `out` (`bits.out`-bit)
 * Binary arithmetic: `Addition`, `Subtraction`, `Multiplication`, `Division`, `Modulo`, `Power`
    * Attributes: `bits.in1`, `bits.in2` and `bits.out` (natural number), `signed.in1` and `signed.in2` (boolean)
    * Inputs: `in1` (`bits.in1`-bit), `in2` (`bits.in2`-bit)
    * Outputs: `out` (`bits.out`-bit)
 * Multiplexer: `Mux`
    * Attributes: `bits.in`, `bits.sel` (natural number)
    * Inputs: `in0` ... `inN` (`bits.in`-bit, `N` = 2**`bits.sel`-1), `sel` (`bits.sel`-bit)
    * Outputs: `out` (`bits.in`-bit)
 * One-hot multiplexer: `Mux1Hot`
    * Attributes: `bits.in`, `bits.sel` (natural number)
    * Inputs: `in0` ... `inN` (`bits.in`-bit, `N` = `bits.sel`), `sel` (`bits.sel`-bit)
    * Outputs: `out` (`bits.in`-bit)
 * D flip-flop: `Dff`
    * Attributes: `bits` (natural number), `polarity.clock`, `polarity.arst`, `polarity.enable` (optional booleans), `initial` (optional binary string)
    * Inptus: `in` (`bits`-bit), `clk` (1-bit, if `polarity.clock` is present), `arst` (1-bit, if `polarity.arst` is present), `en` (1-bit, if `polarity.enable` is present)
    * Outputs: `out` (`bits`-bit)
 * Memory: `Memory`
    * Attributes: `bits`, `abits`, `words`, `offset` (natural number), `rdports` (array of read port descriptors), `wrports` (array of write port descriptors), `memdata` (memory contents description)
    * Read port descriptor attributes: `enable_polarity`, `clock_polarity`, `transparent` (optional booleans)
    * Write port descriptor attributes: `enable_polarity`, `clock_polarity` (optional booleans)
    * Inputs (per read port): `rdKaddr` (`abits`-bit), `rdKen` (1-bit, if `enable_polarity` is present), `rdKclk` (1-bit, if `clock_polarity` is present)
    * Outputs (per read port): `rdKdata` (`bits`-bit)
    * Inputs (per write port): `wrKaddr` (`abits`-bit), `wrKdata` (`bits`-bit), `wrKen` (1-bit, if `enable_polarity` is present), `wrKclk` (1-bit, if `clock_polarity` is present)
 * Clock source: `Clock` 
    * Outputs: `out` (1-bit)
 * Button input: `Button`
    * Outputs: `out` (1-bit)
 * Lamp output: `Lamp`
    * Inputs: `in` (1-bit)
 * Number input: `NumEntry`
    * Attributes: `bits` (natural number), `numbase` (string)
    * Outputs: `out` (`bits`-bit)
 * Number output: `NumDisplay`
    * Attributes: `bits` (natural number), `numbase` (string)
    * Inputs: `in` (`bits`-bit)
 * Subcircuit input: `Input`
    * Attributes: `bits` (natural number)
    * Outputs: `out` (`bits`-bit)
 * Subcircuit output: `Output`
    * Attributes: `bits` (natural number)
    * Inputs: `in` (`bits`-bit)
 * Bus grouping: `BusGroup`
    * Attributes: `groups` (array of natural numbers)
    * Inputs: `in0` (`groups[0]`-bit) ... `inN` (`groups[N]`-bit)
    * Outputs: `out` (sum-of-`groups`-bit)
 * Bus ungrouping: `BusUngroup`
    * Attributes: `groups` (array of natural numbers)
    * Inputs: `in` (sum-of-`groups`-bit)
    * Outputs: `out0` (`groups[0]`-bit) ... `outN` (`groups[N]`-bit)
 * Bus slicing: `BusSlice`
    * Attributes: `slice.first`, `slice.count`, `slice.total` (natural number)
    * Inputs: `in` (`slice.total`-bit)
    * Outputs: `out` (`slice.count`-bit)
 * Zero- and sign-extension: `ZeroExtend`, `SignExtend`
    * Attributes: `extend.input`, `extend.output` (natural number)
    * Inputs: `in` (`extend.input`-bit)
    * Outputs: `out` (`extend.output`-bit)
 * Finite state machines: `FSM`
    * Attributes: `bits.in`, `bits.out`, `states`, `init_state`, `current_state` (natural number), `trans_table` (array of transition descriptors)
    * Transition descriptor attributes: `ctrl_in`, `ctrl_out` (binary strings), `state_in`, `state_out` (natural numbers)
    * Inputs: `clk` (1-bit), `arst` (1-bit), `in` (`bits.in`-bit)
    * Outputs: `out` (`bits.out`-bit)

# TODO

Some ideas for further developing the simulator.

 * Use JointJS elementTools for configuring/removing gates.
 * RAM/ROM import/export for Verilog format and Intel HEX.
 * Scripting language for writing testbenches. (Maybe Lua?)
 * Framebuffer element with character/bitmap display.
 * More editing capability: adding and removing blocks, modifying some of blocks' properties.
 * Undo-redo capability.
 * Saving and loading circuits, including layout and state.
 * Generic handling of negation for unary/binary gates (negation on inputs/outputs) for better clarity.
 * N-ary gates as generalization of binary gates.
 * Better algorithm for graph layout.
 * Zooming in/out on schematics.
 * SVG export.
 * Verilog export.
 * Smartphone and tablet compatible UI.

[digitaljs-logo]: docs/resources/digitaljs_textpath_right.svg

