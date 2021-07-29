
class WorkerEngineWorker {
    constructor() {
        this._interval = 10;
    }
    interval(ms) {
        this._interval = ms;
    }
    updateGates() {
    }
    updateGatesNext() {
    }
    start() {
    }
    startFast() {
    }
    stop() {
    }
};

const worker = new WorkerEngineWorker();

onmessage = (e) => {
    const msg = e.data;
    if ('arg' in msg)
        worker[msg.type](msg.arg);
    else if ('args' in msg)
        worker[msg.type].apply(worker, msg.args);
    else
        worker[msg.type]();
}

