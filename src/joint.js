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
        },
        'text.bits': {
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
            let classes = [port.dir, 'port_' + port.id];
            classes.push(sigClass(signal[port.id]));
            this.attr("[port='" + port.id + "']/class", classes.join(' '));
        }
    },
    addWire: function(args, side, loc, port) {
        const wire_args = {
            ref: 'circle.port_' + port.id, 'ref-y': .5, 'ref-x': .5,
            d: 'M 0 0 L ' + (side == 'left' ? '40 0' : '-40 0')
        };
        const circle_args = {
            ref: '.body',
            magnet: port.dir == 'out' ? true : 'passive',
            port: port
        };
        circle_args['ref-y'] = loc;
        if (side == 'left') {
            circle_args['ref-x'] = -20;
        } else if (side == 'right') {
            circle_args['ref-dx'] = 20;
        } else console.assert(false);
        _.set(args, ['attrs', 'path.wire.port_' + port.id], wire_args);
        _.set(args, ['attrs', 'circle.port_' + port.id], circle_args);
        let markup = '<path class="wire port_' + port.id + '"/><circle class="port_' + port.id + '"/>';
        if (port.bits > 1) {
            markup += '<text class="bits port_' + port.id + '"/>';
            const bits_args = {
                text: port.bits,
                ref: 'circle.port_' + port.id,
                'ref-y': -3,
                'text-anchor': 'middle'
            };
            if (side == 'left') {
                bits_args['ref-dx'] = 6;
            } else if (side == 'right') {
                bits_args['ref-x'] = -6;
            } else console.assert(false);
            _.set(args, ['attrs', 'text.bits.port_' + port.id], bits_args);
        }
        return '<g>' + markup + '</g>';
    }
});

joint.shapes.digital.GateView = joint.dia.ElementView.extend({
});

joint.shapes.digital.Gate.define('digital.Lamp', {
    size: { width: 30, height: 30 },
    inputSignals: { in: [0] },
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 50, height: 50 },
        '.led': {
            ref: '.body', 'ref-x': .5, 'ref-y': .5,
            'x-alignment': 'middle', 'y-alignment': 'middle', r: 15
        }
    }
}, {
    constructor: function(args) {
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: 1 }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '<circle class="led"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('')
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
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
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        if (!('inputSignals' in args))
            args.inputSignals = { in : _.times(args.bits, _.constant(0)) };
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            '<text class="value"/>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        joint.shapes.digital.Gate.prototype.initialize.apply(this, arguments);
        this.attr('text.value/text', sig2binary(this.get('inputSignals').in));
        this.listenTo(this, 'change:inputSignals', function(wire, signal) {
            this.attr('text.value/text', sig2binary(signal.in));
        });
    }
});
joint.shapes.digital.NumDisplayView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate.define('digital.NumEntry', {
    bits: 1,
    outputSignals: { out: [0] },
    buttonState: [0],
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'foreignObject': {
            ref: '.body', 'ref-x': 0.5, 'ref-y': 0.5,
            width: 60, height: 30,
            'x-alignment': 'middle', 'y-alignment': 'middle'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        if (!('outputSignals' in args))
            args.outputSignals = { out : _.times(args.bits, _.constant(0)) };
        args.buttonState = args.outputSignals.out;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<foreignObject requiredExtensions="http://www.w3.org/1999/xhtml">',
            '<body xmlns="http://www.w3.org/1999/xhtml">',
            '<input type="text" />',
            '</body></foreignObject>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('buttonState') };
    },
});
joint.shapes.digital.NumEntryView = joint.shapes.digital.GateView.extend({
    events: {
        "click input": "stopprop",
        "mousedown input": "stopprop",
        "change input": "change"
    },
    stopprop: function(evt) {
        evt.stopPropagation();
    },
    change: function(evt) {
        if (validNumber(evt.target.value)) {
            const val = binary2sig(evt.target.value, this.model.get('bits'));
            this.model.set('buttonState', val);
            this.$('input').val(sig2binary(val));
            this.$('input').removeClass('invalid');
        } else {
            this.$('input').addClass('invalid');
        }
    }
});

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
        }
    }
}, {
    constructor: function(args) {
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '<rect class="btnface"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
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
        "click .btnface": "activateButton",
        "mousedown .btnface": "stopprop"
    },
    activateButton: function() {
        this.model.set('buttonState', !this.model.get('buttonState'));
    },
    stopprop: function(evt) {
        evt.stopPropagation();
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
        markup.push('<g class="rotatable">');
        const iomap = {};
        _.set(args, ['attrs', '.body'], size);
        for (const [num, io] of inputs.entries()) {
            const y = num*16+12;
            markup.push(this.addWire(args, 'left', y, { id: io.get('net'), dir: 'in', bits: io.get('bits') }));
            args.attrs['text.port_' + io.get('net')] = {
                'ref-y': y, 'ref-x': 5, 'x-alignment': 'left', text: io.get('net')
            }
        }
        for (const [num, io] of outputs.entries()) {
            const y = num*16+12;
            markup.push(this.addWire(args, 'right', y, { id: io.get('net'), dir: 'out', bits: io.get('bits') }));
            args.attrs['text.port_' + io.get('net')] = {
                'ref-y': y, 'ref-dx': -5, 'x-alignment': 'right', text: io.get('net')
            }
        }
        markup.push('<g class="scalable"><rect class="body"/></g><text class="label"/>');
        for (const io of IOs) {
            iomap[io.get('net')] = io.get('id');
            markup.push('<text class="iolabel port_' + io.get('net') + '"/>');
        }
        markup.push('</g>');
        this.markup = markup.join('');
        args.size = size;
        args.circuitIOmap = iomap;
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});
joint.shapes.digital.SubcircuitView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate.define('digital.IO', {
    size: { width: 60, height: 30 },
    bits: 1,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        text: {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-weight': 'bold',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, this.io_dir == 'out' ? 'right' : 'left', 0.5, { id: this.io_dir, dir: this.io_dir, bits: args.bits }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            '<text/>',
            '</g>'
        ].join('');
        if ('bits' in args) _.set(args, ['attrs', 'circle', 'port', 'bits'], args.bits);
        _.set(args, ['attrs', 'text', 'text'], args.net);
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});

joint.shapes.digital.IO.define('digital.Input', {
}, {
    io_dir: 'out'
});
joint.shapes.digital.InputView = joint.shapes.digital.GateView;

joint.shapes.digital.IO.define('digital.Output', {
}, {
    io_dir: 'in'
});
joint.shapes.digital.OutputView = joint.shapes.digital.GateView;

joint.shapes.digital.Gate.define('digital.Gate11', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 75, height: 50 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<image class="body"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
});

joint.shapes.digital.Gate.define('digital.Gate21', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 75, height: 50 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<image class="body"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
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

function validNumber(str) {
    const re = /^[01x]+$/;
    return re.test(str);
}

function binary2sig(str, bits) {
    if (str.length > bits) str = str.substring(str.length - bits);
    const lettermap = new Map([['x', 0], ['0', -1], ['1', 1]]);
    return _.times(bits - str.length, _.constant(str[0] == 'x' ? 0 : -1))
        .concat(str.split('').map((x => lettermap.get(x))));
}

function isLive(sig) {
    return _.every(sig, (x) => x > 0);
}

function isLow(sig) {
    return _.every(sig, (x) => x < 0);
}

function isDefined(sig) {
    return _.some(sig, (x) => x != 0);
}

function sigClass(sig) {
    if (isLive(sig)) return 'live';
    else if (isLow(sig)) return 'low';
    else if (isDefined(sig)) return 'defined';
    else return '';
}

function sig2binary(sig) {
    const digitmap = new Map([[-1, '0'], [0, 'x'], [1, '1']]);
    return sig.map((x) => digitmap.get(x)).join('');
}

joint.shapes.digital.WireView = joint.dia.LinkView.extend({
    initialize: function() {
        joint.dia.LinkView.prototype.initialize.apply(this, arguments);
        const cl = sigClass(this.model.get('signal'));
        this.$el.toggleClass('live', cl == 'live');
        this.$el.toggleClass('low', cl == 'low');
        this.$el.toggleClass('defined', cl == 'defined');
        this.listenTo(this.model, 'change:signal', function(wire, signal) {
            const cl = sigClass(this.model.get('signal'));
            this.$el.toggleClass('live', cl == 'live');
            this.$el.toggleClass('low', cl == 'low');
            this.$el.toggleClass('defined', cl == 'defined');
        });
    }
});

