
export class WorkerEngine {
    constructor(graph, cells) {
        this._graph = graph;
        this._cells = cells;
        this._running = false;
        this._tickCache = 0;
        this._pendingEventsCache = false;
        this._worker = new Worker(new URL('./worker-worker.mjs', import.meta.url));
        this._worker.onmessage = (e) => this._handleMessage(e.data);
        this.interval = 10;
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

_.extend(WorkerEngine.prototype, Backbone.Events);
