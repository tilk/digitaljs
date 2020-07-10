"use strict";

import * as joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import { Vector3vl, Display3vl } from '3vl';
import * as cells from './cells.mjs';
import FastPriorityQueue from 'fastpriorityqueue';
import * as help from './help.mjs';
    
export function getCellType(tp) {
    const types = {
        '$not': cells.Not,
        '$and': cells.And,
        '$nand': cells.Nand,
        '$or': cells.Or,
        '$nor': cells.Nor,
        '$xor': cells.Xor,
        '$xnor': cells.Xnor,
        '$reduce_and': cells.AndReduce,
        '$reduce_nand': cells.NandReduce,
        '$reduce_or': cells.OrReduce,
        '$reduce_nor': cells.NorReduce,
        '$reduce_xor': cells.XorReduce,
        '$reduce_xnor': cells.XnorReduce,
        '$reduce_bool': cells.OrReduce,
        '$logic_not': cells.NorReduce,
        '$repeater': cells.Repeater,
        '$shl': cells.ShiftLeft,
        '$shr': cells.ShiftRight,
        '$lt': cells.Lt,
        '$le': cells.Le,
        '$eq': cells.Eq,
        '$ne': cells.Ne,
        '$gt': cells.Gt,
        '$ge': cells.Ge,
        '$constant': cells.Constant,
        '$neg': cells.Negation,
        '$pos': cells.UnaryPlus,
        '$add': cells.Addition,
        '$sub': cells.Subtraction,
        '$mul': cells.Multiplication,
        '$div': cells.Division,
        '$mod': cells.Modulo,
        '$pow': cells.Power,
        '$mux': cells.Mux,
        '$pmux': cells.Mux1Hot,
        '$dff': cells.Dff,
        '$mem': cells.Memory,
        '$fsm': cells.FSM,
        '$clock': cells.Clock,
        '$button': cells.Button,
        '$lamp': cells.Lamp,
        '$numdisplay': cells.NumDisplay,
        '$numentry': cells.NumEntry,
        '$input': cells.Input,
        '$output': cells.Output,
        '$busgroup': cells.BusGroup,
        '$busungroup': cells.BusUngroup,
        '$busslice': cells.BusSlice,
        '$zeroextend': cells.ZeroExtend,
        '$signextend': cells.SignExtend
    };
    if (tp in types) return types[tp];
    else return cells.Subcircuit;
}
    
export class HeadlessCircuit {
    constructor(data, cellsNamespace) {
        this._cells = Object.assign(cells, cellsNamespace || {});
        this._queue = new Map();
        this._pq = new FastPriorityQueue();
        this._tick = 0;
        this._display3vl = new Display3vl();
        this._display3vl.addDisplay(new help.Display3vlASCII());
        this._graph = this.makeGraph(data, data.subcircuits);
        this.makeLabelIndex();
    }
    addDisplay(display) {
        this._display3vl.addDisplay(display);
        this.trigger('display:add', display);
    }
    shutdown() {
        this.stopListening();
    }
    makeGraph(data, subcircuits) {
        const graph = new joint.dia.Graph();
        graph._display3vl = this._display3vl;
        this.listenTo(graph, 'change:buttonState', (gate, sig) => {
            this.enqueue(gate);
            this.trigger('userChange');
        });
        this.listenTo(graph, 'change:signal', (wire, signal) => {
            const gate = graph.getCell(wire.get('target').id);
            if (gate) setInput(signal, wire.get('target'), gate);
        });
        this.listenTo(graph, 'change:inputSignals', (gate, sigs) => {
            // forward the change back from a subcircuit
            if (gate instanceof this._cells.Output) {
                const subcir = gate.graph.get('subcircuit');
                if (subcir == null) return; // not in a subcircuit
                console.assert(subcir instanceof this._cells.Subcircuit);
                subcir.set('outputSignals', _.chain(subcir.get('outputSignals'))
                    .clone().set(gate.get('net'), sigs.in).value());
            } else this.enqueue(gate);
        });
        this.listenTo(graph, 'change:outputSignals', (gate, sigs) => {
            _.chain(graph.getConnectedLinks(gate, {outbound: true}))
                .groupBy((wire) => wire.get('source').port)
                .forEach((wires, port) => 
                    wires.forEach((wire) => wire.set('signal', sigs[port])))
                .value();
        });
        this.listenTo(graph, 'change:source', (wire, end) => {
            this._labelIndex = null; // TODO: update index
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                wire.set('signal', gate.get('outputSignals')[end.port]);
            } else {
                wire.set('signal', Vector3vl.xes(wire.get('bits')));
            }
        });
        const setInput = (sig, end, gate) => {
            gate.set('inputSignals', _.chain(gate.get('inputSignals'))
                .clone().set(end.port, sig).value());
            // forward the input change to a subcircuit
            if (gate instanceof this._cells.Subcircuit) {
                const iomap = gate.get('circuitIOmap');
                const input = gate.get('graph').getCell(iomap[end.port]);
                console.assert(input instanceof this._cells.Input);
                input.set('outputSignals', { out: sig });
            }
        }
        function clearInput(end, gate) {
            var bits = gate.getPort(end.port).bits;
            setInput(Vector3vl.xes(bits), end, gate);
        }
        this.listenTo(graph, 'change:target', (wire, end) => {
            this._labelIndex = null; // TODO: update index
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
        this.listenTo(graph, 'remove', (cell, coll, opt) => {
            this._labelIndex = null; // TODO: update index
            if (!cell.isLink()) return;
            const end = cell.get('target');
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                clearInput(end, gate);
            }
        });
        this.listenTo(graph, 'add', (cell, coll, opt) => {
            this._labelIndex = null; // TODO: update index
            if (!cell.isLink()) return;
            const strt = cell.get('source');
            const sgate = graph.getCell(strt.id);
            if (sgate && 'port' in strt) {
                cell.set('signal', sgate.get('outputSignals')[strt.port]);
                cell.set('bits', sgate.getPort(strt.port).bits);
            }
        });
        let laid_out = false;
        for (const devid in data.devices) {
            const dev = data.devices[devid];
            if (dev.position) laid_out = true;
            const cellType = (dev.type in this._cells) ? this._cells[dev.type] : getCellType(dev.celltype);
            const cellArgs = _.clone(dev);
            cellArgs.id = devid;
            if (cellType == this._cells.Subcircuit)
                cellArgs.graph = this.makeGraph(subcircuits[dev.celltype], subcircuits);
            const cell = new cellType(cellArgs);
            graph.addCell(cell);
            this.enqueue(cell);
        }
        for (const conn of data.connectors) {
            graph.addCell(new this._cells.Wire({
                source: {id: conn.from.id, port: conn.from.port, magnet: 'port' },
                target: {id: conn.to.id, port: conn.to.port, magnet: 'port'},
                netname: conn.name,
                vertices: conn.vertices || []
            }));
        }
        if (laid_out) graph.set('laid_out', true);
        return graph;
    }
    enqueue(gate) {
        const k = (this._tick + gate.get('propagation')) | 0;
        const sq = (() => {
            const q = this._queue.get(k);
            if (q !== undefined) return q;
            const q1 = new Map();
            this._queue.set(k, q1);
            this._pq.add(k);
            return q1;
        })();
        sq.set(gate, gate.get('inputSignals'));
    }
    updateGatesNext() {
        const k = this._pq.poll() | 0;
        console.assert(k >= this._tick);
        this._tick = k;
        const q = this._queue.get(k);
        let count = 0;
        this.trigger('preUpdateGates', k);
        while (q.size) {
            const [gate, args] = q.entries().next().value;
            q.delete(gate);
            if (gate instanceof this._cells.Subcircuit) continue;
            if (gate instanceof this._cells.Input) continue;
            if (gate instanceof this._cells.Output) continue;
            const graph = gate.graph;
            if (!graph) continue;
            gate.set('outputSignals', gate.operation(args));
            count++;
        }
        this._queue.delete(k);
        this._tick = (k + 1) | 0;
        this.trigger('postUpdateGates', k, count);
        return count;
    }
    updateGates() {
        if (this._pq.peek() == this._tick) return this.updateGatesNext();
        else {
            const k = this._tick | 0;
            this.trigger('preUpdateGates', k);
            this._tick = (k + 1) | 0;
            this.trigger('postUpdateGates', k, 0);
            return 0;
        }
    }
    get hasPendingEvents() {
        return this._queue.size > 0;
    }
    get tick() {
        return this._tick;
    }
    getInputCells() {
        return this._graph.getElements().filter(x => x.setLogicValue);
    }
    getOutputCells() {
        return this._graph.getElements().filter(x => x.getLogicValue);
    }
    setInput(name, sig) {
        const cell = this._graph.getCell(name);
        if (cell.setLogicValue) cell.setLogicValue(sig);
        else throw new Error('Invalid call to setInput');
    }
    getOutput(name) {
        const cell = this._graph.getCell(name);
        if (cell.getLogicValue) return cell.getLogicValue();
        else throw new Error('Invalid call to getOutput');
    }
    makeLabelIndex() {
        // TODO: update label index on changes
        if (this._labelIndex) return this._labelIndex;
        const fromGraph = (graph) => {
            const ret = {
                wires: {},
                devices: {},
                subcircuits: {},
                inputs: {},
                outputs: {}
            };
            for (const elem of graph.getElements()) {
                if (elem.has('net')) {
                    if (elem.setLogicValue) 
                        ret.inputs[elem.get('net')] = elem;
                    if (elem.getLogicValue) 
                        ret.outputs[elem.get('net')] = elem;
                }
                if (!elem.has('label')) continue;
                const label = elem.get('label');
                ret.devices[label] = elem;
                if (elem instanceof this._cells.Subcircuit)
                    ret.subcircuits[label] = fromGraph(elem.get('graph'));
            }
            for (const elem of graph.getLinks()) {
                if (!elem.has('netname')) continue;
                ret.wires[elem.get('netname')] = elem;
            }
            return ret;
        }
        return this._labelIndex = fromGraph(this._graph);
    }
    getLabelIndex(path = []) {
        const f = (p, i) => {
            if (p == path.length) {
                return i;
            } else {
                const s = i.subcircuits[path[p]];
                if (s) return f(p+1, s);
            }
        };
        return f(0, this.makeLabelIndex());
    }
    findWireByLabel(name, path = []) {
        return this.getLabelIndex(path).wires[name];
    }
    findDeviceByLabel(name, path = []) {
        return this.getLabelIndex(path).devices[name];
    }
    findInputByNet(name) {
        return this.getLabelIndex([]).inputs[name];
    }
    findOutputByNet(name) {
        return this.getLabelIndex([]).outputs[name];
    }
    toJSON(layout = true) {
        const subcircuits = {};
        const fromGraph = (graph) => {
            const ret = {
                devices: {},
                connectors: []
            };
            const laid_out = graph.get('laid_out');
            for (const elem of graph.getElements()) {
                const args = ret.devices[elem.get('id')] = elem.getGateParams(layout);
                if (!laid_out) delete args.position;
                if (elem instanceof this._cells.Subcircuit && !subcircuits[elem.get('celltype')]) {
                    subcircuits[elem.get('celltype')] = fromGraph(elem.get('graph'));
                }
            }
            for (const elem of graph.getLinks()) {
                ret.connectors.push(elem.getWireParams(layout));
            }
            return ret;
        }
        const ret = fromGraph(this._graph);
        ret.subcircuits = subcircuits;
        return ret;
    }
};

_.extend(HeadlessCircuit.prototype, Backbone.Events);

