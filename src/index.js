"use strict";

import joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/themes/base/all.css';
import './joint.js';
import './style.css';
    
function getCellType(tp) {
    const types = {
        '$and': joint.shapes.digital.And,
        '$or': joint.shapes.digital.Or,
        '$xor': joint.shapes.digital.Xor,
        '$not': joint.shapes.digital.Not,
        '$constant': joint.shapes.digital.Constant,
        '$button': joint.shapes.digital.Button,
        '$lamp': joint.shapes.digital.Lamp,
        '$numdisplay': joint.shapes.digital.NumDisplay,
        '$numentry': joint.shapes.digital.NumEntry,
        '$input': joint.shapes.digital.Input,
        '$output': joint.shapes.digital.Output,
        '$busgroup': joint.shapes.digital.BusGroup,
        '$busungroup': joint.shapes.digital.BusUngroup,
        '$busslice': joint.shapes.digital.BusSlice
    };
    if (tp in types) return types[tp];
    else return joint.shapes.digital.Subcircuit;
}
    
export class Circuit {
    constructor(data) {
        this.queue = new Set();
        this.graph = this.makeGraph(data, data.subcircuits);
        this.interval = setInterval(() => this.updateGates(), 10);
    }
    displayOn(elem) {
        return this.makePaper(elem, this.graph);
    }
    makePaper(elem, graph) {
        const paper = new joint.dia.Paper({
            el: elem,
            model: graph,
            width: 1000, height: 600, gridSize: 5,
            snapLinks: true,
            linkPinning: false,
            defaultLink: new joint.shapes.digital.Wire,
            validateConnection: function(vs, ms, vt, mt, e, vl) {
                if (e === 'target') {
                    if (!mt) return false;
                    const pt = vt.model.ports[mt.getAttribute('port')];
                    if (typeof pt !== 'object' || pt.dir !== 'in' || pt.bits !== vl.model.get('bits'))
                        return false;
                    const link = this.model.getConnectedLinks(vt.model).find((l) =>
                        l.id !== vl.model.id &&
                        l.get('target').id === vt.model.id &&
                        l.get('target').port === mt.getAttribute('port')
                    );
                    return !link;
                } else if (e === 'source') { 
                    const ps = vs.model.ports[ms.getAttribute('port')];
                    if (typeof ps !== 'object' || ps.dir !== 'out' || ps.bits !== vl.model.get('bits'))
                        return false;
                    return true;
                }
            }
        });
        graph.resetCells(graph.getCells());
        paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
        this.listenTo(paper, 'cell:pointerdblclick', function(view, evt) {
            if (!(view.model instanceof joint.shapes.digital.Subcircuit)) return;
            const div = $('<div>', { 
                title: view.model.get('type') + ' ' + view.model.get('label') 
            });
            const pdiv = $('<div>');
            div.append(pdiv);
            $('body').append(div);
            const paper = this.makePaper(pdiv, view.model.get('graph'));
            div.dialog({ minHeight: 'auto', minWidth: 'auto', width: 'auto' });
            div.on('dialogclose', function(evt) {
                paper.remove();
            });
        });
        return paper;
    }
    makeGraph(data, subcircuits) {
        const graph = new joint.dia.Graph();
        for (const devid in data.devices) {
            const dev = data.devices[devid];
            const cellType = getCellType(dev.type);
            const cellArgs = _.clone(dev);
            cellArgs.id = devid;
            if (cellType == joint.shapes.digital.Subcircuit)
                cellArgs.graph = this.makeGraph(subcircuits[dev.type], subcircuits);
            const cell = new cellType(cellArgs);
            graph.addCell(cell);
            this.queue.add(cell);
        }
        for (const conn of data.connectors) {
            graph.addCell(new joint.shapes.digital.Wire({
                source: {id: conn.from.id, port: conn.from.port},
                target: {id: conn.to.id, port: conn.to.port},
            }));
        }
        joint.layout.DirectedGraph.layout(graph, {
            nodeSep: 20,
            edgeSep: 0,
            rankSep: 110,
            rankDir: "LR"
        });
        this.listenTo(graph, 'change:buttonState', function(gate, sig) {
            this.queue.add(gate);
        });
        this.listenTo(graph, 'change:signal', function(wire, signal) {
            const gate = graph.getCell(wire.get('target').id);
            if (gate) setInput(signal, wire.get('target'), gate);
        });
        this.listenTo(graph, 'change:inputSignals', function(gate, sigs) {
            // forward the change back from a subcircuit
            if (gate instanceof joint.shapes.digital.Output) {
                const subcir = gate.graph.get('subcircuit');
                console.assert(subcir instanceof joint.shapes.digital.Subcircuit);
                subcir.set('outputSignals', _.chain(subcir.get('outputSignals'))
                    .clone().set(gate.get('net'), sigs.in).value());
            } else this.queue.add(gate);
        });
        this.listenTo(graph, 'change:outputSignals', function(gate, sigs) {
            _.chain(graph.getConnectedLinks(gate, {outbound: true}))
                .groupBy((wire) => wire.get('source').port)
                .forEach((wires, port) => 
                    wires.forEach((wire) => wire.set('signal', sigs[port])))
                .value();
        });
        this.listenTo(graph, 'change:source', function(wire, end) {
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                wire.set('signal', gate.get('outputSignals')[end.port]);
            } else {
                wire.set('signal', _.times(wire.get('bits'), _.constant(0)));
            }
        });
        function setInput(sig, end, gate) {
            gate.set('inputSignals', _.chain(gate.get('inputSignals'))
                .clone().set(end.port, sig).value());
            // forward the input change to a subcircuit
            if (gate instanceof joint.shapes.digital.Subcircuit) {
                const iomap = gate.get('circuitIOmap');
                const input = gate.get('graph').getCell(iomap[end.port]);
                console.assert(input instanceof joint.shapes.digital.Input);
                input.set('outputSignals', { out: sig });
            }
        }
        function clearInput(end, gate) {
            setInput(_.times(gate.ports[end.port].bits, _.constant(0)), end, gate);
        }
        this.listenTo(graph, 'change:target', function(wire, end) {
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                setInput(wire.get('signal'), end, gate);
            } 
            const pend = wire.previous('target');
            const pgate = graph.getCell(pend.id);
            if (pgate && 'port' in pend) {
                clearInput(pend, pgate);
            }
        });
        this.listenTo(graph, 'remove', function(cell, coll, opt) {
            if (!cell.isLink()) return;
            const end = cell.get('target');
            const gate = graph.getCell(end.id);
            if (gate && 'port' in end) {
                clearInput(end, gate);
            }
        });
        this.listenTo(graph, 'add', function(cell, coll, opt) {
            if (!cell.isLink()) return;
            const strt = cell.get('source');
            const sgate = graph.getCell(strt.id);
            if (sgate && 'port' in strt) {
                cell.set('signal', sgate.get('outputSignals')[strt.port]);
                cell.set('bits', sgate.ports[strt.port].bits);
            }
        });
        return graph;
    }
    updateGates() {
        const q = this.queue;
        this.queue = new Set();
        const changes = [];
        for (const gate of q) {
            if (gate instanceof joint.shapes.digital.Subcircuit) continue;
            if (gate instanceof joint.shapes.digital.Input) continue;
            if (gate instanceof joint.shapes.digital.Output) continue;
            const graph = gate.graph;
            if (!graph) continue;
/*
            const args = _.chain(graph.getConnectedLinks(gate, {inbound: true}))
                .groupBy((wire) => wire.get('target').port)
                .mapValues((wires) => wires[0].get('signal'))
                .value();
*/
            const args = gate.get('inputSignals');
            for (const pname in gate.ports) {
                if (gate.ports[pname].dir !== 'in') continue;
                if (!(pname in args)) args[pname] = 0;
            }
            const sigs = gate.operation(args);
            changes.push([gate, sigs]);
        }
        console.assert(this.queue.size == 0);
        for (const [gate, sigs] of changes) {
            gate.set('outputSignals', sigs);
        }
    }
};

_.extend(Circuit.prototype, Backbone.Events);

