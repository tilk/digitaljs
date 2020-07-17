"use strict";

import * as joint from 'jointjs';
import _ from 'lodash';
import bigInt from 'big-integer';
import { Vector3vl } from '3vl';

export const portGroupAttrs = {
    wire: {
        stroke: '#4B4F6A',
        x1: 0, y1: 0,
        x2: undefined, y2: 0
    },
    port: {
        magnet: undefined,
        r: 7,
        stroke: 'black',
        fill: 'white',
        strokeWidth: 2,
        strokeOpacity: 0.5
    },
    bits: {
        ref: 'port',
        fill: 'black',
        fontSize: '7pt'
    },
    iolabel: {
        textVerticalAnchor: 'middle',
        fill: 'black',
        fontSize: '8pt'
    },
    decor: {
        stroke: 'black',
        fill: 'transparent',
        d: undefined
    }
};

// Common base class for gate models
export const Gate = joint.shapes.basic.Generic.define('Gate', {
    /* default properties */
    propagation: 1,
    label: '',
    
    size: { width: 80, height: 30 },
    inputSignals: {},
    outputSignals: {},
    attrs: {
        '.': { magnet: false },
        body: { stroke: 'black', strokeWidth: 2 },
        'text': {
            fontSize: '8pt',
            fill: 'black'
        },
        label: {
            refX: .5, refDy: 3,
            textAnchor: 'middle'
        }
    },
    ports: {
        groups: {
            'in': {
                position: 'left',
                attrs: _.merge({}, portGroupAttrs, {
                    wire: { x2: -25 },
                    port: { magnet: 'passive', refX: -25 },
                    bits: { refDx: 1, refY: -3, textAnchor: 'start' },
                    iolabel: { refX: 5, textAnchor: 'start' }
                })
            },
            'out': {
                position: 'right',
                attrs: _.merge({}, portGroupAttrs, {
                    wire: { x2: 25 },
                    port: { magnet: true, refX: 25 },
                    bits: { refX: -1, refY: -3, textAnchor: 'end' },
                    iolabel: { refX: -5, textAnchor: 'end' }
                })
            }
        }
    },

    z: 1
}, {
    operation: function() {
        return {};
    },
    initialize: function() {
        // pre-process ports
        const ports = this.get('ports');
        if (ports.items) {
            this._preprocessPorts(ports.items);
        }
        
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        
        this.bindAttrToProp('label/text', 'label');
        if (this.unsupportedPropChanges.length > 0) {
            this.on(this.unsupportedPropChanges.map(prop => 'change:'+prop).join(' '), function(model, _, opt) {
                if (opt.init) return;
                
                if (opt.propertyPath)
                    console.warn('Beta property change support: "' + opt.propertyPath + '" changes on ' + model.prop('type') + ' are currently not reflected.');
                else
                    console.warn('Beta property change support: changes on ' + model.prop('type') + ' are currently not reflected. Also consider using Cell.prop() instead of Model.set().');
            });
        }
    },
    changeOutputSignals: function(sigs) {
        _.chain(this.graph.getConnectedLinks(this, {outbound: true}))
            .groupBy((wire) => wire.get('source').port)
            .forEach((wires, port) => 
                wires.forEach((wire) => wire.set('signal', sigs[port])))
            .value();
    },
    setInput: function(sig, port) {
        const signals = _.clone(this.get('inputSignals'));
        signals[port] = sig;
        this.set('inputSignals', signals);
    },
    clearInput: function(port) {
        const bits = this.getPort(port).bits;
        this.setInput(Vector3vl.xes(bits), port);
    },
    bindAttrToProp: function(attr, prop) {
        this.attr(attr, this.get(prop));
        this.on('change:' + prop, (_, val) => this.attr(attr, val));
    },
    _preprocessPorts: function(ports) {
        for (const port of ports) {
            const signame = port.dir === 'in' ? 'inputSignals' : 'outputSignals';
            this.get(signame)[port.id] = Vector3vl.xes(port.bits);
            console.assert(port.bits > 0);
            
            port.attrs = {};
            port.attrs['bits'] = { text: this.getBitsText(port.bits) }
            if (port.labelled) {
                const iolabel = { text: 'portlabel' in port ? port.portlabel : port.id };
                if (port.polarity === false)
                    iolabel['text-decoration'] = 'overline';
                if (port.decor) {
                    console.assert(port.group == 'in');
                    iolabel['refX'] = 10;
                }
                port.attrs['iolabel'] = iolabel;
            }
            if (port.decor) {
                port.attrs['decor'] = { d: port.decor };
            }
        }
    },
    setPortsBits: function(portsBits) {
        const ports = this.get('ports');
        for (const portid in portsBits) {
            const bits = portsBits[portid];
            const port = ports.items.find(function(port) {
                return port.id && port.id === portid;
            });
            port.bits = bits;
            port.attrs['bits'].text = this.getBitsText(bits);
            
            const signame = port.dir === 'in' ? 'inputSignals' : 'outputSignals';
            const signals = this.get(signame);
            signals[portid] = Vector3vl.xes(bits);
            this.set(signame, signals);
            
            this.graph.getConnectedLinks(this, { outbound: port.dir === 'out', inbound: port.dir === 'in' })
                .filter((wire) => wire.get(port.dir === 'out' ? 'source' : 'target').port === portid)
                .forEach((wire) => wire.checkConnection());
        }
        //trigger port changes on model and view
        this.trigger('change:ports', this, ports);
    },
    getBitsText: function(bits) {
        return bits > 1 ? bits : '';
    },
    removePortSignals: function(port) {
        port = port.id !== undefined ? port : this.getPort(port);
        const signame = port.dir === 'in' ? 'inputSignals' : 'outputSignals';
        this.removeProp([signame, port.id]);
    },
    addPort: function(port) {
        this.addPorts([port]);
    },
    addPorts: function(ports) {
        this._preprocessPorts(ports);
        joint.shapes.basic.Generic.prototype.addPorts.apply(this, arguments);
    },
    removePort: function(port, opt) {
        this.removePortSignals(port);
        joint.shapes.basic.Generic.prototype.removePort.apply(this, arguments);
    },
    removePorts: function(ports, opt) {
        ports.forEach((port) => this.removePortSignals(port), this);
        joint.shapes.basic.Generic.prototype.removePorts.apply(this, arguments);
    },
    getStackedPosition: function(opt) {
        return function(portsArgs, elBBox) {
            // ports stacked from top to bottom or left to right
            const side = opt.side || 'left';
            const step = opt.step || 16;
            const offset = opt.offset || 12;
            const x = side == 'left' ? elBBox.topLeft().x : side == 'right' ? elBBox.topRight().x : undefined;
            const y = side == 'top' ? elBBox.topLeft().y : side == 'bottom' ? elBBox.bottomRight().y : undefined;
            if (x !== undefined) {
                return _.map(portsArgs, function(portArgs, index) {
                    index += portArgs.idxOffset || 0;
                    return joint.g.Point({ x: x, y: index*step + offset });
                });
            } else {
                return _.map(portsArgs, function(portArgs, index) {
                    index += portArgs.idxOffset || 0;
                    return joint.g.Point({ x: index*step + offset, y: y });
                });
            }
        }
    },
    getLayoutSize: function() {
        return this.size();
    },
    setLayoutPosition: function(position) {
        this.set('position', {
            x: position.x - position.width / 2,
            y: position.y - position.height / 2
        });
    },
    portMarkup: [{
        tagName: 'line',
        className: 'wire',
        selector: 'wire'
    }, {
        tagName: 'circle',
        className: 'port',
        selector: 'port'
    }, {
        tagName: 'text',
        className: 'bits',
        selector: 'bits'
    }, {
        tagName: 'text',
        className: 'iolabel',
        selector: 'iolabel'
    }, {
        tagName: 'path',
        className: 'decor',
        selector: 'decor'
    }],
    //portLabelMarkup: null, //todo: see https://github.com/clientIO/joint/issues/1278
    markup: [{
        tagName: 'text',
        className: 'label',
        selector: 'label'
    }],
    getGateParams: function(layout) {
        return _.cloneDeep(_.pick(this.attributes, this.gateParams.concat(layout ? this.gateLayoutParams : [])));
    },
    gateParams: ['label', 'type', 'propagation'],
    gateLayoutParams: ['position'],
    unsupportedPropChanges: []
});

export const GateView = joint.dia.ElementView.extend({
    attrs: {
        signal: {
            high: { port: { 'stroke': '#03c03c' } },
            low: { port: { 'stroke': '#fc7c68' } },
            def: { port: { 'stroke': '#779ecb' } },
            undef: { port: { 'stroke': '#999' } }
        }
    },
    presentationAttributes: joint.dia.ElementView.addPresentationAttributes({
        inputSignals: 'SIGNAL',
        outputSignals: 'SIGNAL2'
    }),
    stopprop(evt) {
        evt.stopPropagation();
    },
    confirmUpdate(flags) {
        if (this.hasFlag(flags, 'SIGNAL')) {
            this.updatePortSignals('in');
        }
        if (this.hasFlag(flags, 'SIGNAL2')) {
            this.updatePortSignals('out');
        }
        joint.dia.ElementView.prototype.confirmUpdate.apply(this, arguments);
    },
    updatePortSignals(dir) {
        const signals =
            dir === 'in' ? this.model.get('inputSignals') :
            dir === 'out' ? this.model.get('outputSignals') :
            _.merge({}, this.model.get('inputSignals'), this.model.get('outputSignals'));
        for (const port in signals) {
            const attrs = this.attrs.signal[
                signals[port].isHigh ? 'high' :
                signals[port].isLow ? 'low' :
                signals[port].isDefined ? 'def' : 'undef'
            ];
            this.applyPortAttrs(port, attrs);
        }
    },
    applyAttrs(attrs) {
        for (const selector in attrs) {
            const node = this.selectors[selector];
            this.setNodeAttributes(node, attrs[selector]);
        }
    },
    applyPortAttrs(port, attrs) {
        for (const selector in attrs) {
            const node = this._portElementsCache[port].portSelectors[selector];
            this.setNodeAttributes(node, attrs[selector]);
        }
    },
    _updatePorts() {
        joint.dia.ElementView.prototype._updatePorts.apply(this, arguments);
        this.updatePortSignals();
    }
});

// Connecting wire model
export const Wire = joint.shapes.standard.Link.define('Wire', {
    attrs: {
        line: {
            class: 'connection',
            targetMarker: null
        },
        wrapper: {
            stroke: 'red'
        }
    },

    signal: Vector3vl.xes(1),
    bits: 1,
    warning: false,

    // show behind gates
    z: 0
}, {
    initialize: function(args) {
        joint.shapes.standard.Link.prototype.initialize.apply(this, arguments);
        if (this.has('netname')) {
            this.label(0, {
                markup: [
                    {
                        tagName: 'text',
                        selector: 'label'
                    }
                ],
                attrs: {
                    label: {
                        text: this.get('netname'),
                        fill: 'black',
                        fontSize: '8pt'
                    }
                },
                position: {
                    distance: 0.5
                }
            });
        }
    },
    onAdd: function() {
        this.changeSource(this.get('source'));
    },
    remove: function() {
        //remove warning if inside subcircuit
        this.set('warning', false);
        const tar = this.get('target');
        const target = this.graph.getCell(tar.id);
        if (target && 'port' in tar) {
            target.clearInput(tar.port);
        }
        joint.shapes.standard.Link.prototype.remove.apply(this, arguments);
    },
    changeSignal(sig) {
        const target = this.getTargetElement();
        if (target) target.setInput(sig, this.get('target').port);
    },
    changeSource(src) {
        const source = this.graph.getCell(src.id);
        if (source && 'port' in src) {
            this.set('bits', source.getPort(src.port).bits);
            this.checkConnection();
            //set signal after checking connection to avoid false signal propagation
            this.set('signal', source.get('outputSignals')[src.port]);
        } else {
            this.set('signal', Vector3vl.xes(this.get('bits')));
        }
    },
    changeTarget(tar) {
        const target = this.graph.getCell(tar.id);
        if (target && 'port' in tar) {
            target.setInput(this.get('signal'), tar.port);
        }
        this.checkConnection();
        const preTar = this.previous('target');
        const preTarget = this.graph.getCell(preTar.id);
        if (preTarget && 'port' in preTar) {
            preTarget.clearInput(preTar.port);
        }
    },
    checkConnection() {
        const tar = this.get('target');
        const target = this.graph.getCell(tar.id);
        this.set('warning', target && target.getPort(tar.port).bits !== this.get('bits'));
    },
    getWireParams: function(layout) {
        const connector = {
            from: {
                id: this.get('source').id,
                port: this.get('source').port
            },
            to: {
                id: this.get('target').id,
                port: this.get('target').port
            }
        };
        if (this.has('netname'))
            connector.name = this.get('netname');
        if (layout && this.has('vertices') && this.get('vertices').length > 0)
            connector.vertices = _.cloneDeep(this.get('vertices'));
        return connector;
    },
    getWirePath: function() {
        const hier = [];
        for (let sc = this.graph.get('subcircuit'); sc != null; sc = sc.graph.get('subcircuit')) {
            if (!sc.has('label')) return null;
            hier.push(sc.get('label'));
        }
        return hier.reverse();
    }
});

const circleArrowhead = {
    tagName: 'circle',
    attributes: {
        'r': 7,
        'fill': 'black',
        'fill-opacity': 0.3,
        'stroke': 'black',
        'stroke-width': 2,
        'cursor': 'move'
    }
};
const CircleSourceArrowhead = joint.linkTools.SourceArrowhead.extend(_.merge({}, circleArrowhead));
const CircleTargetArrowhead = joint.linkTools.TargetArrowhead.extend(_.merge({}, circleArrowhead));

const DoublyButton = joint.linkTools.Button.extend({
    update: function() {
        if (this.relatedView.isShortWire())
            this.options.distance = this.options.distanceShort || this.options.distance;
        else
            this.options.distance = this.options.distanceLong || this.options.distance;
        return joint.linkTools.Button.prototype.update.apply(this, arguments);
    },
    show: function() {
        if (this.options.secondary && this.relatedView.isShortWire()) return;
        joint.linkTools.Button.prototype.show.apply(this, arguments);
    }
});
const RemoveButton = DoublyButton.extend({
    name: 'remove',
    children: joint.linkTools.Remove.prototype.children,
    options: joint.linkTools.Remove.prototype.options
});
const MonitorButton = DoublyButton.extend({
    name: 'monitor',
    children: [{
        tagName: 'circle',
        selector: 'button',
        attributes: {
            'r': 7,
            'fill': '#001DFF',
            'cursor': 'pointer'
        }
    }, {
        tagName: 'path',
        selector: 'icon',
        attributes: {
            'd': 'm -2.5,-0.5 a 2,2 0 1 0 4,0 2,2 0 1 0 -4,0 M 1,1 3,3',
            'fill': 'none',
            'stroke': '#FFFFFF',
            'stroke-width': 2,
            'pointer-events': 'none'
        }
    }],
    options: {
        action: function(evt) {
            this.notify('link:monitor');
        }
    }
});

export const WireView = joint.dia.LinkView.extend({
    initFlag: joint.dia.LinkView.prototype.initFlag.concat(['INIT']),

    longWireLength: 400,
    attrs: {
        signal: {
            high: { line: { 'stroke': '#03c03c' } },
            low: { line: { 'stroke': '#fc7c68' } },
            def: { line: { 'stroke': '#779ecb' } },
            undef: { line: { 'stroke': '#999' } }
        },
        bits: {
            bus: { line: { 'stroke-width': '4px' } },
            single: { line: { 'stroke-width': '2px' } }
        },
        warning: {
            warn: { wrapper: { 'stroke-opacity': '0.5' } },
            none: { wrapper: { 'stroke-opacity': '0' } }
        }
    },

    presentationAttributes: joint.dia.LinkView.addPresentationAttributes({
        signal: 'SIGNAL',
        bits: 'BITS',
        warning: 'WARNING'
    }),

    initialize() {
        joint.dia.LinkView.prototype.initialize.apply(this, arguments);
        this.prevModels = { source: null, target: null };
    },

    confirmUpdate(flags) {
        joint.dia.LinkView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'SIGNAL')) {
            this.updateSignal();
        }
        if (this.hasFlag(flags, 'BITS')) {
            this.updateBits();
        }
        if (this.hasFlag(flags, 'WARNING')) {
            this.updateWarning();
        }
        if (this.hasFlag(flags, 'INIT')) {
            if (this.hasTools()) return;

            const verticesTool = new joint.linkTools.Vertices({ focusOpacity: 0.5 });
            //const segmentsTool = new joint.linkTools.Segments({ focusOpacity: 0.5 }); //todo: problem with signal reset ??
            const sourceCircle = new CircleSourceArrowhead();
            const targetCircle = new CircleTargetArrowhead();
            const removeButton1 = new RemoveButton({ distanceShort: '75%', distanceLong: '50' });
            const removeButton2 = new RemoveButton({ distance: '-50', secondary: true });
            const monitorButton1 = new MonitorButton({ distanceShort: '25%', distanceLong: '30' });
            const monitorButton2 = new MonitorButton({ distance: '-30', secondary: true });

            const toolsView = new joint.dia.ToolsView({
                tools: [
                    verticesTool,
                    //segmentsTool,
                    sourceCircle,
                    targetCircle,
                    removeButton1,
                    removeButton2,
                    monitorButton1,
                    monitorButton2
                ]
            });
            this.addTools(toolsView);
            this.hideTools();
        }
    },

    isShortWire() {
        return this.getConnectionLength() < this.longWireLength;
    },

    updateSignal() {
        const signal = this.model.get('signal');
        const attrs = this.attrs.signal[
            signal.isHigh ? 'high' :
            signal.isLow ? 'low' :
            signal.isDefined ? 'def' : 'undef'
        ];
        this.applyAttrs(attrs);
    },

    updateBits() {
        const bits = this.model.get('bits');
        const attrs = this.attrs.bits[
            bits > 1 ? 'bus' : 'single'
        ];
        this.applyAttrs(attrs);
    },

    updateWarning() {
        const warning = this.model.get('warning');
        const attrs = this.attrs.warning[
            warning ? 'warn' : 'none'
        ];
        this.applyAttrs(attrs);
    },

    applyAttrs(attrs) {
        for (const selector in attrs) {
            const node = this.selectors[selector];
            this.setNodeAttributes(node, attrs[selector]);
        }
    },

    update() {
        joint.dia.LinkView.prototype.update.apply(this, arguments);
        this.updateSignal();
        this.updateBits();
        this.updateWarning();
    },

    onRemove() {
        joint.dia.LinkView.prototype.onRemove.apply(this, arguments);
        this.hover_remove();
    },

    mouseenter: function(evt) {
        joint.dia.LinkView.prototype.mouseenter.apply(this, arguments);
        this.showTools();

        if (this.model.get('bits') == 1) return;
        this.wire_hover = $('<div class="wire_hover">')
            .css('left', evt.clientX + 5)
            .css('top', evt.clientY + 5)
            .appendTo($(document.body));
        this.hover_gentext();
        this.listenTo(this.model, 'change:signal', this.hover_gentext);
    },

    mouseleave: function(evt) {
        joint.dia.LinkView.prototype.mouseleave.apply(this, arguments);
        this.hideTools();
        this.hover_remove();
    },

    hover_remove() {
        if (this.wire_hover) {
            this.wire_hover.remove();
            this.wire_hover = null;
            this.stopListening(this.model, 'change:signal', this.hover_gentext);
        }
    },

    hover_gentext() {
        if (!this.wire_hover) return;
        const sig = this.model.get('signal');
        const display3vl = this.model.graph._display3vl;
        const hovertext = [
            'Hex: ' + display3vl.show('hex', sig) + '<br>',
            'Dec: ' + display3vl.show('dec', sig) + '<br>',
            'Oct: ' + display3vl.show('oct', sig) + '<br>',
            'Bin: ' + display3vl.show('bin', sig)
        ].join('');
        this.wire_hover.html(hovertext);
    },

    // Quick-and-dirty performance fix
    onEndModelChange(endType, endModel, opt) {
        if (typeof endModel == 'object' && endModel != null &&
            endModel == this.prevModels[endType] &&
            Object.keys(endModel.changed).length > 0 &&
            !('position' in endModel.changed)) return;
        joint.dia.LinkView.prototype.onEndModelChange.apply(this, arguments);
        this.prevModels[endType] = endModel;
    }
});

export const Box = Gate.define('Box', {
    attrs: {
        body: { refWidth: 1, refHeight: 1 },
        tooltip: { refX: 0, refY: -30, height: 30 }
    }
}, {
    initialize: function(args) {
        Gate.prototype.initialize.apply(this, arguments);
        this.on('change:size', (_, size) => {
            if (size.width > this.tooltipMinWidth) {
                this.attr('tooltip', { refWidth: 1, width: null });
            } else {
                this.attr('tooltip', { refWidth: null, width: this.tooltipMinWidth });
            }
        });
        this.trigger('change:size', this, this.prop('size'));
    },
    markup: Gate.prototype.markup.concat([{
            tagName: 'rect',
            className: 'body',
            selector: 'body'
        }
    ]),
    markupZoom: [{
        tagName: 'foreignObject',
        className: 'tooltip',
        selector: 'tooltip',
        children: [{
            tagName: 'body',
            namespaceURI: 'http://www.w3.org/1999/xhtml',
            children: [{
                tagName: 'a',
                className: 'zoom',
                textContent: '🔍',
                style: { cursor: 'pointer' }
            }]
        }]
    }],
    tooltipMinWidth: 20,
    decorClock: 'M' + [
                    [0, -6],
                    [6, 0],
                    [0, 6]
                ].map(l => l.join(' ')).join(' L')
});

// base class for gates displayed as a box
export const BoxView = GateView.extend({
    autoResizeBox: false,
    render: function() {
        GateView.prototype.render.apply(this, arguments);
        if (this.autoResizeBox) {
            if (this.model.get('box_resized')) return;
            this.model.set('box_resized', true);
            this.model.prop('size/width', this.calculateBoxWidth());
        }
    },
    calculateBoxWidth: function() {
        const leftlabels = Array.from(this.el.querySelectorAll('[port-group=in] > text.iolabel'));
        const rightlabels = Array.from(this.el.querySelectorAll('[port-group=out] > text.iolabel'));
        const leftwidth = Math.max(...leftlabels.map(x => x.getBBox().width));
        const rightwidth = Math.max(...rightlabels.map(x => x.getBBox().width));
        const fixup = x => x == -Infinity ? -5 : x;
        const width = fixup(leftwidth) + fixup(rightwidth) + 25;
        return width;
    }
});

