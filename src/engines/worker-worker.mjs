
import * as cells from '../cells.mjs';
import FastPriorityQueue from 'fastpriorityqueue';
import { Vector3vl } from '3vl';

const specialGates = new Set(['Subcircuit', 'Input', 'Output', 'Button', 'Lamp', 'NumEntry', 'NumDisplay']);

class Link {
    constructor(source, target) {
        this.source = source;
        this.target = target;
    }
}

class Gate {
    constructor(id, graph, gateParams, ports, inputSignals, outputSignals) {
        this.id = id;
        this.graph = graph;
        const cell = cells[gateParams.type].prototype;
        this.operation = cell.operation;
        for (const helper of cell._operationHelpers)
            this[helper] = cell[helper];
        this.links = new Set();
        this._links_to = Object.create(null);
        this._params = gateParams;
        this._params.inputSignals = Object.create(null);
        this._params.outputSignals = Object.create(null);
        this._ports = Object.create(null);
        for (const port of ports) {
            this._ports[port.id] = port;
            if (port.dir == "in")
                this._params.inputSignals[port.id] = Vector3vl.fromClonable(inputSignals[port.id]);
            if (port.dir == "out") {
                this._params.outputSignals[port.id] = Vector3vl.fromClonable(outputSignals[port.id]);
                this._links_to[port.id] = new Set();
            }
        }
        cell.prepare.call(this);
    }
    get(name) {
        return this._params[name];
    }
    set(name, value) {
        this._params[name] = value;
    }
    addLinkTo(port, target) {
        this._links_to[port].add(target);
    }
    removeLinkTo(port, target) {
        this._links_to[port].delete(target);
    }
    addLink(linkId) {
        this.links.add(linkId);
    }
    removeLink(linkId) {
        this.links.delete(linkId);
    }
    targets(port) {
        return this._links_to[port];
    }
}

class Graph {
    constructor(id) {
        this.id = id;
        this._gates = {};
        this._links = {};
        this._observed = false;
    }
    addLink(linkId, source, target) {
        this._links[linkId] = new Link(source, target);
        this._gates[source.id].addLinkTo(source.port, target);
        this._gates[source.id].addLink(linkId);
        this._gates[target.id].addLink(linkId);
    }
    addGate(gateId, gateParams, ports, inputSignals, outputSignals) {
        this._gates[gateId] = new Gate(gateId, this, gateParams, ports, inputSignals, outputSignals);
    }
    removeLink(linkId) {
        const link = this._links[linkId];
        this._gates[link.source.id].removeLinkTo(link.source.port, link.target);
        this._gates[link.source.id].removeLink(linkId);
        this._gates[link.target.id].removeLink(linkId);
        delete this._links[linkId];
    }
    removeGate(gateId) {
        for (const linkId of this._gates[gateId].links)
            this.removeLink(linkId);
        this._gates[gateId].graph = null;
        delete this._gates[gateId];
    }
    getGate(gateId) {
        return this._gates[gateId];
    }
    getLink(linkId) {
        return this._links[linkId];
    }
    observe() {
        this._observed = true;
    }
    unobserve() {
        this._observed = false;
    }
    get observed() {
        return this._observed;
    }
}

class WorkerEngineWorker {
    constructor() {
        this._interval = 10;
        this._graphs = Object.create(null);
        this._queue = new Map();
        this._pq = new FastPriorityQueue();
        this._toUpdate = new Map();
        this._tick = 0;
        this._sender = setInterval(() => {
            this._sendUpdates();
        }, 25);
        this._updater = null;
    }
    interval(ms) {
        this._interval = ms;
    }
    updateGates() {
        if (this._pq.peek() == this._tick) this.updateGatesNext();
        else {
            const k = this._tick | 0;
            this._tick = (k + 1) | 0;
        }
    }
    updateGatesNext() {
        const k = this._pq.poll() | 0;
        console.assert(k >= this._tick);
        this._tick = k;
        const q = this._queue.get(k);
        while (q.size) {
            const [gate, args] = q.entries().next().value;
            q.delete(gate);
            if (specialGates.has(gate.get('type'))) continue;
            const graph = gate.graph;
            if (!graph) continue;
            const newOutputs = gate.operation(args);
            if ('_clock_hack' in newOutputs) {
                delete newOutputs['_clock_hack'];
                this._enqueue(gate);
            }
            this._setGateOutputSignals(gate, newOutputs);
        }
        this._queue.delete(k);
        this._tick = (k + 1) | 0;
    }
    start() {
        this.stop();
        this._updater = setInterval(() => {
            this.updateGates();
        }, this._interval);
    }
    startFast() {
        this.stop();
        this._updater = setInterval(() => {
            const startTime = Date.now();
            while (Date.now() - startTime < 10 && this._hasPendingEvents())
                this.updateGatesNext();
            if (!this._hasPendingEvents) {
                this.stop();
                postMessage({ type: 'stopped', arg: this._tick });
            }
        }, 10);
    }
    stop() {
        if (this._updater) {
            clearInterval(this._updater);
            this._updater = null;
        }
    }
    addGraph(graphId) {
        console.assert(!(graphId in this._graphs));
        this._graphs[graphId] = new Graph(graphId);
    }
    addLink(graphId, linkId, source, target) {
        const graph = this._graphs[graphId];
        graph.addLink(linkId, source, target);
        const sourceGate = graph.getGate(source.id);
        const targetGate = graph.getGate(target.id);
        const sig = sourceGate.get('outputSignals')[source.port];
        const oldInput = targetGate.get('inputSignals')[target.port];
        if (!sig.eq(oldInput)) {
            targetGate.get('inputSignals')[target.port] = sig;
            this._enqueue(targetGate);
        }
    }
    addGate(graphId, gateId, gateParams, ports, inputSignals, outputSignals) {
        const graph = this._graphs[graphId];
        graph.addGate(gateId, gateParams, ports, inputSignals, outputSignals);
        this._enqueue(graph.getGate(gateId));
    }
    addSubcircuit(graphId, gateId, subgraphId, IOmap) {
    }
    removeLink(graphId, linkId) {
        const graph = this._graphs[graphId];
        const link = graph.getLink(linkId);
        graph.removeLink(linkId);
        const targetGate = graph.getGate(target.id);
        const oldInput = targetGate.get('inputSignals')[target.port];
        const sig = Vector3vl.xes(oldInput.bits);
        if (!sig.eq(oldInput)) {
            targetGate.get('inputSignals')[target.port] = sig;
            this._enqueue(targetGate);
        }
    }
    removeGate(graphId, gateId) {
        this._graphs[graphId].removGate(gateId);
    }
    observeGraph(graphId) {
        this._graphs[graphId].observe();
    }
    unobserveGraph(graphId) {
        this._graphs[graphId].unobserve();
    }
    changeInput(graphId, gateId, sig) {
        const gate = this._graphs[graphId].getGate(gateId);
        this._setGateOutputSignals(gate, { out: Vector3vl.fromClonable(sig) });
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
    _setGateOutputSignals(gate, newOutputs) {
        const oldOutputs = gate.get('outputSignals');
        gate.set('outputSignals', newOutputs);
        for (const port of Object.keys(newOutputs)) {
            if (oldOutputs[port].eq(newOutputs[port])) continue;
            this._markUpdate(gate, port);
            for (const target of gate.targets(port)) {
                const targetGate = gate.graph.getGate(target.id);
                const inputs = targetGate.get('inputSignals');
                inputs[target.port] = newOutputs[port];
                this._enqueue(targetGate);
            }
        }
    }
    _markUpdate(gate, port) {
        if (!gate.graph.observed) return;
        const s = (() => {
            const v = this._toUpdate.get(gate);
            if (v !== undefined) return v;
            const r = new Set();
            this._toUpdate.set(gate, r);
            return r;
        })();
        s.add(port);
    }
    _sendUpdates() {
        const updates = [];
        for (const [gate, ports] of this._toUpdate) {
            const outputSignals = gate.get('outputSignals');
            const outputs = {};
            for (const port of ports)
                outputs[port] = outputSignals[port];
            updates.push([gate.graph.id, gate.id, outputs]);
        }
        this._toUpdate = new Map();
        const pendingEvents = this._hasPendingEvents();
        postMessage({ type: 'update', args: [this._tick, pendingEvents, updates] });
    }
    _hasPendingEvents() {
        return this._queue.size > 0;
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
