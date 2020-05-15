"use strict";

import * as joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

export const portGroupAttrs = {
    'line.wire': {
        stroke: '#4B4F6A',
        x1: 0, y1: 0,
        x2: undefined, y2: 0
    },
    'circle.port': {
        magnet: undefined,
        r: 7,
        stroke: 'black',
        fill: 'white',
        strokeWidth: 2,
        strokeOpacity: 0.5,
        jointSelector: '.port'
    },
    'text.bits': {
        ref: 'circle.port',
        fill: 'black',
        fontSize: '7pt'
    },
    'text.iolabel': {
        textVerticalAnchor: 'middle',
        fill: 'black',
        fontSize: '8pt'
    },
    'path.decor': {
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
        '.body': { stroke: 'black', strokeWidth: 2 },
        'text': {
            fontSize: '8pt',
            fill: 'black'
        },
        'text.label': {
            refX: .5, refDy: 3,
            textAnchor: 'middle'
        }
    },
    ports: {
        groups: {
            'in': {
                position: 'left',
                attrs: _.merge({}, portGroupAttrs, {
                    'line.wire': { x2: -25 },
                    'circle.port': { magnet: 'passive', refX: -25 },
                    'text.bits': { refDx: 1, refY: -3, textAnchor: 'start' },
                    'text.iolabel': { refX: 5, textAnchor: 'start' }
                })
            },
            'out': {
                position: 'right',
                attrs: _.merge({}, portGroupAttrs, {
                    'line.wire': { x2: 25 },
                    'circle.port': { magnet: true, refX: 25 },
                    'text.bits': { refX: -1, refY: -3, textAnchor: 'end' },
                    'text.iolabel': { refX: -5, textAnchor: 'end' }
                })
            }
        }
    }
}, {
    operation: function() {
        return {};
    },
    initialize: function() {
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        
        this.bindAttrToProp('text.label/text', 'label');
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
    bindAttrToProp: function(attr, prop) {
        this.attr(attr, this.prop(prop));
        this.on('change:' + prop, (_, val) => this.attr(attr, val));
    },
    setPortBits: function(port, bits) {
        this.portProp(port, 'bits', bits);
        this.showPortBits(port, bits);
        this.resetPortSignals(port, bits);
        //todo: handle connected wires
        console.warn('Beta property change support: Connected wires are currently not rechecked for connection');
    },
    showPortBits: function(port, bits) {
        this.portProp(port, 'attrs/text.bits/text', bits > 1 ? bits : '');
    },
    resetPortSignals: function(port, bits) {
        const signame = this.portProp(port, 'dir') === 'in' ? 'inputSignals' : 'outputSignals';
        this.prop([signame, this.portProp(port, 'id')], Vector3vl.xes(bits));
    },
    removePortSignals: function(port) {
        const signame = port.dir === 'in' ? 'inputSignals' : 'outputSignals';
        this.removeProp([signame, port.id]);
    },
    addPort: function(port, opt = {}) {
        joint.shapes.basic.Generic.prototype.addPort.apply(this, arguments);
        this.showPortBits(port.id, port.bits);
        this.resetPortSignals(port.id, port.bits);
        if (opt.labelled) {
            this.portProp(port, 'attrs/text.iolabel/text', 'portlabel' in port ? port.portlabel : port.id);
            if (port.polarity === false)
                this.portProp(port, 'attrs/text.iolabel/text-decoration', 'overline');
            if (port.decor) {
                console.assert(port.group == 'in');
                this.portProp(port, 'attrs/text.iolabel/refX', 10);
            }
        }
        if (port.decor) {
            this.portProp(port, 'attrs/path.decor/d', port.decor);
        }
    },
    addPorts: function(ports, opt) {
        ports.forEach((port) => this.addPort(port, opt), this);
    },
    removePort: function(port, opt) {
        joint.shapes.basic.Generic.prototype.removePort.apply(this, arguments);
        this.removePortSignals(port.id !== undefined ? port.id : port);
    },
    removePorts: function(ports, opt) {
        ports.forEach((port) => this.removePort(port, opt), this);
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
        className: 'wire'
    }, {
        tagName: 'circle',
        className: 'port'
    }, {
        tagName: 'text',
        className: 'bits'
    }, {
        tagName: 'text',
        className: 'iolabel'
    }, {
        tagName: 'path',
        className: 'decor'
    }],
    //portLabelMarkup: null, //todo: see https://github.com/clientIO/joint/issues/1278
    markup: [{
        tagName: 'text',
        className: 'label'
    }],
    getGateParams: function(layout) {
        return _.cloneDeep(_.pick(this.attributes, this.gateParams.concat(layout ? this.gateLayoutParams : [])));
    },
    gateParams: ['label', 'type', 'propagation'],
    gateLayoutParams: ['position'],
    unsupportedPropChanges: []
});

export const GateView = joint.dia.ElementView.extend({
    presentationAttributes: joint.dia.ElementView.addPresentationAttributes({
        inputSignals: 'flag:inputSignals',
        outputSignals: 'flag:outputSignals'
    }),
    stopprop(evt) {
        evt.stopPropagation();
    },
    confirmUpdate(flags) {
        if (this.hasFlag(flags, 'flag:inputSignals')) {
            this.updatePortSignals('in', this.model.get('inputSignals'));
        }
        if (this.hasFlag(flags, 'flag:outputSignals')) {
            this.updatePortSignals('out', this.model.get('outputSignals'));
        }
        joint.dia.ElementView.prototype.confirmUpdate.apply(this, arguments);
    },
    updatePortSignals(dir, signal) {
        for (const port of this.model.getPorts()) {
            if (port.dir !== dir) continue;
            const portel = this.el.querySelector('[port='+port.id+']');
            portel.classList.toggle('live', signal[port.id].isHigh);
            portel.classList.toggle('low', signal[port.id].isLow);
            portel.classList.toggle('defined', signal[port.id].isDefined);
        }
    },
    render() {
        joint.dia.ElementView.prototype.render.apply(this, arguments);
        this.updatePortSignals('in', this.model.get('inputSignals'));
        this.updatePortSignals('out', this.model.get('outputSignals'));
    }
});

// Connecting wire model
export const Wire = joint.dia.Link.define('Wire', {
    attrs: {
        '.connection': { 'stroke-width': 2 },
        '.marker-vertex': { r: 7 }
    },
    signal: Vector3vl.xes(1),
    bits: 1,

    router: { name: 'orthogonal' },
    connector: { name: 'rounded', args: { radius: 10 }}
}, {
    markup: [
        '<path class="connection" stroke="black" d="M 0 0 0 0"/>',
//        '<path class="marker-source" fill="black" stroke="black" d="M 0 0 0 0"/>',
//        '<path class="marker-target" fill="black" stroke="black" d="M 0 0 0 0"/>',
        '<path class="connection-wrap" d="M 0 0 0 0"/>',
        '<g class="labels"/>',
        '<g class="marker-vertices"/>',
        '<g class="marker-arrowheads"/>',
        '<g class="link-tools"/>'
    ].join(''),

    toolMarkup: [
        '<g class="link-tool">',
        '<g class="tool-remove" event="remove">',
        '<circle r="11" />',
        '<path transform="scale(.8) translate(-16, -16)" d="M24.778,21.419 19.276,15.917 24.777,10.415 21.949,7.585 16.447,13.087 10.945,7.585 8.117,10.415 13.618,15.917 8.116,21.419 10.946,24.248 16.447,18.746 21.948,24.248z" />',
        '<title>Remove link.</title>',
        '</g>',
        '<g class="tool-monitor" event="link:monitor">',
        '<circle r="11" transform="translate(25)"/>',
        '<path fill="white" transform="scale(.025) translate(750, -250)" d="m280,278a153,153 0 1,0-2,2l170,170m-91-117 110,110-26,26-110-110"/>',
        '<title>Monitor link.</title>',
        '</g>',
        '</g>'
    ].join(''),

    arrowheadMarkup: [
        '<g class="marker-arrowhead-group marker-arrowhead-group-<%= end %>">',
        '<circle class="marker-arrowhead" end="<%= end %>" r="7"/>',
        '</g>'
    ].join(''),

    vertexMarkup: [
        '<g class="marker-vertex-group" transform="translate(<%= x %>, <%= y %>)">',
        '<circle class="marker-vertex" idx="<%= idx %>" r="10" />',
        '<g class="marker-vertex-remove-group">',
        '<path class="marker-vertex-remove-area" idx="<%= idx %>" d="M16,5.333c-7.732,0-14,4.701-14,10.5c0,1.982,0.741,3.833,2.016,5.414L2,25.667l5.613-1.441c2.339,1.317,5.237,2.107,8.387,2.107c7.732,0,14-4.701,14-10.5C30,10.034,23.732,5.333,16,5.333z" transform="translate(5, -33)"/>',
        '<path class="marker-vertex-remove" idx="<%= idx %>" transform="scale(.8) translate(9.5, -37)" d="M24.778,21.419 19.276,15.917 24.777,10.415 21.949,7.585 16.447,13.087 10.945,7.585 8.117,10.415 13.618,15.917 8.116,21.419 10.946,24.248 16.447,18.746 21.948,24.248z">',
        '<title>Remove vertex.</title>',
        '</path>',
        '</g>',
        '</g>'
    ].join(''),

    initialize: function(args) {
        joint.dia.Link.prototype.initialize.apply(this, arguments);
        this.router('metro', {
            startDirections: ['right'],
            endDirections: ['left'],
            maximumLoops: 200
        });
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
                        fill: 'black'
                    }
                },
                position: {
                    distance: 0.5
                }
            });
        }
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
    }
});

export const WireView = joint.dia.LinkView.extend({
    events: {
        'mouseenter': 'hover_mouseover',
        'mouseleave': 'hover_mouseout',
        'mousedown': 'hover_mouseout',
    },
    presentationAttributes: joint.dia.LinkView.addPresentationAttributes({
        signal: 'flag:signal',
        bits: 'flag:bits'
    }),

    _translateAndAutoOrientArrows(sourceArrow, targetArrow) {
        if (sourceArrow) {
            sourceArrow.translate(this.sourcePoint.x, this.sourcePoint.y, {absolute: true});
        }
        if (targetArrow) {
            targetArrow.translate(this.targetPoint.x, this.targetPoint.y, {absolute: true});
        }
    },

    initialize() {
        joint.dia.LinkView.prototype.initialize.apply(this, arguments);
        this.updateColor(this.model.get('signal'));
        this.$el.toggleClass('bus', this.model.get('bits') > 1);
        this.prevModels = { source: null, target: null };
    },
    
    confirmUpdate(flags) {
        joint.dia.LinkView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:signal')) {
            this.updateColor(this.model.get('signal'));
        };
        if (this.hasFlag(flags, 'flag:bits')) {
            this.$el.toggleClass('bus', this.model.get('bits') > 1);
        };
    },

    updateColor(sig) {
        const h = sig.isHigh, l = sig.isLow;
        this.$el.toggleClass('live', h);
        this.$el.toggleClass('low', l);
        this.$el.toggleClass('defined', !h && !l && sig.isDefined);
    },

    hover_mouseover(evt) {
        if (this.model.get('bits') == 1) return;
        if (this.wire_hover) this.hover_mouseout();
        this.wire_hover = $('<div class="wire_hover">')
            .css('left', evt.clientX + 5)
            .css('top', evt.clientY + 5)
            .appendTo($(document.body));
        this.hover_gentext();
        this.listenTo(this.model, 'change:signal', this.hover_gentext);
    },

    hover_mouseout() {
        if (this.wire_hover) {
            this.wire_hover.remove();
            this.wire_hover = null;
            this.stopListening(this.model, 'change:signal', this.hover_gentext);
        }
    },

    hover_gentext() {
        if (!this.wire_hover) return;
        const sig = this.model.get('signal');
        const hovertext = [
            'Hex: ' + sig.toHex() + '<br>',
            'Dec: ' + help.sig2base(sig, 'dec') + '<br>',
            'Oct: ' + sig.toOct() + '<br>',
            'Bin: ' + sig.toBin()
        ].join('');
        this.wire_hover.html(hovertext);
    },

    // custom options:
    options: joint.util.defaults({
        doubleLinkTools: true,
    }, joint.dia.LinkView.prototype.options),

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
        'rect.body': { refWidth: 1, refHeight: 1 },
        '.tooltip': { refX: 0, refY: -30, height: 30 }
    }
}, {
    initialize: function(args) {
        Gate.prototype.initialize.apply(this, arguments);
        this.on('change:size', (_, size) => {
            if (size.width > this.tooltipMinWidth) {
                this.attr('.tooltip', { refWidth: 1, width: null });
            } else {
                this.attr('.tooltip', { refWidth: null, width: this.tooltipMinWidth });
            }
        });
        this.trigger('change:size', this, this.prop('size'));
    },
    markup: Gate.prototype.markup.concat([{
            tagName: 'rect',
            className: 'body'
        }
    ]),
    markupZoom: [{
        tagName: 'foreignObject',
        className: 'tooltip',
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

