
import _ from 'lodash';
import { BaseEngine } from './base.mjs';
import { Vector3vl } from '3vl';
import * as cells from '../cells.mjs';

export class WorkerEngine extends BaseEngine {
    constructor(graph) {
        super(graph);
        this._running = false;
        this._tickCache = 0;
        this._pendingEventsCache = false;
        this._observers = Object.create(null);
        this._graphs = Object.create(null);
        this._worker = new Worker(new URL('./worker-worker.mjs', import.meta.url));
        this._worker.onmessage = (e) => this._handleMessage(e.data);
        this.interval = 10;
        this._addGraph(this._graph);
    }
    _addGate(gate) {
        const params = gate.getGateParams();
        const ports = gate.getPorts().map(({id, dir, bits}) => ({id, dir, bits}));
        this._worker.postMessage({ type: 'addGate', args: [gate.graph.cid, gate.id, params, ports, gate.get('inputSignals'), gate.get('outputSignals') ] });
        super._addGate(gate);
        if (gate instanceof cells.Subcircuit) {
            this._worker.postMessage({
                type: 'addSubcircuit',
                args: [gate.graph.cid, gate.id, gate.get('graph').cid, gate.get('circuitIOmap')]
            });
        }
        if (gate instanceof cells.Input && gate.get('mode') != 0) {
            this.listenTo(gate, 'change:outputSignals', (gate, sigs) => {
                const prevSigs = gate.previous("outputSignals");
                if (prevSigs.out.eq(sigs.out)) return;
                this._worker.postMessage({
                    type: 'changeInput',
                    args: [gate.graph.cid, gate.id, sigs.out]
                });
            });
        }
    }
    _addLink(link) {
        if (!link.get('warning'))
            this._worker.postMessage({ type: 'addLink', args: [link.graph.cid, link.id, link.get('source'), link.get('target')]});
        super._addLink(link);
    }
    _addGraph(graph) {
        this._observers[graph.cid] = 0;
        this._graphs[graph.cid] = graph;
        this._worker.postMessage({ type: 'addGraph', args: [graph.cid]});
        super._addGraph(graph);
    }
    get hasPendingEvents() {
        return this._pendingEventsCache;
    }
    get tick() {
        return this._tickCache;
    }
    shutdown() {
        this._worker.terminate();
    }
    updateGatesNext() {
        if (this._running)
            throw new Error("updateGatesNext while running");
        this._worker.postMessage({ type: 'updateGatesNext' });
    }
    updateGates() {
        if (this._running)
            throw new Error("updateGates while running");
        this._worker.postMessage({ type: 'updateGates' });
    }
    start() {
        if (this.running)
            throw new Error("start while running");
        this._worker.postMessage({ type: 'start' });
        this._running = true;
        this.trigger('changeRunning');
    }
    startFast() {
        if (this.running)
            throw new Error("startFast while running");
        this._worker.postMessage({ type: 'startFast' });
        this._running = true;
        this.trigger('changeRunning');
    }
    stop() {
        if (!this._running) return;
        this._worker.postMessage({ type: 'stop' });
        this._running = false;
        this.trigger('changeRunning');
    }
    get interval() {
        return this._interval;
    }
    set interval(ms) {
        this._interval = ms;
        this._worker.postMessage({ type: 'interval', arg: ms });
    }
    get running() {
        return this._running;
    }
    observeGraph(graph) {
        this._observers[graph.cid] += 1;
        if (this._observers[graph.cid] == 1)
            this._worker.postMessage({ type: 'observeGraph', arg: graph.cid });
    }
    unobserveGraph(graph) {
        this._observers[graph.cid] -= 1;
        if (this._observers[graph.cid] == 0)
            this._worker.postMessage({ type: 'unobserveGraph', arg: graph.cid });
    }
    _handleMessage(msg) {
        const name = '_handle_' + msg.type;
        if ('arg' in msg)
            this[name](msg.arg);
        else if ('args' in msg)
            this[name].apply(this, msg.args);
        else
            this[name]();
    }
    _handle_update(tick, pendingEvents, updates) {
        this._tickCache = tick;
        this._pendingEventsCache = pendingEvents;
        for (const [graphId, gateId, vals] of updates) {
            const graph = this._graphs[graphId];
            if (graph === undefined) continue;
            const gate = graph.getCell(gateId);
            if (gate === undefined) continue;
            const newOutputs = {};
            for (const [port, val] of Object.entries(vals))
                newOutputs[port] = Vector3vl.fromClonable(val);
            _.defaults(newOutputs, gate.get('outputSignals'));
            gate.set('outputSignals', newOutputs);
        }
        this.trigger('postUpdateGates', tick);
    }
    _handle_stopped(tick) {
        this._running = false;
        this._pendingEventsCache = false;
        this._tickCache = tick;
        this.trigger('changeRunning');
    }
};

