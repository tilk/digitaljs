
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
        this.special = specialGates.has(gateParams.type);
        this.isSubcircuit = gateParams.type == 'Subcircuit';
        this.isOutput = gateParams.type == 'Output';
        const cell = cells[gateParams.type].prototype;
        this.operation = cell.operation;
        for (const helper of cell._operationHelpers)
            this[helper] = cell[helper];
        this.links = new Set();
        this._links_to = Object.create(null);
        this._params = gateParams;
        this._params.inputSignals = Object.create(null);
        this._params.outputSignals = Object.create(null);
        this._presentationParams = cell._presentationParams;
        this._presentationParamChanged = Object.create(null);
        this._monitors = Object.create(null);
        this._ports = Object.create(null);
        for (const port of ports) {
            this._ports[port.id] = port;
            this._monitors[port.id] = new Set();
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
        if (this._presentationParams.includes(name)) {
            worker._markPresentationParam(this, name);
        }
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
    getPort(port) {
        return this._ports[port];
    }
    getPorts() {
        return Object.values(this._ports);
    }
    trigger(event, ...args) {
        postMessage({ type: 'gateTrigger', args: [this.graph.id, this.id, event, args] });
    }
    monitor(port, monitorId) {
        this._monitors[port].add(monitorId);
    }
    unmonitor(port, monitorId) {
        this._monitors[port].delete(Number(monitorId));
    }
    getMonitors(port) {
        return this._monitors[port];
    }
}

class Graph {
    constructor(id) {
        this.id = id;
        this._gates = {};
        this._links = {};
        this._observed = false;
        this._subcircuit = null;
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
    getGates() {
        return Object.values(this._gates);
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
    setSubcircuit(gate) {
        this._subcircuit = gate;
    }
    get subcircuit() {
        return this._subcircuit;
    }
}

class WorkerEngineWorker {
    constructor() {
        this._interval = 10;
        this._graphs = Object.create(null);
        this._monitors = Object.create(null);
        this._monitorChecks = Object.create(null);
        this._alarms = Object.create(null);
        this._alarmQueue = new Map();
        this._queue = new Map();
        this._pq = new FastPriorityQueue();
        this._toUpdate = new Map();
        this._toUpdateParam = new Map();
        this._tick = 0;
        this._sender = setInterval(() => {
            this._sendUpdates();
        }, 25);
        this._updater = null;
    }
    interval(ms) {
        this._interval = ms;
    }
    updateGates(reqid, sendUpdates) {
        const count = this._updateGates();
        if (sendUpdates) this._sendUpdates();
        this._postMonitors();
        this._sendAck(reqid, count);
    }
    _updateGates() {
        if (this._pq.peek() == this._tick) return this._updateGatesNext();
        else {
            const k = this._tick | 0;
            this._tick = (k + 1) | 0;
            return 0;
        }
    }
    updateGatesNext(reqid, sendUpdates) {
        const count = this._updateGatesNext();
        if (sendUpdates) this._sendUpdates();
        this._postMonitors();
        this._sendAck(reqid, count);
    }
    _updateGatesNext() {
        const k = this._pq.poll() | 0;
        console.assert(k >= this._tick);
        this._tick = k;
        const q = this._queue.get(k);
        let count = 0;
        while (q.size) {
            const [gate, args] = q.entries().next().value;
            q.delete(gate);
            if (gate.special) continue;
            const graph = gate.graph;
            if (!graph) continue;
            const newOutputs = gate.operation(args);
            if ('_clock_hack' in newOutputs) {
                delete newOutputs['_clock_hack'];
                this._enqueue(gate);
            }
            this._setGateOutputSignals(gate, newOutputs);
            count++;
        }
        this._queue.delete(k);
        this._tick = (k + 1) | 0;
        return count;
    }
    ping(reqid, sendUpdates) {
        if (sendUpdates) this._sendUpdates();
        this._sendAck(reqid);
    }
    start() {
        this._stop();
        this._updater = setInterval(() => {
            this._updateGates();
            this._postMonitors();
        }, this._interval);
    }
    startFast() {
        this._stop();
        this._updater = setInterval(() => {
            const startTime = Date.now();
            while (Date.now() - startTime < 10 && this._hasPendingEvents() && this._updater) {
                this._updateGatesNext();
                this._postMonitors();
            }
        }, 10);
    }
    stop(reqid, sendUpdates) {
        this._stop();
        if (sendUpdates) this._sendUpdates();
        this._sendAck(reqid);
    }
    _stop() {
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
        this._setGateInputSignal(targetGate, target.port, sig);
    }
    addGate(graphId, gateId, gateParams, ports, inputSignals, outputSignals) {
        const graph = this._graphs[graphId];
        graph.addGate(gateId, gateParams, ports, inputSignals, outputSignals);
        this._enqueue(graph.getGate(gateId));
    }
    addSubcircuit(graphId, gateId, subgraphId, IOmap) {
        const graph = this._graphs[graphId];
        const gate = graph.getGate(gateId);
        const subgraph = this._graphs[subgraphId];
        gate.set('subgraph', subgraph);
        gate.set('circuitIOmap', IOmap);
        subgraph.setSubcircuit(gate);
        for (const [port, ioId] of Object.entries(IOmap)) {
            const io = subgraph.getGate(ioId);
            if (gate.getPort(port).dir == 'in') {
                this._setGateOutputSignal(io, 'out', gate.get('inputSignals')[port]);
            }
            if (gate.getPort(port).dir == 'out') {
                this._setGateOutputSignal(gate, port, io.get('inputSignals').in);
            }
        }
    }
    removeLink(graphId, linkId) {
        const graph = this._graphs[graphId];
        const link = graph.getLink(linkId);
        graph.removeLink(linkId);
        const targetGate = graph.getGate(link.target.id);
        const sig = Vector3vl.xes(targetGate.getPort(link.target.port).bits);
        this._setGateInputSignal(targetGate, link.target.port, sig);
    }
    removeGate(graphId, gateId) {
        this._graphs[graphId].removeGate(gateId);
    }
    observeGraph(graphId) {
        const graph = this._graphs[graphId];
        graph.observe();
        for (const gate of graph.getGates())
            for (const port of gate.getPorts())
                if (port.dir == 'out')
                    this._markUpdate(gate, port.id);
    }
    unobserveGraph(graphId) {
        this._graphs[graphId].unobserve();
    }
    changeInput(graphId, gateId, sig) {
        const gate = this._graphs[graphId].getGate(gateId);
        this._setGateOutputSignals(gate, { out: Vector3vl.fromClonable(sig) });
    }
    manualMemChange(graphId, gateId, addr, data) {
        const gate = this._graphs[graphId].getGate(gateId);
        gate.memdata.set(addr, Vector3vl.fromClonable(data));
        this._enqueue(gate);
    }
    monitor(graphId, gateId, port, monitorId, {triggerValues, stopOnTrigger, oneShot, synchronous }) {
        if (triggerValues != undefined)
            for (const k of triggerValues.keys())
                triggerValues[k] = Vector3vl.fromClonable(triggerValues[k]);
        const gate = this._graphs[graphId].getGate(gateId);
        this._monitors[monitorId] = { gate, port, triggerValues, stopOnTrigger, oneShot, synchronous };
        gate.monitor(port, monitorId);
        if (triggerValues == undefined)
            postMessage({ type: 'monitorValue', args: [monitorId, this._tick, gate.get('outputSignals')[port]] });
    }
    unmonitor(monitorId) {
        const monitor = this._monitors[monitorId];
        if (monitor == undefined) return;
        monitor.gate.unmonitor(monitor.port, monitorId);
        delete this._monitors[monitorId];
        delete this._monitorChecks[monitorId];
    }
    alarm(tick, alarmId, {stopOnAlarm, synchronous}) {
        if (tick <= this._tick) return;
        this._alarms[alarmId] = { tick, stopOnAlarm, synchronous };
        if (!this._alarmQueue.has(tick))
            this._alarmQueue.set(tick, new Set());
        this._alarmQueue.get(tick).add(alarmId);
        this._pq.add(tick-1);
        if (!this._queue.has(tick-1))
            this._queue.set(tick-1, new Map());
    }
    unalarm(alarmId) {
        const alarm = this._alarms[alarmId];
        if (alarm == undefined) return;
        const tick = alarm.tick;
        this._alarmQueue.get(tick).delete(alarmId);
        if (this._alarmQueue.get(tick).size == 0)
            this._alarmQueue.delete(tick);
        delete this._alarms[alarmId];
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
        sq.set(gate, Object.assign({}, gate.get('inputSignals')));
    }
    _postMonitors() {
        for (const [monitorId, sig] of Object.entries(this._monitorChecks)) {
            const {triggerValues, stopOnTrigger, oneShot, synchronous} = this._monitors[monitorId];
            let triggered = true;
            if (triggerValues)
                triggered = triggerValues.some((triggerValue) => sig.eq(triggerValue));
            if (triggered) {
                if (oneShot) this.unmonitor(monitorId);
                if (synchronous) this._sendUpdates();
                postMessage({ type: 'monitorValue', args: [monitorId, this._tick, sig, stopOnTrigger, oneShot] });
                if (stopOnTrigger) this._stop();
            }
        }
        this._monitorChecks = Object.create(null);
        if (this._alarmQueue.get(this._tick)) {
            for (const alarmId of this._alarmQueue.get(this._tick)) {
                const { stopOnAlarm, synchronous } = this._alarms[alarmId];
                if (synchronous) this._sendUpdates();
                delete this._alarms[alarmId];
                postMessage({ type: 'alarmReached', args: [alarmId, this._tick, stopOnAlarm] });
                if (stopOnAlarm) this._stop();
            }
            this._alarmQueue.delete(this._tick);
        }
    }
    _setGateOutputSignals(gate, newOutputs) {
        for (const [port, sig] of Object.entries(newOutputs)) {
            this._setGateOutputSignal(gate, port, sig);
        }
    }
    _setGateOutputSignal(gate, port, sig) {
        const outputs = gate.get('outputSignals');
        const oldOutput = outputs[port];
        if (sig.eq(oldOutput)) return;
        outputs[port] = sig;
        this._markUpdate(gate, port);
        for (const target of gate.targets(port)) {
            const targetGate = gate.graph.getGate(target.id);
            this._setGateInputSignal(targetGate, target.port, sig);
        }
        const monitors = gate.getMonitors(port);
        for (const monitorId of monitors)
            this._monitorChecks[monitorId] = sig;
    }
    _setGateInputSignal(targetGate, port, sig) {
        const inputs = targetGate.get('inputSignals');
        const oldInput = inputs[port];
        if (sig.eq(oldInput)) return;
        inputs[port] = sig;
        if (targetGate.isSubcircuit) {
            const subgraph = targetGate.get('subgraph');
            if (!subgraph) return;
            const iomap = targetGate.get('circuitIOmap');
            const gate = subgraph.getGate(iomap[port]);
            if (!gate) return;
            this._setGateOutputSignals(gate, { out: sig });
        } else if (targetGate.isOutput) {
            const subcir = targetGate.graph.subcircuit;
            if (!subcir) return;
            const subcirPort = targetGate.get('net');
            this._setGateOutputSignal(subcir, subcirPort, sig);
        } else {
            this._enqueue(targetGate);
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
    _markPresentationParam(gate, param) {
        if (!gate.graph.observed) return;
        const s = (() => {
            const v = this._toUpdateParam.get(gate);
            if (v !== undefined) return v;
            const r = new Set();
            this._toUpdateParam.set(gate, r);
            return r;
        })();
        s.add(param);
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
        if (this._toUpdateParam.size > 0) {
            for (const [gate, params] of this._toUpdateParam) {
                for (const param of params)
                    postMessage({ type: 'gateSet', args: [gate.graph.id, gate.id, param, gate.get(param) ] });
            }
            this._toUpdateParam = new Map();
        }
    }
    _sendAck(reqid, response) {
        postMessage({ type: 'ack', args: [reqid, response] });
    }
    _hasPendingEvents() {
        return this._queue.size > 0;
    }
};

const worker = new WorkerEngineWorker();

self.onmessage = (e) => {
    const msg = e.data;
    if ('arg' in msg)
        worker[msg.type](msg.arg);
    else if ('args' in msg)
        worker[msg.type].apply(worker, msg.args);
    else
        worker[msg.type]();
}

