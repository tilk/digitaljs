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
        
const eqSigs = (sigs1, sigs2) => {
    for (const k in sigs2) {
        if (!sigs1[k].eq(sigs2[k])) return false;
    }
    return true;
};

export class SynchEngine {
    constructor(graph, cells) {
        this._queue = new Map();
        this._pq = new FastPriorityQueue();
        this._tick = 0;
        this._graph = graph;
        this._cells = cells;
        this._instrumentGraph(graph);
    }
    get hasPendingEvents() {
        return this._queue.size > 0;
    }
    get tick() {
        return this._tick;
    }
    shutdown() {
        this.stopListening();
    }
    _instrumentGraph(graph) {
        this.listenTo(graph, 'change:constantCache', (gate) => {
            this._enqueue(gate);
        });
        this.listenTo(graph, 'change:inputSignals', (gate, sigs) => {
            if (eqSigs(sigs, gate.previous("inputSignals")) && !sigs._clock_hack) return;
            this._enqueue(gate);
        });
        for (const elem of graph.getElements()) {
            this._enqueue(elem);
            if (elem instanceof this._cells.Subcircuit)
                this._instrumentGraph(elem.get('graph'));
        }
    }
    _enqueue(gate) {
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
            this._tick = (k + 1) | 0;
            this.trigger('postUpdateGates', k, 0);
            return 0;
        }
    }
};

_.extend(SynchEngine.prototype, Backbone.Events);

export class HeadlessCircuit {
    constructor(data, {cellsNamespace = {}, engine = SynchEngine} = {}) {
        this._cells = Object.assign(cells, cellsNamespace);
        this._display3vl = new Display3vl();
        this._display3vl.addDisplay(new help.Display3vlASCII());
        this._graph = this._makeGraph(data, data.subcircuits);
        this._engine = new engine(this._graph, this._cells);
        this.makeLabelIndex();
        this.listenTo(this._engine, 'postUpdateGates', (tick, count) => {
            this.trigger('postUpdateGates', tick, count);
        });
    }
    addDisplay(display) {
        this._display3vl.addDisplay(display);
        this.trigger('display:add', display);
    }
    shutdown() {
        this._engine.shutdown();
        this.stopListening();
    }
    hasWarnings() {
        return this._graph._warnings > 0;
    }
    _makeGraph(data, subcircuits, opt) {
        opt = opt || {};
        const graph = new joint.dia.Graph();
        graph._display3vl = this._display3vl;
        graph._warnings = 0;
        if (opt.nested) graph.set('subcircuit', true);
        const changeWarnings = (x) => {
            graph._warnings += x;
            console.assert(graph._warnings >= 0);

            //todo: better handling for stopping simulation
            if (graph._warnings > 0 && this.running)
                this.stop();
            
            // bubble warning up in case of subcircuit
            const subcir = graph.get('subcircuit');
            if (subcir == null || subcir == true) return;
            subcir.set('warning', graph._warnings > 0);
        };
        this.listenTo(graph, 'userChange', () => {
            this.trigger('userChange');
        });
        this.listenTo(graph, 'change:inputSignals', (gate, sigs) => {
            if (eqSigs(sigs, gate.previous("inputSignals"))) return;
            if (gate._changeInputSignals) {
                gate._changeInputSignals(sigs);
            }
        });
        this.listenTo(graph, 'change:outputSignals', (gate, sigs) => {
            if (eqSigs(sigs, gate.previous("outputSignals"))) return;
            gate._changeOutputSignals(sigs);
        });
        this.listenTo(graph, 'change:signal', (wire, signal) => {
            wire._changeSignal(signal);
        });
        this.listenTo(graph, 'change:source', (wire, src) => {
            this._labelIndex = null; // TODO: update index
            wire._changeSource(src);
        });
        this.listenTo(graph, 'change:target', (wire, end) => {
            this._labelIndex = null; // TODO: update index
            wire._changeTarget(end);
        });
        this.listenTo(graph, 'change:warning', (cell, warn) => {
            if (cell.previous('warning') === warn)
                return;
            changeWarnings(warn ? 1 : -1);
        });
        this.listenTo(graph, 'add', (cell, coll, opt) => {
            this._labelIndex = null; // TODO: update index
            if (cell.onAdd) cell.onAdd();
            if (cell.get('warning')) changeWarnings(1);
        });
        this.listenTo(graph, 'remove', (cell, coll, opt) => {
            this._labelIndex = null; // TODO: update index
            if (cell.get('warning')) changeWarnings(-1);
        });
        let laid_out = false;
        for (const devid in data.devices) {
            const dev = data.devices[devid];
            if (dev.position) laid_out = true;
            const cellType = (dev.type in this._cells) ? this._cells[dev.type] : getCellType(dev.celltype);
            const cellArgs = _.clone(dev);
            cellArgs.id = devid;
            if (cellType == this._cells.Subcircuit)
                cellArgs.graph = this._makeGraph(subcircuits[dev.celltype], subcircuits, { nested: true });
            const cell = new cellType(cellArgs);
            graph.addCell(cell);
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
    updateGatesNext() {
        this._engine.updateGatesNext();
    }
    updateGates() {
        this._engine.updateGates();
    }
    get hasPendingEvents() {
        return this._engine.hasPendingEvents;
    }
    get tick() {
        return this._engine.tick;
    }
    getInputCells() {
        return this._graph.getElements().filter(x => x.isInput);
    }
    getOutputCells() {
        return this._graph.getElements().filter(x => x.isOutput);
    }
    setInput(name, sig) {
        const cell = this._graph.getCell(name);
        if (cell.isInput) cell.setInput(sig);
        else throw new Error('Invalid call to setInput');
    }
    getOutput(name) {
        const cell = this._graph.getCell(name);
        if (cell.isOutput) return cell.getOutput();
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
                    if (elem.isInput)
                        ret.inputs[elem.get('net')] = elem;
                    if (elem.isOutput)
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

