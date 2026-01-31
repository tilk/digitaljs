
import * as joint from '@joint/core';
import FastPriorityQueue from 'fastpriorityqueue';
import * as help from '../help.mjs';
import { BaseEngine } from './base.mjs';

export class SynchEngine extends BaseEngine {
    constructor(graph, {cells}) {
        super(graph);
        this._queue = new Map();
        this._pq = new FastPriorityQueue();
        this._tick = 0;
        this._cells = cells;
        this._monitorChecks = new Map();
        this._alarms = new Map();
        this._alarmQueue = new Map();
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
    _addGate(graph, gate) {
        super._addGate(graph, gate);
        this._enqueue(gate);
        if (gate instanceof this._cells.Subcircuit)
            this._updateSubcircuit(gate);
    }
    _addGraph(graph) {
        this.listenTo(graph, 'manualMemChange', (gate) => {
            this._enqueue(gate);
        });
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
                    const signals = joint.util.clone(subcir.get('outputSignals'));
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
        this._checkMonitors();
        this.trigger('postUpdateGates', k, count);
        return Promise.resolve(count);
    }
    updateGates() {
        if (this._pq.peek() == this._tick) return this.updateGatesNext();
        else {
            const k = this._tick | 0;
            this._tick = (k + 1) | 0;
            this._checkMonitors();
            this.trigger('postUpdateGates', k, 0);
            return Promise.resolve(0);
        }
    }
    synchronize() {
        return Promise.resolve();
    }
    start() {
        throw new Error("start() not supported");
    }
    startFast() {
        throw new Error("startFast() not supported");
    }
    stop() {
        return Promise.resolve()
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
    monitor(gate, port, callback, {triggerValues, stopOnTrigger, oneShot}) {
        const cb = (gate, sigs) => {
            const sig = sigs[port];
            this._monitorChecks.set(cb, {gate, sig, cb, callback, triggerValues, stopOnTrigger, oneShot});
        };
        gate.on('change:outputSignals', cb);
        if (triggerValues == undefined)
            callback(this._tick, gate.get('outputSignals')[port]);
        return { gate: gate, callback: cb };
    }
    unmonitor(monitorId) {
        monitorId.gate.off('change:outputSignals', monitorId.callback);
    }
    alarm(tick, callback, {stopOnAlarm}) {
        console.assert(tick > this._tick);
        const cb = () => {
            this.unalarm(cb);
            callback();
        };
        this._alarms.set(cb, { tick, stopOnAlarm });
        if (!this._alarmQueue.has(tick))
            this._alarmQueue.set(tick, new Set());
        this._alarmQueue.get(tick).add(cb);
        this._pq.add(tick-1);
        if (!this._queue.has(tick-1))
            this._queue.set(tick-1, new Map());
        return cb;
    }
    unalarm(alarmId) {
        const { tick } = this._alarms.get(alarmId);
        this._alarmQueue.get(tick).delete(alarmId);
        if (this._alarmQueue.get(tick).size == 0)
            this._alarmQueue.delete(tick);
        this._alarms.delete(alarmId);
    }
    _checkMonitors() {
        for (const {gate, sig, cb, callback, triggerValues, stopOnTrigger, oneShot} of this._monitorChecks.values()) {
            let triggered = true;
            if (triggerValues != undefined)
                triggered = triggerValues.some((triggerValue) => sig.eq(triggerValue));
            if (triggered) {
                if (oneShot) gate.off('change:outputSignals', cb);
                const ret = callback(this._tick, sig);
                if (ret && stopOnTrigger) this.stop();
            }
        }
        this._monitorChecks = new Map();
        if (this._alarmQueue.get(this._tick)) {
            for (const cb of this._alarmQueue.get(this._tick)) {
                const { stopOnAlarm } = this._alarms.get(cb);
                const ret = cb();
                if (ret && stopOnAlarm) this.stop();
            }
            this._alarmQueue.delete(this._tick);
        }
    }
};

