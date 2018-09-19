"use strict";

import joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import { Vector3vl } from '3vl';
import '@app/cells.js';
    
export function getCellType(tp) {
    const types = {
        '$not': joint.shapes.digital.Not,
        '$and': joint.shapes.digital.And,
        '$nand': joint.shapes.digital.Nand,
        '$or': joint.shapes.digital.Or,
        '$nor': joint.shapes.digital.Nor,
        '$xor': joint.shapes.digital.Xor,
        '$xnor': joint.shapes.digital.Xnor,
        '$reduce_and': joint.shapes.digital.AndReduce,
        '$reduce_nand': joint.shapes.digital.NandReduce,
        '$reduce_or': joint.shapes.digital.OrReduce,
        '$reduce_nor': joint.shapes.digital.NorReduce,
        '$reduce_xor': joint.shapes.digital.XorReduce,
        '$reduce_xnor': joint.shapes.digital.XnorReduce,
        '$reduce_bool': joint.shapes.digital.OrReduce,
        '$logic_not': joint.shapes.digital.NorReduce,
        '$repeater': joint.shapes.digital.Repeater,
        '$shl': joint.shapes.digital.ShiftLeft,
        '$shr': joint.shapes.digital.ShiftRight,
        '$lt': joint.shapes.digital.Lt,
        '$le': joint.shapes.digital.Le,
        '$eq': joint.shapes.digital.Eq,
        '$ne': joint.shapes.digital.Ne,
        '$gt': joint.shapes.digital.Gt,
        '$ge': joint.shapes.digital.Ge,
        '$constant': joint.shapes.digital.Constant,
        '$neg': joint.shapes.digital.Negation,
        '$pos': joint.shapes.digital.UnaryPlus,
        '$add': joint.shapes.digital.Addition,
        '$sub': joint.shapes.digital.Subtraction,
        '$mul': joint.shapes.digital.Multiplication,
        '$div': joint.shapes.digital.Division,
        '$mod': joint.shapes.digital.Modulo,
        '$pow': joint.shapes.digital.Power,
        '$mux': joint.shapes.digital.Mux,
        '$pmux': joint.shapes.digital.Mux1Hot,
        '$dff': joint.shapes.digital.Dff,
        '$mem': joint.shapes.digital.Memory,
        '$clock': joint.shapes.digital.Clock,
        '$button': joint.shapes.digital.Button,
        '$lamp': joint.shapes.digital.Lamp,
        '$numdisplay': joint.shapes.digital.NumDisplay,
        '$numentry': joint.shapes.digital.NumEntry,
        '$input': joint.shapes.digital.Input,
        '$output': joint.shapes.digital.Output,
        '$busgroup': joint.shapes.digital.BusGroup,
        '$busungroup': joint.shapes.digital.BusUngroup,
        '$busslice': joint.shapes.digital.BusSlice,
        '$zeroextend': joint.shapes.digital.ZeroExtend,
        '$signextend': joint.shapes.digital.SignExtend
    };
    if (tp in types) return types[tp];
    else return joint.shapes.digital.Subcircuit;
}
    
export class HeadlessCircuit {
    constructor(data) {
        this.queue = new Map();
        this.tick = 0;
        this.graph = this.makeGraph(data, data.subcircuits);
    }
    shutdown() {
        this.stopListening();
    }
    displayOn(elem) {
        return this.makePaper(elem, this.graph);
    }
    makeGraph(data, subcircuits) {
        const graph = new joint.dia.Graph();
        this.listenTo(graph, 'change:buttonState', function(gate, sig) {
            this.enqueue(gate);
        });
        this.listenTo(graph, 'change:signal', function(wire, signal) {
            const gate = graph.getCell(wire.get('target').id);
            if (gate) setInput(signal, wire.get('target'), gate);
        });
        this.listenTo(graph, 'change:inputSignals', function(gate, sigs) {
            // forward the change back from a subcircuit
            if (gate instanceof joint.shapes.digital.Output) {
                const subcir = gate.graph.get('subcircuit');
                if (subcir == null) return; // not in a subcircuit
                console.assert(subcir instanceof joint.shapes.digital.Subcircuit);
                subcir.set('outputSignals', _.chain(subcir.get('outputSignals'))
                    .clone().set(gate.get('net'), sigs.in).value());
            } else this.enqueue(gate);
        });
        this.listenTo(graph, 'change:outputSignals', function(gate, sigs) {
            _.chain(graph.getConnectedLinks(gate, {outbound: true}))
                .groupBy((wire) => wire.get('source').port)
                .forEach((wires, port) => 
                    wires.forEach((wire) => wire.set('signal', sigs[port])))
                .value();
        });
        this.listenTo(graph, 'change:source', function(wire, end) {
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                wire.set('signal', gate.get('outputSignals')[end.port]);
            } else {
                wire.set('signal', Vector3vl.xes(wire.get('bits')));
            }
        });
        function setInput(sig, end, gate) {
            gate.set('inputSignals', _.chain(gate.get('inputSignals'))
                .clone().set(end.port, sig).value());
            // forward the input change to a subcircuit
            if (gate instanceof joint.shapes.digital.Subcircuit) {
                const iomap = gate.get('circuitIOmap');
                const input = gate.get('graph').getCell(iomap[end.port]);
                console.assert(input instanceof joint.shapes.digital.Input);
                input.set('outputSignals', { out: sig });
            }
        }
        function clearInput(end, gate) {
            setInput(Vector3vl.xes(gate.ports[end.port].bits), end, gate);
        }
        this.listenTo(graph, 'change:target', function(wire, end) {
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                setInput(wire.get('signal'), end, gate);
            } 
            const pend = wire.previous('target');
            const pgate = graph.getCell(pend.id);
            if (pgate && 'port' in pend) {
                clearInput(pend, pgate);
            }
        });
        this.listenTo(graph, 'remove', function(cell, coll, opt) {
            if (!cell.isLink()) return;
            const end = cell.get('target');
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                clearInput(end, gate);
            }
        });
        this.listenTo(graph, 'add', function(cell, coll, opt) {
            if (!cell.isLink()) return;
            const strt = cell.get('source');
            const sgate = graph.getCell(strt.id);
            if (sgate && 'port' in strt) {
                cell.set('signal', sgate.get('outputSignals')[strt.port]);
                cell.set('bits', sgate.ports[strt.port].bits);
            }
        });
        for (const devid in data.devices) {
            const dev = data.devices[devid];
            const cellType = getCellType(dev.celltype);
            const cellArgs = _.clone(dev);
            cellArgs.id = devid;
            if (cellType == joint.shapes.digital.Subcircuit)
                cellArgs.graph = this.makeGraph(subcircuits[dev.celltype], subcircuits);
            const cell = new cellType(cellArgs);
            graph.addCell(cell);
            this.enqueue(cell);
        }
        for (const conn of data.connectors) {
            graph.addCell(new joint.shapes.digital.Wire({
                source: {id: conn.from.id, port: conn.from.port},
                target: {id: conn.to.id, port: conn.to.port},
                netname: conn.name
            }));
        }
        return graph;
    }
    enqueue(gate) {
        const k = (this.tick + gate.get('propagation')) | 0;
        const sq = (() => {
            const q = this.queue.get(k);
            if (q !== undefined) return q;
            const q1 = new Map();
            this.queue.set(k, q1);
            return q1;
        })();
        sq.set(gate, gate.get('inputSignals'));
    }
    updateGates() {
        const k = this.tick;
        const q = this.queue.get(k) || new Map();
        while (q.size) {
            const [gate, args] = q.entries().next().value;
            q.delete(gate);
            if (gate instanceof joint.shapes.digital.Subcircuit) continue;
            if (gate instanceof joint.shapes.digital.Input) continue;
            if (gate instanceof joint.shapes.digital.Output) continue;
            const graph = gate.graph;
            if (!graph) continue;
            gate.set('outputSignals', gate.operation(args));
        }
        this.queue.delete(k);
        this.tick = (this.tick + 1) | 0;
    }
    get hasPendingEvents() {
        return this.queue.size > 0;
    }
    setInput(name, sig) {
        const cell = this.graph.getCell(name);
        console.assert(cell.get('celltype') == '$input');
        cell.set('outputSignals', { out: sig });
    }
    getOutput(name) {
        const cell = this.graph.getCell(name);
        console.assert(cell.get('celltype') == '$output');
        return cell.get('inputSignals').in;
    }
    toJSON() {
        const subcircuits = {};
        function fromGraph(graph) {
            const ret = {
                devices: {},
                connectors: []
            };
            for (const elem of graph.getElements()) {
                const args = ret.devices[elem.get('id')] = elem.getGateParams();
                if (elem instanceof joint.shapes.digital.Subcircuit && !subcircuits[elem.get('celltype')]) {
                    subcircuits[elem.get('celltype')] = fromGraph(elem.get('graph'));
                }
            }
            for (const elem of graph.getLinks()) {
                ret.connectors.push(elem.getWireParams());
            }
            return ret;
        }
        const ret = fromGraph(this.graph);
        ret.subcircuits = subcircuits;
        return ret;
    }
};

_.extend(HeadlessCircuit.prototype, Backbone.Events);

