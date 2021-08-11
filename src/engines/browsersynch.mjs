
import { SynchEngine } from './synch.mjs';

export class BrowserSynchEngine extends SynchEngine {
    constructor(graph, opts) {
        super(graph, opts);
        this._interval_ms = 10;
        this._interval = null;
        this._idle = null;
    }
    start() {
        this._interval = setInterval(() => {
            this.updateGates();
            this._checkMonitors();
        }, this._interval_ms);
        this.trigger('changeRunning');
    }
    startFast() {
        const idle = () => {
            this._idle = requestIdleCallback((dd) => {
                while (dd.timeRemaining() > 0 && this.hasPendingEvents && this._idle !== null) {
                    this.updateGatesNext();
                    this._checkMonitors();
                }
                if (this._idle !== null) {
                    idle();
                }
            }, {timeout: 20});
        }
        idle();
        this.trigger('changeRunning');
    }
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        if (this._idle) {
            cancelIdleCallback(this._idle);
            this._idle = null;
        }
        this.trigger('changeRunning');
        return Promise.resolve();
    }
    get interval() {
        return this._interval_ms;
    }
    set interval(ms) {
        console.assert(ms > 0);
        this._interval_ms = ms;
    }
    get running() {
        return this._interval !== null || this._idle !== null;
    }
};

