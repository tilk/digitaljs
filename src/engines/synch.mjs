
import _ from 'lodash';
import FastPriorityQueue from 'fastpriorityqueue';
import * as help from '../help.mjs';
import { BaseEngine } from './base.mjs';

export class SynchEngine extends BaseEngine {
    constructor(graph, cells) {
        super(graph);
        this._queue = new Map();
        this._pq = new FastPriorityQueue();
        this._tick = 0;
        this._cells = cells;
        this._addGraph(graph);
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
    _updateSubcircuit(gate, sigs, prevSigs = {}) {
        if (!sigs) sigs = gate.get("inputSignals");
        const iomap = gate.get('circuitIOmap');
        for (const [port, sig] of Object.entries(sigs)) {
            if (prevSigs[port] && sig.eq(prevSigs[port])) continue;
            const input = gate.get('graph').getCell(iomap[port]);
            console.assert(input.isInput);
            input._setInput(sig);
        }
    }
    _addGate(gate) {
        super._addGate(gate);
        this._enqueue(gate);
        if (gate instanceof this._cells.Subcircuit)
            this._updateSubcircuit(gate);
    }
    _addGraph(graph) {
        this.listenTo(graph, 'change:constantCache', (gate) => {
            this._enqueue(gate);
        });
        this.listenTo(graph, 'change:inputSignals', (gate, sigs) => {
            const prevSigs = gate.previous("inputSignals");
            if (help.eqSigs(sigs, prevSigs)) return;
            if (gate instanceof this._cells.Subcircuit) {
                this._updateSubcircuit(gate, sigs, prevSigs);
            }
            if (gate instanceof this._cells.Output && gate.get('mode') == 0) {
                const subcir = gate.graph.get('subcircuit');
                if (subcir != true) {
                    console.assert(subcir != null);
                    const port = gate.get('net');
                    const signals = _.clone(subcir.get('outputSignals'));
                    signals[port] = gate.getOutput();
                    subcir.set('outputSignals', signals);
                }
            }
            this._enqueue(gate);
        });
        super._addGraph(graph);
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
            const newOutputSignals = gate.operation(args);
            if ('_clock_hack' in newOutputSignals) {
                delete newOutputSignals['_clock_hack'];
                this._enqueue(gate);
            }
            gate.set('outputSignals', newOutputSignals);
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
    start() {
        throw new Error("start() not supported");
    }
    startFast() {
        throw new Error("startFast() not supported");
    }
    stop() {
    }
    get interval() {
        throw new Error("interval not supported");
    }
    set interval(ms) {
        throw new Error("interval not supported");
    }
    get running() {
        return false;
    }
    observeGraph(graph) {
    }
    unobserveGraph(graph) {
    }
};

