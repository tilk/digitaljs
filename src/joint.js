"use strict";

import joint from 'jointjs';

joint.shapes.basic.Generic.define('digital.Gate', {
    size: { width: 80, height: 40 },
    inputSignals: {},
    outputSignals: {},
    attrs: {
        '.': { magnet: false },
        '.body': { width: 100, height: 50 },
        'circle[port]': { r: 7, stroke: 'black', fill: 'transparent', 'stroke-width': 2 },
        'text.label': {
            text: '', ref: '.body', 'ref-x': 0.5, 'ref-dy': 2, 'x-alignment': 'middle', 
            fill: 'black'
        }
    }
}, {
    operation: function() {
        return {};
    },
    constructor: function(args) {
        if ('label' in args) _.set(args, ['attrs', 'text.label', 'text'], args.label);
        joint.shapes.basic.Generic.prototype.constructor.apply(this, arguments);
    },
    initialize: function() {
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        this.updatePortSignals('in', this.get('inputSignals'));
        this.updatePortSignals('out', this.get('outputSignals'));
        this.listenTo(this, 'change:inputSignals', function(wire, signal) {
            this.updatePortSignals('in', signal);
        });
        this.listenTo(this, 'change:outputSignals', function(wire, signal) {
            this.updatePortSignals('out', signal);
        });
    },
    updatePortSignals: function(dir, signal) {
        for (const portname in this.ports) {
            const port = this.ports[portname];
            if (port.dir !== dir) continue;
            let classes = [port.dir];
            if (isLive(signal[port.id])) classes.push('live');
            if (isLow(signal[port.id])) classes.push('low');
            this.attr("[port='" + port.id + "']/class", classes.join(' '));
        }
    }
});

joint.shapes.digital.GateView = joint.dia.ElementView.extend({
});

joint.shapes.digital.Gate.define('digital.Lamp', {
    size: { width: 30, height: 30 },
    inputSignals: { in: [0] },
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 50, height: 50 },
        '.wire': { ref: '.body', 'ref-y': .5, 'ref-x': 0, d: 'M 0 0 L -20 0' },
        '.in': { ref: '.body', 'ref-x': -20, 'ref-y': 0.5, magnet: true, port: { id: 'in', dir: 'in', bits: 1 } },
        '.led': {
            ref: '.body', 'ref-x': .5, 'ref-y': .5,
            'x-alignment': 'middle', 'y-alignment': 'middle', r: 15
        }
    }
}, {
    markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<rect class="body"/>',
        '<circle class="led"/>',
        '</g>',
        '<path class="wire"/>',
        '<circle class="in"/>',
        '<text class="label"/>',
        '</g>'
    ].join('')
});
joint.shapes.digital.LampView = joint.shapes.digital.GateView.extend({
    initialize: function() {
        joint.shapes.digital.GateView.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change:inputSignals', function(wire, signal) {
            this.$(".led").toggleClass('live', isLive(signal.in));
            this.$(".led").toggleClass('low', isLow(signal.in));
        });
    }
});

joint.shapes.digital.Gate.define('digital.NumDisplay', {
    bits: 1,
    inputSignals: { in: [0] },
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        '.wire': { ref: '.body', 'ref-y': .5, stroke: 'black', 'ref-x': 0, d: 'M 0 0 L -13 0' },
        circle: { ref: '.body', 'ref-x': -20, 'ref-y': 0.5, magnet: 'passive', port: { id: 'in', dir: 'in', bits: 1 } },
        'text.value': { 
            text: '',
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px',
            'font-family': 'monospace'
        }
    }
}, {
    markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<rect class="body"/>',
        '</g>',
        '<path class="wire"/>',
        '<circle/>',
        '<text class="value"/>',
        '<text class="label"/>',
        '</g>'
    ].join(''),
    constructor: function(args) {
        if ('bits' in args) {
            _.set(args, ['attrs', 'circle', 'port', 'bits'], args.bits);
            if (!('inputSignals' in args))
                args.inputSignals = { in : _.times(args.bits, _.constant(0)) };
        }
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        joint.shapes.digital.Gate.prototype.initialize.apply(this, arguments);
        this.attr('text.value/text', sig2binary(this.get('inputSignals').in));
        this.listenTo(this, 'change:inputSignals', function(wire, signal) {
            this.attr('text.value/text', sig2binary(signal));
        });
    }
});
joint.shapes.digital.NumDisplayView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate.define('digital.Button', {
    size: { width: 30, height: 30 },
    outputSignals: { out: [0] },
    buttonState: false,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 50, height: 50 },
        '.btnface': { 
            stroke: 'black', 'stroke-width': 2,
            'ref': '.body', 'ref-height': .8, 'ref-width': .8, 'ref-x': .5, 'ref-y': .5,
            'x-alignment': 'middle', 'y-alignment': 'middle',
            cursor: 'pointer'
        },
        '.wire': { ref: '.body', 'ref-y': .5, 'ref-dx': 0, d: 'M 0 0 L 20 0' },
        '.out': { ref: '.body', 'ref-dx': 20, 'ref-y': 0.5, magnet: true, port: { id: 'out', dir: 'out', bits: 1 } }
    }
}, {
    markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<rect class="body"/>',
        '<rect class="btnface"/>',
        '</g>',
        '<path class="wire"/>',
        '<circle class="out" />',
        '<text class="label"/>',
        '</g>'
    ].join(''),
    operation: function() {
        return { out: [this.get('buttonState') ? 1 : -1] };
    }
});
joint.shapes.digital.ButtonView = joint.shapes.digital.GateView.extend({
    initialize: function() {
        joint.shapes.digital.GateView.prototype.initialize.apply(this, arguments);
        this.$(".btnface").toggleClass('live', this.model.get('buttonState'));
        this.listenTo(this.model, 'change:buttonState', function(wire, signal) {
            this.$(".btnface").toggleClass('live', signal);
        });
    },
    events: {
        "click .btnface": "activateButton"
    },
    activateButton: function() {
        this.model.set('buttonState', !this.model.get('buttonState'));
    }
});

joint.shapes.digital.Gate.define('digital.Subcircuit', {
    attrs: {
        'text.iolabel': { fill: 'black', 'y-alignment': 'middle', ref: '.body' },
        'path.wire' : { ref: '.body', 'ref-y': .5, stroke: 'black' }
    }
}, {
    constructor: function(args) {
        console.assert(args.graph instanceof joint.dia.Graph);
        const graph = args.graph;
        graph.set('subcircuit', this);
        const IOs = graph.getCells()
            .filter((cell) => cell instanceof joint.shapes.digital.IO);
        const inputs = IOs.filter((cell) => cell instanceof joint.shapes.digital.Input);
        const outputs = IOs.filter((cell) => cell instanceof joint.shapes.digital.Output);
        function sortfun(x, y) {
            if (x.has('order') || y.has('order'))
                return x.get('order') - y.get('order');
            return x.get('net').localeCompare(y.get('net'));
        }
        inputs.sort(sortfun);
        outputs.sort(sortfun);
        const vcount = Math.max(inputs.length, outputs.length);
        const size = { width: 80, height: vcount*16+8 };
        const markup = [];
        markup.push('<g class="rotatable"><g class="scalable"><rect class="body"/></g><text class="label"/>');
        const iomap = {};
        for (const io of IOs) {
            iomap[io.get('net')] = io.get('id');
            markup.push('<circle class="io_' + io.get('net') + '"/>');
            markup.push('<text class="iolabel io_' + io.get('net') + '"/>');
            markup.push('<path class="wire io_' + io.get('net') + '"/>');
        }
        const attrs = { '.body': size };
        for (const [num, io] of inputs.entries()) {
            const y = num*16+12;
            attrs['circle.io_' + io.get('net')] = {
                ref: '.body', 'ref-x': -20, 'ref-y': y,
                magnet: 'passive', port: { id: io.get('net'), dir: 'in', bits: io.get('bits') }
            };
            attrs['text.io_' + io.get('net')] = {
                'ref-y': y, 'ref-x': 5, 'x-alignment': 'left', text: io.get('net')
            }
            attrs['path.io_' + io.get('net')] = {
                'ref-x': 0, 'ref-y': y, d: 'M 0 0 L -13 0'
            }
        }
        for (const [num, io] of outputs.entries()) {
            const y = num*16+12;
            attrs['circle.io_' + io.get('net')] = {
                ref: '.body', 'ref-dx': 20, 'ref-y': y,
                magnet: true, port: { id: io.get('net'), dir: 'out', bits: io.get('bits') }
            };
            attrs['text.io_' + io.get('net')] = {
                'ref-y': y, 'ref-dx': -5, 'x-alignment': 'right', text: io.get('net')
            }
            attrs['path.io_' + io.get('net')] = {
                'ref-dx': 0, 'ref-y': y, d: 'M 0 0 L 13 0'
            }
        }
        markup.push('</g>');
        this.markup = markup.join('');
        args.size = size;
        args.circuitIOmap = iomap;
        args.attrs = attrs;
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});
joint.shapes.digital.SubcircuitView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate.define('digital.IO', {
    size: { width: 60, height: 30 },
    bits: 1,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        '.wire': { ref: '.body', 'ref-y': .5, stroke: 'black' },
        text: {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-weight': 'bold',
            'font-size': '14px'
        }
    }
}, {
    markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<rect class="body"/>',
        '</g>',
        '<path class="wire"/>',
        '<circle/>',
        '<text/>',
        '</g>'
    ].join(''),
    constructor: function(args) {
        if ('bits' in args) _.set(args, ['attrs', 'circle', 'port', 'bits'], args.bits);
        _.set(args, ['attrs', 'text', 'text'], args.net);
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});

joint.shapes.digital.IO.define('digital.Input', {
    attrs: {
        '.wire': { 'ref-dx': 0, d: 'M 0 0 L 13 0' },
        circle: { ref: '.body', 'ref-dx': 20, 'ref-y': 0.5, magnet: true, port: { id: 'out', dir: 'out', bits: 1 } },
        text: { text: 'input' }
    }
});
joint.shapes.digital.InputView = joint.shapes.digital.GateView;

joint.shapes.digital.IO.define('digital.Output', {
    attrs: {
        '.wire': { 'ref-x': 0, d: 'M 0 0 L -13 0' },
        circle: { ref: '.body', 'ref-x': -20, 'ref-y': 0.5, magnet: 'passive', port: { id: 'in', dir: 'in', bits: 1 } },
        text: { text: 'output' }
    }
});
joint.shapes.digital.OutputView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate.define('digital.Gate11', {
    attrs: {
        '.in': { ref: '.body', 'ref-x': -2, 'ref-y': 0.5, magnet: 'passive', port: { id: 'in', dir: 'in', bits: 1 } },
        '.out': { ref: '.body', 'ref-dx': 2, 'ref-y': 0.5, magnet: true, port: { id: 'out', dir: 'out', bits: 1 } }
    }
}, {
    markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<image class="body"/>',
        '</g>',
        '<circle class="in"/>',
        '<circle class="out"/>',
        '<text class="label"/>',
        '</g>'
    ].join(''),
});

joint.shapes.digital.Gate.define('digital.Gate21', {
    attrs: {
        '.in1': { ref: '.body', 'ref-x': -2, 'ref-y': 0.3, magnet: 'passive', port: { id: 'in1', dir: 'in', bits: 1 } },
        '.in2': { ref: '.body', 'ref-x': -2, 'ref-y': 0.7, magnet: 'passive', port: { id: 'in2', dir: 'in', bits: 1 } },
        '.out': { ref: '.body', 'ref-dx': 2, 'ref-y': 0.5, magnet: true, port: { id: 'out', dir: 'out', bits: 1 } }
    }
}, {
    markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<image class="body"/>',
        '</g>',
        '<circle class="in in1"/>',
        '<circle  class="in in2"/>',
        '<circle class="out"/>',
        '<text class="label"/>',
        '</g>'
    ].join('')
});

joint.shapes.digital.Gate11.define('digital.Repeater', {
    attrs: { image: { 'xlink:href': require('./gate-repeater.svg') }}
}, {
    operation: function(data) {
        return { out: data.in };
    }
});

joint.shapes.digital.Gate11.define('digital.Not', {
    attrs: { image: { 'xlink:href': require('./gate-not.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.map((x) => -x) };
    }
});
joint.shapes.digital.NotView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate21.define('digital.Or', {
    attrs: { image: { 'xlink:href': require('./gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => Math.max(x, y)) };
    }
});
joint.shapes.digital.OrView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate21.define('digital.And', {
    attrs: { image: { 'xlink:href': require('./gate-and.svg') }}

}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => Math.min(x, y)) };
    }
});
joint.shapes.digital.AndView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate21.define('digital.Nor', {
    attrs: { image: { 'xlink:href': require('./gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -Math.max(x, y)) };
    }
});
joint.shapes.digital.NorView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate21.define('digital.Nand', {
    attrs: { image: { 'xlink:href': require('./gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -Math.min(data.in1, data.in2)) };
    }
});
joint.shapes.digital.NandView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate21.define('digital.Xor', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -x * y) };
    }
});
joint.shapes.digital.XorView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate21.define('digital.Xnor', {
    attrs: { image: { 'xlink:href': require('./gate-xnor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -x * y) };
    }
});
joint.shapes.digital.XnorView = joint.shapes.digital.GateView;

joint.dia.Link.define('digital.Wire', {
    attrs: {
        '.connection': { 'stroke-width': 2 },
        '.marker-vertex': { r: 7 }
    },
    signal: [0],
    bits: 1,

    router: { name: 'orthogonal' },
    connector: { name: 'rounded', args: { radius: 10 }}
}, {
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
    ].join('')
});

function isLive(sig) {
    return _.some(sig, (x) => x > 0);
}

function isLow(sig) {
    return _.every(sig, (x) => x < 0);
}

function sig2binary(sig) {
    const digitmap = new Map([[-1, '0'], [0, 'x'], [1, '1']]);
    return sig.map((x) => digitmap.get(x)).join('');
}

joint.shapes.digital.WireView = joint.dia.LinkView.extend({
    initialize: function() {
        joint.dia.LinkView.prototype.initialize.apply(this, arguments);
        this.$el.toggleClass('live', isLive(this.model.get('signal')));
        this.$el.toggleClass('low', isLow(this.model.get('signal')));
        this.listenTo(this.model, 'change:signal', function(wire, signal) {
            this.$el.toggleClass('live', isLive(signal));
            this.$el.toggleClass('low', isLow(signal));
        });
    }
});

