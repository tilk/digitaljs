
import _ from 'lodash';
import Backbone from 'backbone';
import FastPriorityQueue from 'fastpriorityqueue';
import * as help from '../help.mjs';

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
    _instrumentElement(elem) {
        this._enqueue(elem);
        if (elem instanceof this._cells.Subcircuit)
            this._instrumentGraph(elem.get('graph'));
    }
    _instrumentGraph(graph) {
        this.listenTo(graph, 'change:constantCache', (gate) => {
            this._enqueue(gate);
        });
        this.listenTo(graph, 'change:inputSignals', (gate, sigs) => {
            const prevSigs = gate.previous("inputSignals");
            if (help.eqSigs(sigs, prevSigs) && !sigs._clock_hack) return;
            if (gate instanceof this._cells.Subcircuit) {
                const iomap = gate.get('circuitIOmap');
                for (const [port, sig] of Object.entries(sigs)) {
                    if (!prevSigs[port] || sig.eq(prevSigs[port])) continue;
                    const input = gate.get('graph').getCell(iomap[port]);
                    console.assert(input.isInput);
                    input._setInput(sig);
                }
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
        for (const elem of graph.getElements())
            this._instrumentElement(elem);
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
};

_.extend(SynchEngine.prototype, Backbone.Events);

