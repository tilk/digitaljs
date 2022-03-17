"use strict";

import * as joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import { Vector3vl, Display3vl } from '3vl';
import * as cells from './cells.mjs';
import * as help from './help.mjs';
import * as engines from './engines.mjs';
import * as tools from './tools.mjs';
import * as transform from './transform.mjs';
import { SynchEngine } from './engines/synch.mjs';

export { cells, tools, engines, transform };
    
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
    constructor(data, {cellsNamespace = {}, engine = SynchEngine, engineOptions = {}} = {}) {
        this._cells = Object.assign(cells, cellsNamespace);
        this._display3vl = new Display3vl();
        this._display3vl.addDisplay(new help.Display3vlASCII());
        this._graph = this._makeGraph(data, data.subcircuits);
        engineOptions.cells = this._cells;
        this._engine = new engine(this._graph, engineOptions);
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
        this.trigger('shutdown');
        this.stop();
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
        this.listenTo(graph, 'userChange', (gate) => {
            this.trigger('userChange', gate);
        });
        this.listenTo(graph, 'change:inputSignals', (gate, sigs) => {
            if (help.eqSigs(sigs, gate.previous("inputSignals"))) return;
            if (gate._changeInputSignals) {
                gate._changeInputSignals(sigs);
            }
        });
        this.listenTo(graph, 'change:outputSignals', (gate, sigs) => {
            if (help.eqSigs(sigs, gate.previous("outputSignals"))) return;
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
                vertices: conn.vertices || [],
                source_positions: conn.source_positions || []
            }));
        }
        if (laid_out) graph.set('laid_out', true);
        return graph;
    }
    updateGatesNext(opts) {
        return this._engine.updateGatesNext(opts);
    }
    updateGates(opts) {
        return this._engine.updateGates(opts);
    }
    synchronize() {
        return this._engine.synchronize();
    }
    get hasPendingEvents() {
        return this._engine.hasPendingEvents;
    }
    get tick() {
        return this._engine.tick;
    }
    start() {
        if (this.hasWarnings())
            return; //todo: print/show error
        return this._engine.start();
    }
    startFast() {
        if (this.hasWarnings())
            return; //todo: print/show error
        return this._engine.startFast();
    }
    stop(opts) {
        return this._engine.stop(opts);
    }
    get interval() {
        return this._engine.interval;
    }
    set interval(ms) {
        this._engine.interval = ms;
    }
    get running() {
        return this._engine.running;
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
                outputs: {},
                graph
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
                if (elem instanceof this._cells.Subcircuit) {
                    const celltype = elem.get('celltype');
                    const subcircuit = {
                        dev: args,
                        graph: fromGraph(elem.get('graph'))
                    };
                    const prev_sub = subcircuits[celltype];
                    if (!prev_sub) {
                        subcircuits[celltype] = [subcircuit];
                    }
                    else {
                        prev_sub.push(subcircuit);
                    }
                }
            }
            for (const elem of graph.getLinks()) {
                ret.connectors.push(elem.getWireParams(layout));
            }
            return ret;
        }
        const ret = fromGraph(this._graph);
        ret.subcircuits = {};
        for (const celltype in subcircuits) {
            const subs = subcircuits[celltype];
            const nsubs = subs.length;
            if (nsubs == 1) {
                // We check for conflict of generated names with
                // both the original names and the new names
                // so it's guaranteed that none of the original names conflict
                // with the generated names
                console.assert(!(celltype in ret.subcircuits));
                ret.subcircuits[celltype] = subs[0].graph;
                continue;
            }
            let cnt = -1;
            const gen_name = () => {
                while (true) {
                    const id = cnt++;
                    // Use the original name for the first one to keep the file closer
                    // to the old one.
                    if (id == -1)
                        return celltype;
                    const name = `${celltype}$${id}`;
                    if (name in subcircuits || name in ret.subcircuits)
                        continue;
                    return name;
                }
            };
            for (let i = 0; i < nsubs; i++) {
                const sub = subs[i];
                // Rename, assign to return value, and fix the reference (celltype)
                // in the device tree.
                sub.dev.celltype = gen_name();
                if (!sub.dev.disp_celltype && sub.dev.celltype !== celltype)
                    sub.dev.disp_celltype = celltype;
                ret.subcircuits[sub.dev.celltype] = sub.graph;
            }
        }
        return ret;
    }
    waitForWire(wire, trigger) {
        if (trigger instanceof Vector3vl)
            trigger = [trigger];
        return new Promise(resolve => {
            this.monitorWire(wire, (tick, sig) => { resolve(tick) }, 
                { synchronous: true, oneShot: true, stopOnTrigger: true, triggerValues: trigger });
        });
    }
    waitFor(cell, port, trigger) {
        if (trigger instanceof Vector3vl)
            trigger = [trigger];
        return new Promise(resolve => {
            this.monitor(cell, port, (tick, sig) => { resolve(tick) }, 
                { synchronous: true, oneShot: true, stopOnTrigger: true, triggerValues: trigger });
        });
    }
    monitorWire(wire, callback, options = {}) {
        const src = wire.get('source');
        const gate = wire.getSourceElement();
        if (gate == null) return null;
        return this.monitor(gate, src.port, callback, options);
    }
    monitor(cell, port, callback, options = {}) {
        return this._engine.monitor(cell, port, callback, options);
    }
    unmonitor(monitorId) {
        this._engine.unmonitor(monitorId);
    }
    observeGraph(path = []) {
        this._engine.observeGraph(this.getLabelIndex(path).graph);
    }
    unobserveGraph(path = []) {
        this._engine.observeGraph(this.getLabelIndex(path).graph);
    }
    alarm(tick, callback, options = {}) {
        return this._engine.alarm(tick, callback, options);
    }
    unalarm(alarmId) {
        this._engine.unalarm(alarmId);
    }
};

_.extend(HeadlessCircuit.prototype, Backbone.Events);

