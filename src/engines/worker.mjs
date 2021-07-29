
import _ from 'lodash';
import { BaseEngine } from './base.mjs';

export class WorkerEngine extends BaseEngine {
    constructor(graph) {
        super(graph);
        this._running = false;
        this._tickCache = 0;
        this._pendingEventsCache = false;
        this._worker = new Worker(new URL('./worker-worker.mjs', import.meta.url));
        this._worker.onmessage = (e) => this._handleMessage(e.data);
        this.interval = 10;
        this._addGraph(this._graph);
    }
    _addGate(gate) {
        this._worker.postMessage({ type: 'addGate', args: [gate.graph.cid, gate.id, gate.getGateParams()] });
        super._addGate(gate);
    }
    _addLink(link) {
        if (!link.get('warning'))
            this._worker.postMessage({ type: 'addLink', args: [link.graph.cid, link.id, link.get('source'), link.get('target')]});
        super._addLink(link);
    }
    _addGraph(graph) {
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
    _handleMessage(data) {
    }
};

