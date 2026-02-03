
import { util, mvc } from '@joint/core';

export class BaseEngine {
    constructor(graph) {
        this._graph = graph;
    }
    _addGate(graph, gate) {
        if (gate.get('type') == 'Subcircuit')
            this._addGraph(gate.get('graph'));
    }
    _addLink(graph, link) {
    }
    _addGraph(graph) {
        this.listenTo(graph, 'add', (cell) => {
            if (cell.isLink()) {
                this._addLink(graph, cell);
            } else {
                this._addGate(graph, cell);
            }
        });
        this.listenTo(graph, 'remove', (cell) => {
            if (cell.isLink()) {
                this._removeLink(graph, cell);
            } else {
                this._removeGate(graph, cell);
            }
        });
        this.listenTo(graph, 'change:source', (link, src) => {
            this._changeLinkSource(graph, link, src, link.previous('source'));
        });
        this.listenTo(graph, 'change:target', (link, end) => {
            this._changeLinkTarget(graph, link, end, link.previous('target'));
        });
        this.listenTo(graph, 'change:warning', (link, warn) => {
            this._changeLinkWarning(graph, link, warn, link.previous('warning'));
        });
        for (const gate of graph.getElements())
            this._addGate(graph, gate);
        for (const link of graph.getLinks())
            this._addLink(graph, link);
    }
    _removeGate(graph, gate) {
    }
    _removeLink(graph, link) {
    }
    _changeLinkSource(graph, link, src, prevSrc) {
    }
    _changeLinkTarget(graph, link, end, prevEnd) {
    }
    _changeLinkWarning(graph, link, warn, prevWarn) {
    }
};

util.assign(BaseEngine.prototype, mvc.Events);


