"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';

// Common base class for gate models
joint.shapes.basic.Generic.define('digital.Gate', {
    size: { width: 80, height: 30 },
    inputSignals: {},
    outputSignals: {},
    attrs: {
        '.': { magnet: false },
        '.body': { width: 80, height: 30 },
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
        const signame = port.dir == 'in' ? 'inputSignals' : 'outputSignals';
        if (_.get(args, [signame, port.id]) === undefined) {
            _.set(args, [signame, port.id],
                _.times(port.bits, _.constant(0)));
        }
        return '<g>' + markup + '</g>';
    }
});

joint.shapes.digital.GateView = joint.dia.ElementView.extend({
});

// Lamp model -- displays a single-bit input
joint.shapes.digital.Gate.define('digital.Lamp', {
    size: { width: 30, height: 30 },
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

// Numeric display -- displays a number
joint.shapes.digital.Gate.define('digital.NumDisplay', {
    bits: 1,
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

// Numeric entry -- parses a number from a text box
joint.shapes.digital.Gate.define('digital.NumEntry', {
    bits: 1,
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
        args.buttonState = args.outputSignals.out;
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

// Button model -- single-bit clickable input
joint.shapes.digital.Gate.define('digital.Button', {
    size: { width: 30, height: 30 },
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

// Subcircuit model -- embeds a circuit graph in an element
joint.shapes.digital.Gate.define('digital.Subcircuit', {
    attrs: {
        'text.iolabel': { fill: 'black', 'y-alignment': 'middle', ref: '.body' },
        'path.wire' : { ref: '.body', 'ref-y': .5, stroke: 'black' },
        'text.type': {
            text: '', ref: '.body', 'ref-x': 0.5, 'ref-y': -2, 'x-alignment': 'middle',
            'y-alignment': 'bottom', fill: 'black'
        },
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
        _.set(args, ['attrs', 'text.type', 'text'], args.celltype);
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
        markup.push('<g class="scalable"><rect class="body"/></g><text class="label"/><text class="type"/>');
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

// Input/output model
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

// Input model
joint.shapes.digital.IO.define('digital.Input', {
}, {
    io_dir: 'out'
});
joint.shapes.digital.InputView = joint.shapes.digital.GateView;

// Output model
joint.shapes.digital.IO.define('digital.Output', {
}, {
    io_dir: 'in'
});
joint.shapes.digital.OutputView = joint.shapes.digital.GateView;

// Constant
joint.shapes.digital.Gate.define('digital.Constant', {
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
        args.outputSignals = args.constant;
        _.set(args, ['attrs', 'text.value', 'text'], sig2binary(args.constant));
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.constant.length }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            '<text class="label" />',
            '<text class="value" />',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('constant') };
    }
});

// Bit extending
joint.shapes.digital.Gate.define('digital.BitExtend', {
    attrs: {
        "text.value": {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        console.assert(args.extend.input <= args.extend.output);
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.extend.input}),
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.extend.output}),
            '<g class="scalable"><rect class="body"/></g><text class="label"/>',
            '<text class="value"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const ex = this.get('extend');
        return { out: data.in.concat(Array(ex.output - ex.input).fill(this.extbit(data.in))) };
    }
});

joint.shapes.digital.BitExtend.define('digital.ZeroExtend', {
    attrs: {
        "text.value": { text: 'zero-extend' }
    }
}, {
    extbit: function(i) {
        return -1;
    }
});

joint.shapes.digital.BitExtend.define('digital.SignExtend', {
    attrs: {
        "text.value": { text: 'sign-extend' }
    }
}, {
    extbit: function(i) {
        return i.slice(-1)[0];
    }
});

// Bus slicing
joint.shapes.digital.Gate.define('digital.BusSlice', {
    size: { width: 40, height: 24 },
    attrs: {
        ".body": {
            size: { width: 40, height: 24 }
        },
        "text.value": {
            text: '',
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        const markup = [];
        args.bits = 0;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.slice.total}),
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.slice.count}),
            '<g class="scalable"><rect class="body"/></g><text class="label"/>',
            '<text class="value"/>',
            '</g>'
        ].join('');
        const val = args.slice.count == 1 ? args.slice.first : 
            args.slice.first + "-" + (args.slice.first + args.slice.count - 1);
        _.set(args, ["attrs", "text.value", "text"], '[' + val + ']');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const s = this.get('slice');
        return { out: data.in.slice(s.first, s.first + s.count) };
    }
});

// Bus grouping
joint.shapes.digital.Gate.define('digital.BusRegroup', {
}, {
    constructor: function(args) {
        const markup = [];
        args.bits = 0;
        markup.push('<g class="rotatable">');
        const size = { width: 40, height: args.groups.length*16+8 };
        _.set(args, ['attrs', '.body'], size);
        args.size = size;
        for (const [num, gbits] of args.groups.entries()) {
            const y = num*16+12;
            args.bits += gbits;
            markup.push(this.addWire(args, this.group_dir == 'out' ? 'right' : 'left', y,
                { id: this.group_dir + num, dir: this.group_dir, bits: gbits }));
        }
        const contra = this.group_dir == 'out' ? 'in' : 'out';
        markup.push(this.addWire(args, this.group_dir == 'out' ? 'left' : 'right', 0.5,
            { id: contra, dir: contra, bits: args.bits }));
        markup.push('<g class="scalable"><rect class="body"/></g><text class="label"/>');
        markup.push('</g>');
        this.markup = markup.join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});

joint.shapes.digital.BusRegroup.define('digital.BusGroup', {
}, {
    group_dir : 'in',
    operation: function(data) {
        const outdata = [];
        for (const num of this.get('groups').keys()) {
            outdata.push(data['in' + num]);
        }
        return { out : _.flatten(outdata) };
    }
});
joint.shapes.digital.BusGroupView = joint.shapes.digital.GateView;

joint.shapes.digital.BusRegroup.define('digital.BusUngroup', {
}, {
    group_dir : 'out',
    operation: function(data) {
        const outdata = {};
        let pos = 0;
        for (const [num, gbits] of this.get('groups').entries()) {
            outdata['out' + num] = data.in.slice(pos, pos + gbits);
            pos += gbits;
        }
        return outdata;
    }
});
joint.shapes.digital.BusUngroupView = joint.shapes.digital.GateView;

// Single-input gate model
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

// Two-input gate model
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

// Reducing gate model
joint.shapes.digital.Gate.define('digital.GateReduce', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 75, height: 50 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
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

// Repeater (buffer) gate model
joint.shapes.digital.Gate11.define('digital.Repeater', {
    attrs: { image: { 'xlink:href': require('./gate-repeater.svg') }}
}, {
    operation: function(data) {
        return { out: data.in };
    }
});

// Not gate model
joint.shapes.digital.Gate11.define('digital.Not', {
    attrs: { image: { 'xlink:href': require('./gate-not.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.map((x) => -x) };
    }
});
joint.shapes.digital.NotView = joint.shapes.digital.GateView;

// Or gate model
joint.shapes.digital.Gate21.define('digital.Or', {
    attrs: { image: { 'xlink:href': require('./gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => Math.max(x, y)) };
    }
});
joint.shapes.digital.OrView = joint.shapes.digital.GateView;

// And gate model
joint.shapes.digital.Gate21.define('digital.And', {
    attrs: { image: { 'xlink:href': require('./gate-and.svg') }}

}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => Math.min(x, y)) };
    }
});
joint.shapes.digital.AndView = joint.shapes.digital.GateView;

// Nor gate model
joint.shapes.digital.Gate21.define('digital.Nor', {
    attrs: { image: { 'xlink:href': require('./gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -Math.max(x, y)) };
    }
});
joint.shapes.digital.NorView = joint.shapes.digital.GateView;

// Nand gate model
joint.shapes.digital.Gate21.define('digital.Nand', {
    attrs: { image: { 'xlink:href': require('./gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -Math.min(data.in1, data.in2)) };
    }
});
joint.shapes.digital.NandView = joint.shapes.digital.GateView;

// Xor gate model
joint.shapes.digital.Gate21.define('digital.Xor', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -x * y) };
    }
});
joint.shapes.digital.XorView = joint.shapes.digital.GateView;

// Xnor gate model
joint.shapes.digital.Gate21.define('digital.Xnor', {
    attrs: { image: { 'xlink:href': require('./gate-xnor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => x * y) };
    }
});
joint.shapes.digital.XnorView = joint.shapes.digital.GateView;

// Reducing Or gate model
joint.shapes.digital.GateReduce.define('digital.OrReduce', {
    attrs: { image: { 'xlink:href': require('./gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: [Math.max(...data.in)] };
    }
});

// Reducing Nor gate model
joint.shapes.digital.GateReduce.define('digital.NorReduce', {
    attrs: { image: { 'xlink:href': require('./gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: [-Math.max(...data.in)] };
    }
});

// Reducing And gate model
joint.shapes.digital.GateReduce.define('digital.AndReduce', {
    attrs: { image: { 'xlink:href': require('./gate-and.svg') }}
}, {
    operation: function(data) {
        return { out: [Math.min(...data.in)] };
    }
});

// Reducing Nand gate model
joint.shapes.digital.GateReduce.define('digital.NandReduce', {
    attrs: { image: { 'xlink:href': require('./gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: [-Math.min(...data.in)] };
    }
});

// Reducing Xor gate model
joint.shapes.digital.GateReduce.define('digital.XorReduce', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: [data.in.reduce((a, b) => -a * b)] };
    }
});

// Reducing Xor gate model
joint.shapes.digital.GateReduce.define('digital.XnorReduce', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: [data.in.reduce((a, b) => a * b)] };
    }
});

// Unary arithmetic operations
joint.shapes.digital.Gate.define('digital.Arith11', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in: 1, out: 1 };
        if (!args.signed) args.signed = false;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits.in }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        if (data.in.some(x => x == 0))
            return { out: Array(bits.out).fill(0) };
        return {
            out: bigint2sig(this.arithop(sig2bigint(data.in, this.get('signed'))), bits.out)
        };
    }
});

// Binary arithmetic operations
joint.shapes.digital.Gate.define('digital.Arith21', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1, out: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (data.in1.some(x => x == 0) || data.in2.some(x => x == 0))
            return { out: Array(bits.out).fill(0) };
        return {
            out: bigint2sig(this.arithop(
                    sig2bigint(data.in1, sgn.in1),
                    sig2bigint(data.in2, sgn.in2)), bits.out)
        };
    }
});

// Bit shift operations
joint.shapes.digital.Gate.define('digital.Shift', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1, out: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        if (!args.fillx) args.fillx = false;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const fillx = this.get('fillx');
        if (data.in2.some(x => x == 0))
            return { out: Array(bits.out).fill(0) };
        const am = sig2bigint(data.in2, sgn.in2) * this.shiftdir;
        const signbit = data.in1.slice(-1)[0];
        const ext = Array(Math.max(0, bits.out - bits.in1))
            .fill(fillx ? 0 : sgn.in1 ? data.in1.slice(-1)[0] : -1);
        const my_in = data.in1.concat(ext);
        const out = am < 0
            ? Array(-am).fill(fillx ? 0 : -1).concat(my_in)
            : my_in.slice(am).concat(Array(am).fill(fillx ? 0 : sgn.out ? my_in.slice(-1)[0] : -1));
        return { out: out.slice(0, bits.out) };
    }
});

// Comparison operations
joint.shapes.digital.Gate.define('digital.Compare', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (data.in1.some(x => x == 0) || data.in2.some(x => x == 0))
            return { out: [0] };
        return {
            out: [this.arithcomp(
                    sig2bigint(data.in1, sgn.in1),
                    sig2bigint(data.in2, sgn.in2)) ? 1 : -1]
        };
    }
});

// Negation
joint.shapes.digital.Arith11.define('digital.Negation', {
    attrs: {
        'text.oper': { text: '-' }
    }
}, {
    arithop: i => bigInt.zero.minus(i)
});

// Unary plus
joint.shapes.digital.Arith11.define('digital.UnaryPlus', {
    attrs: {
        'text.oper': { text: '+' }
    }
}, {
    arithop: i => i
});

// Addition
joint.shapes.digital.Arith21.define('digital.Addition', {
    attrs: {
        'text.oper': { text: '+' }
    }
}, {
    arithop: (i, j) => i.plus(j)
});

// Subtraction
joint.shapes.digital.Arith21.define('digital.Subtraction', {
    attrs: {
        'text.oper': { text: '-' }
    }
}, {
    arithop: (i, j) => i.minus(j)
});

// Multiplication
joint.shapes.digital.Arith21.define('digital.Multiplication', {
    attrs: {
        'text.oper': { text: '×' }
    }
}, {
    arithop: (i, j) => i.multiply(j)
});

// Division
joint.shapes.digital.Arith21.define('digital.Division', {
    attrs: {
        'text.oper': { text: '÷' }
    }
}, {
    arithop: (i, j) => i.divide(j)
});

// Modulo
joint.shapes.digital.Arith21.define('digital.Modulo', {
    attrs: {
        'text.oper': { text: '%' }
    }
}, {
    arithop: (i, j) => i.mod(j)
});

// Power
joint.shapes.digital.Arith21.define('digital.Power', {
    attrs: {
        'text.oper': { text: '**' }
    }
}, {
    arithop: (i, j) => i.pow(j)
});

// Shift left operator
joint.shapes.digital.Shift.define('digital.ShiftLeft', {
    attrs: {
        'text.oper': { text: '≪' }
    }
}, {
    shiftdir: -1
});

// Shift right operator
joint.shapes.digital.Shift.define('digital.ShiftRight', {
    attrs: {
        'text.oper': { text: '≫' }
    }
}, {
    shiftdir: 1
});

// Less than operator
joint.shapes.digital.Compare.define('digital.Lt', {
    attrs: {
        'text.oper': { text: '<' }
    }
}, {
    arithcomp: (i, j) => i.lt(j)
});

// Less or equal operator
joint.shapes.digital.Compare.define('digital.Le', {
    attrs: {
        'text.oper': { text: '≤' }
    }
}, {
    arithcomp: (i, j) => i.leq(j)
});

// Greater than operator
joint.shapes.digital.Compare.define('digital.Gt', {
    attrs: {
        'text.oper': { text: '>' }
    }
}, {
    arithcomp: (i, j) => i.gt(j)
});

// Less than operator
joint.shapes.digital.Compare.define('digital.Ge', {
    attrs: {
        'text.oper': { text: '≥' }
    }
}, {
    arithcomp: (i, j) => i.geq(j)
});

// Equality operator
joint.shapes.digital.Compare.define('digital.Eq', {
    attrs: {
        'text.oper': { text: '=' }
    }
}, {
    arithcomp: (i, j) => i.lesser(j)
});

// Nonequality operator
joint.shapes.digital.Compare.define('digital.Ne', {
    attrs: {
        'text.oper': { text: '≠' }
    }
}, {
    arithcomp: (i, j) => i.lesser(j)
});

// Connecting wire model
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
    ].join(''),

    initialize: function() {
        joint.dia.Link.prototype.initialize.apply(this, arguments);
        this.router('metro', {
            startDirections: ['right'],
            endDirections: ['left']
        });
    }
});

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

function validNumber(str) {
    const re = /^[01x]+$/;
    return re.test(str);
}

function binary2sig(str, bits) {
    if (str.length > bits) str = str.substring(str.length - bits);
    const lettermap = new Map([['x', 0], ['0', -1], ['1', 1]]);
    return _.times(bits - str.length, _.constant(str[0] == 'x' ? 0 : -1))
        .concat(str.split('').map((x => lettermap.get(x)))).reverse();
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
    return sig.map((x) => digitmap.get(x)).reverse().join('');
}

function bigint2sig(i, bits) {
    const j = i.isNegative() ? bigInt.one.shiftLeft(bits).plus(i) : i;
    return j.toArray(2).value
        .reverse()
        .map(x => (x<<1)-1)
        .concat(Array(bits).fill(-1))
        .slice(0, bits);
}

function sig2bigint(sig, signed) {
    const sign = signed && sig.slice(-1)[0] == 1;
    const j = bigInt.fromArray(sig.slice().reverse().map(x => (x+1)>>1), 2);
    return sign ? j.minus(bigInt.one.shiftLeft(sig.length)) : j;
}

