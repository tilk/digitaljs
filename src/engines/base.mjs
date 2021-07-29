
import _ from 'lodash';
import Backbone from 'backbone';

export class BaseEngine {
    constructor(graph) {
        this._graph = graph;
    }
    _addGate(elem) {
        if (elem.get('type') == 'Subcircuit')
            this._addGraph(elem.get('graph'));
    }
    _addLink(link) {
    }
    _addGraph(graph) {
        for (const elem of graph.getElements())
            this._addGate(elem);
        for (const link of graph.getLinks())
            this._addLink(link);
    }
};

_.extend(BaseEngine.prototype, Backbone.Events);


