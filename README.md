# DigitalJS

This project is a digital circuit simulator implemented in Javascript.
It is designed to simulate circuits synthesized by hardware design tools
like [Yosys](http://www.clifford.at/yosys/), and it has a companion project
[yosys2digitaljs](https://github.com/tilk/yosys2digitaljs), which converts
Yosys output files to DigitalJS. It is also intended to be a teaching tool,
therefore readability and ease of inspection is one of top concerns for
the project.

# Input format

Circuits are represented using JSON. The top-level object has three keys, `devices`,
`connectors` and `subcircuits`. Under `devices` is a list of all devices forming
the circuit, represented as an object, where keys are (unique and internal) device
names. Each device has a number of properties, which are represented by an object.
A mandatory property is `celltype`, which specifies the type of the device. Example
device:

```javascript
"dev1": {
    "celltype": "$and",
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
a device `celltype`; this instantiates the subcircuit. A subcircuit definition
follows the representation of whole circuits, with the exception that subcircuits
cannot (currently) define their own subcircuits. A subcircuit can include
`$input` and `$output` devices, these are mapped to ports on a subcircuit
instance.

# TODO

Some ideas for further developing the simulator.

 * Display/editor for RAM/ROM contents.
 * Simulation time control: changing the tick time, pausing the simulation.
 * Displaying waveforms for selected wires.
 * More editing capability: adding and removing blocks, modifying some of blocks' properties.
 * Saving and loading circuits, including layout and state.
 * Generic handling of negation for unary/binary gates (negation on inputs/outputs) for better clarity.
 * Better algorithm for graph layout.

