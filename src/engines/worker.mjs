
import _ from 'lodash';
import { BaseEngine } from './base.mjs';
import { Vector3vl } from '3vl';
import * as cells from '../cells.mjs';
import Worker from 'web-worker';

export class WorkerEngine extends BaseEngine {
    constructor(graph, { workerURL }) {
        super(graph);
        this._running = false;
        this._tickCache = 0;
        this._pendingEventsCache = false;
        this._observers = Object.create(null);
        this._graphs = Object.create(null);
        this._monitors = Object.create(null);
        this._promises = Object.create(null);
        this._alarms = Object.create(null);
        this._uniqueCounter = 0;
        this._worker = workerURL ? new Worker(workerURL) : new Worker(new URL('./worker-worker.mjs', import.meta.url));
        this._worker.onmessage = (e) => this._handleMessage(e.data);
        this.interval = 10;
        this._addGraph(this._graph);
    }
    _addGate(graph, gate) {
        const params = gate.getGateParams();
        const ports = gate.getPorts().map(({id, dir, bits}) => ({id, dir, bits}));
        this._worker.postMessage({ type: 'addGate', args: [graph.cid, gate.id, params, ports, gate.get('inputSignals'), gate.get('outputSignals') ] });
        super._addGate(graph, gate);
        if (gate instanceof cells.Subcircuit) {
            this._worker.postMessage({
                type: 'addSubcircuit',
                args: [graph.cid, gate.id, gate.get('graph').cid, gate.get('circuitIOmap')]
            });
        }
        if (gate instanceof cells.Input && gate.get('mode') != 0) {
            this.listenTo(gate, 'change:outputSignals', (gate, sigs) => {
                const prevSigs = gate.previous("outputSignals");
                if (prevSigs.out.eq(sigs.out)) return;
                this._worker.postMessage({
                    type: 'changeInput',
                    args: [graph.cid, gate.id, sigs.out]
                });
            });
        }
        if (gate instanceof cells.Memory) {
            this.listenTo(gate, 'memChange', (addr, data) => {
                gate.memdata.set(addr, data);
            });
            this.listenTo(gate, 'manualMemChange', (gate, addr, data) => {
                this._worker.postMessage({ type: 'manualMemChange', args: [gate.graph.cid, gate.id, addr, data] });
            });
        }
        if (gate instanceof cells.LUT) {
            this.listenTo(gate, 'manualLutChange', (gate, addr, data) => {
                this._worker.postMessage({ type: 'manualLutChange', args: [gate.graph.cid, gate.id, addr, data] });
            });
        }
        for (const paramName of gate._gateParams) {
            if (gate._unsupportedPropChanges.includes(paramName) || gate._presentationParams.includes(paramName))
                continue;
            this.listenTo(gate, 'change:' + paramName, (gate, val) => {
                this._worker.postMessage({
                    type: 'changeParam',
                    args: [graph.cid, gate.id, paramName, val]
                });
            });
        }
    }
    _addLink(graph, link) {
        if (!link.get('warning') && link.get('source').id && link.get('target').id)
            this._worker.postMessage({ type: 'addLink', args: [graph.cid, link.id, link.get('source'), link.get('target')] });
        super._addLink(graph, link);
    }
    _addGraph(graph) {
        this._observers[graph.cid] = 0;
        this._graphs[graph.cid] = graph;
        this._worker.postMessage({ type: 'addGraph', args: [graph.cid]});
        super._addGraph(graph);
    }
    _removeGate(graph, gate) {
        this._worker.postMessage({ type: 'removeGate', args: [graph.cid, gate.id] });
        super._removeGate(graph, link);
        this.stopListening(gate);
    }
    _removeLink(graph, link) {
        if (!link.get('warning') && link.get('source').id && link.get('target').id)
            this._worker.postMessage({ type: 'removeLink', args: [graph.cid, link.id] });
        super._removeLink(graph, link);
    }
    _changeLinkSource(graph, link, src, prevSrc) {
        super._changeLinkSource(graph, link, src, prevSrc);
        if (link.get('warning') || !link.get('target').id) return;
        if (src.id && !prevSrc.id)
            this._worker.postMessage({ type: 'addLink', args: [graph.cid, link.id, link.get('source'), link.get('target')] });
        if (prevSrc.id && !src.id)
            this._worker.postMessage({ type: 'removeLink', args: [graph.cid, link.id] });
    }
    _changeLinkTarget(graph, link, end, prevEnd) {
        super._changeLinkTarget(graph, link, end, prevEnd);
        if (link.get('warning') || !link.get('source').id) return;
        if (end.id && !prevEnd.id)
            this._worker.postMessage({ type: 'addLink', args: [graph.cid, link.id, link.get('source'), link.get('target')] });
        if (prevEnd.id && !end.id)
            this._worker.postMessage({ type: 'removeLink', args: [graph.cid, link.id] });
    }
    _changeLinkWarning(graph, link, warn, prevWarn) {
        super._changeLinkWarning(graph, link, warn, prevWarn);
        if (!link.get('source').id || !link.get('target').id) return;
        if (!warn && prevWarn)
            this._worker.postMessage({ type: 'addLink', args: [graph.cid, link.id, link.get('source'), link.get('target')] });
        if (!prevWarn && warn)
            this._worker.postMessage({ type: 'removeLink', args: [graph.cid, link.id] });
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
    synchronize() {
        const [reqid, promise] = this._generatePromise();
        this._worker.postMessage({ type: 'ping', args: [reqid, true] });
        return promise;
    }
    updateGatesNext({ synchronous = false } = {}) {
        if (this._running)
            throw new Error("updateGatesNext while running");
        const [reqid, promise] = this._generatePromise();
        this._worker.postMessage({ type: 'updateGatesNext', args: [reqid, synchronous] });
        return promise;
    }
    updateGates({ synchronous = false } = {}) {
        if (this._running)
            throw new Error("updateGates while running");
        const [reqid, promise] = this._generatePromise();
        this._worker.postMessage({ type: 'updateGates', args: [reqid, synchronous] });
        return promise;
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
        this._running = 'fast';
        this.trigger('changeRunning');
    }
    stop({ synchronous = false } = {}) {
        if (!this._running) return;
        const [reqid, promise] = this._generatePromise();
        this._worker.postMessage({ type: 'stop', args: [reqid, synchronous] });
        this._running = false;
        this.trigger('changeRunning');
        return promise;
    }
    get interval() {
        return this._interval;
    }
    set interval(ms) {
        this._interval = ms;
        this._worker.postMessage({ type: 'interval', arg: ms });
    }
    get running() {
        return this._running != false;
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
    monitor(gate, port, callback, options) {
        const monitorId = this._generateUniqueId();
        this._monitors[monitorId] = callback;
        this._worker.postMessage({ type: 'monitor', args: [gate.graph.cid, gate.id, port, monitorId, options] });
        return monitorId;
    }
    unmonitor(monitorId) {
        if (!(monitorId in this._monitors)) return;
        this._worker.postMessage({ type: 'unmonitor', arg: monitorId });
        delete this._monitors[monitorId];
    }
    alarm(tick, callback, options) {
        console.assert(tick > this._tickCache);
        const alarmId = this._generateUniqueId();
        this._alarms[alarmId] = callback;
        this._worker.postMessage({ type: 'alarm', args: [tick, alarmId, options] });
        return alarmId;
    }
    unalarm(alarmId) {
        if (!(alarmId in this._alarms)) return;
        this._worker.postMessage({ type: 'unalarm', arg: alarmId });
        delete this._alarms[alarmId];
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
        let changeRunning = this._pendingEventsCache != pendingEvents;
        this._tickCache = tick;
        this._pendingEventsCache = pendingEvents;
        for (const [graphId, gateId, vals] of updates) {
            const gate = this._findGateByIds(graphId, gateId);
            if (gate === undefined) continue;
            const newOutputs = {};
            for (const [port, val] of Object.entries(vals))
                newOutputs[port] = Vector3vl.fromClonable(val);
            _.defaults(newOutputs, gate.get('outputSignals'));
            gate.set('outputSignals', newOutputs);
        }
        this.trigger('postUpdateGates', tick);
        if (changeRunning) this.trigger('changeRunning');
    }
    _handle_stopped(tick) {
        this._running = false;
        this._pendingEventsCache = false;
        this._tickCache = tick;
        this.trigger('changeRunning');
    }
    _handle_gateTrigger(graphId, gateId, event, args) {
        if (event == "memChange")
            args[1] = Vector3vl.fromClonable(args[1]);
        const gate = this._findGateByIds(graphId, gateId);
        if (gate === undefined) return;
        gate.trigger(event, ...args);
    }
    _handle_gateSet(graphId, gateId, name, value) {
        const gate = this._findGateByIds(graphId, gateId);
        if (gate === undefined) return;
        gate.set(name, value);
    }
    _handle_monitorValue(monitorId, tick, sig, stopped, oneShot) {
        const callback = this._monitors[monitorId];
        if (callback == undefined) return;
        if (oneShot) delete this._monitors[monitorId];
        const ret = callback(tick, Vector3vl.fromClonable(sig));
        if (stopped) {
            if (ret) {
                this._running = false;
                this.trigger('changeRunning');
            } else if (this._running)
                this._worker.postMessage({ type: this._running == 'fast' ? 'startFast' : 'start' });
        }
    }
    _handle_alarmReached(alarmId, tick, stopped) {
        const callback = this._alarms[alarmId];
        if (callback == undefined) return;
        delete this._alarms[alarmId];
        const ret = callback();
        if (stopped) {
            if (ret) {
                this._running = false;
                this.trigger('changeRunning');
            } else if (this._running)
                this._worker.postMessage({ type: this._running == 'fast' ? 'startFast' : 'start' });
        }
    }
    _handle_ack(reqid, response) {
        this._resolvePromise(reqid, response);
    }
    _findGateByIds(graphId, gateId) {
            const graph = this._graphs[graphId];
            if (graph === undefined) return undefined;
            return graph.getCell(gateId);
    }
    _generateUniqueId() {
        return this._uniqueCounter++;
    }
    _generatePromise() {
        const reqid = this._generateUniqueId();
        return [reqid, new Promise((resolve) => { this._promises[reqid] = resolve; })];
    }
    _resolvePromise(reqid, value) {
        if (!this._promises[reqid]) {
            console.warn("Missing promise", reqid);
            return;
        }
        this._promises[reqid](value);
        delete this._promises[reqid];
    }
};

